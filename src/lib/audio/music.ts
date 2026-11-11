import { midi, noise, tone } from './synth'
import type { MusicVoice } from './themes'

export type MusicPattern = 'draw' | 'idle'

/** How far ahead notes are scheduled, and how often the scheduler wakes up. */
const LOOKAHEAD_SECONDS = 0.14
const TICK_MS = 30
const STEPS = 32

/** Chord roots (MIDI) per bar of the two-bar loop: A minor, then F → G. */
const DRAW_ROOTS = [57, 57, 57, 57, 53, 53, 55, 55] as const
const DRAW_ARPEGGIO = [0, 7, 12, 15, 19, 15, 12, 7] as const
const IDLE_CHORDS = [
  [57, 64, 69, 72],
  [53, 60, 65, 69],
] as const

/**
 * Generative background music: a step sequencer scheduled on the Web Audio clock
 * ("lookahead" scheduling), so timing stays tight even when the main thread is busy animating.
 * Nothing is pre-recorded; the loop is synthesised note by note.
 */
export class MusicEngine {
  private ctx: AudioContext | null = null
  private output: GainNode | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private pattern: MusicPattern | null = null
  private voice: MusicVoice | null = null
  private volume = 0.5
  private nextTime = 0
  private step = 0

  /** Connect to the shared context. `destination` is the app's master gain. */
  attach(ctx: AudioContext, destination: AudioNode): void {
    if (this.ctx === ctx) return
    this.stop(0)
    this.ctx = ctx
    this.output = ctx.createGain()
    this.output.gain.value = 0
    this.output.connect(destination)
  }

  setVoice(voice: MusicVoice): void {
    this.voice = voice
  }

  /** Music volume, 0–1. */
  setVolume(volume: number): void {
    this.volume = volume
    if (this.output && this.ctx && this.pattern) {
      this.output.gain.setTargetAtTime(this.level(), this.ctx.currentTime, 0.05)
    }
  }

  get playing(): MusicPattern | null {
    return this.pattern
  }

  start(pattern: MusicPattern): void {
    if (!this.ctx || !this.output || !this.voice || this.pattern === pattern) return
    this.pattern = pattern
    this.step = 0
    this.nextTime = this.ctx.currentTime + 0.05
    this.output.gain.cancelScheduledValues(this.ctx.currentTime)
    this.output.gain.setTargetAtTime(this.level(), this.ctx.currentTime, 0.08)
    this.timer ??= setInterval(this.schedule, TICK_MS)
  }

  stop(fadeSeconds = 0.25): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
    this.pattern = null
    if (this.ctx && this.output) {
      this.output.gain.cancelScheduledValues(this.ctx.currentTime)
      this.output.gain.setTargetAtTime(0, this.ctx.currentTime, Math.max(0.01, fadeSeconds / 3))
    }
  }

  /** Music sits under the sound effects, so the full slider maps to a modest gain. */
  private level(): number {
    return this.volume * 0.45
  }

  private readonly schedule = (): void => {
    const { ctx, output, voice, pattern } = this
    if (!ctx || !output || !voice || !pattern) return
    // A background tab throttles timers; skip instead of scheduling a burst of late notes.
    if (document.hidden) {
      this.nextTime = ctx.currentTime + 0.1
      return
    }
    const tempo = pattern === 'draw' ? voice.drawTempo : voice.idleTempo
    const stepSeconds = 60 / tempo / 4
    while (this.nextTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
      if (pattern === 'draw') this.drawStep(ctx, output, voice, this.step, this.nextTime, stepSeconds)
      else this.idleStep(ctx, output, voice, this.step, this.nextTime, stepSeconds)
      this.nextTime += stepSeconds
      this.step = (this.step + 1) % STEPS
    }
  }

  /** Tense, driving loop: four-on-the-floor pulse, sixteenth-note arpeggio, off-beat hats. */
  private drawStep(ctx: AudioContext, out: AudioNode, voice: MusicVoice, step: number, at: number, length: number): void {
    const root = DRAW_ROOTS[Math.floor(step / 4)] ?? 57
    if (step % 4 === 0) {
      tone(ctx, out, { type: 'sine', freq: 130, freqEnd: 46, start: at, duration: 0.13, gain: 0.7, attack: 0.002 })
      tone(ctx, out, { type: voice.bass, freq: midi(root - 24), start: at, duration: length * 3.2, gain: 0.34, attack: 0.01 })
    }
    const interval = DRAW_ARPEGGIO[step % DRAW_ARPEGGIO.length] ?? 0
    tone(ctx, out, {
      type: voice.lead,
      freq: midi(root + interval),
      start: at,
      duration: length * 0.9,
      gain: 0.13,
      attack: 0.004,
      lowpass: { freq: voice.cutoff },
    })
    if (step % 2 === 1) {
      noise(ctx, out, { start: at, duration: 0.03, gain: 0.1, attack: 0.001, filter: { type: 'highpass', freq: 7000 } })
    }
  }

  /** Calm loop: a slow pad chord every two bars with a few bell notes on top. */
  private idleStep(ctx: AudioContext, out: AudioNode, voice: MusicVoice, step: number, at: number, length: number): void {
    const chord = IDLE_CHORDS[Math.floor(step / 16) % IDLE_CHORDS.length] ?? IDLE_CHORDS[0]
    if (step % 16 === 0) {
      for (const note of chord) {
        tone(ctx, out, {
          type: voice.bass,
          freq: midi(note - 12),
          start: at,
          duration: length * 15,
          gain: 0.1,
          attack: length * 3,
          lowpass: { freq: Math.min(voice.cutoff, 1400) },
        })
      }
    }
    if (step % 4 === 2) {
      const note = chord[(step / 2) % chord.length | 0] ?? 69
      tone(ctx, out, { type: 'sine', freq: midi(note + 12), start: at, duration: length * 3, gain: 0.09, attack: 0.01 })
    }
  }
}
