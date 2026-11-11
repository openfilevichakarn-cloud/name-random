import type { SoundThemeId } from '@/data/settings'

import { SFX_EVENTS, type SfxEvent } from './sfx'
import { midi, noise, tone } from './synth'

/** How to synthesise one sound effect. */
export interface SoundRecipe {
  /** Length in seconds (the rendered buffer adds a short tail). */
  duration: number
  /** Playback gain relative to the other effects of the theme, 0–1. */
  level: number
  /** Schedule the voices on `ctx`, starting at time `at`. */
  build: (ctx: BaseAudioContext, out: AudioNode, at: number) => void
}

/** Parameters of the generative music loops. */
export interface MusicVoice {
  lead: OscillatorType
  bass: OscillatorType
  /** Cut-off of the lead's low-pass filter in Hz. */
  cutoff: number
  /** Beats per minute while a draw is running / while idle. */
  drawTempo: number
  idleTempo: number
}

export interface SoundTheme {
  id: SoundThemeId
  label: string
  description: string
  sounds: Record<SfxEvent, SoundRecipe>
  music: MusicVoice
}

/** The knobs that distinguish one theme from another. All recipes are shared. */
interface Timbre {
  /** Melodic voice (fanfare, risers). */
  lead: OscillatorType
  /** Short interface blips. */
  blip: OscillatorType
  attack: number
  /** Low-pass cut-off for the lead voice. */
  cutoff: number
  /** Overall loudness: square waves carry more energy than sines. */
  loudness: number
  /** How much noise (whoosh, hats, impact) is mixed in. */
  grit: number
  click: readonly [from: number, to: number]
  tick: number
  /** Fanfare notes as MIDI numbers, low to high. */
  fanfare: readonly number[]
}

function createSounds(t: Timbre): Record<SfxEvent, SoundRecipe> {
  const lead = (ctx: BaseAudioContext, out: AudioNode, options: Parameters<typeof tone>[2]) =>
    tone(ctx, out, { attack: t.attack, lowpass: { freq: t.cutoff }, ...options })

  return {
    click: {
      duration: 0.08,
      level: 0.55,
      build: (ctx, out, at) => {
        tone(ctx, out, { type: t.blip, freq: t.click[0], freqEnd: t.click[1], start: at, duration: 0.07, gain: 0.6 * t.loudness, attack: t.attack })
      },
    },
    hover: {
      duration: 0.04,
      level: 0.22,
      build: (ctx, out, at) => {
        tone(ctx, out, { type: t.blip, freq: t.click[1] * 1.5, start: at, duration: 0.035, gain: 0.4 * t.loudness, attack: t.attack })
      },
    },
    spin: {
      duration: 0.62,
      level: 0.7,
      build: (ctx, out, at) => {
        noise(ctx, out, { start: at, duration: 0.58, gain: 0.55 * t.grit, attack: 0.08, filter: { type: 'bandpass', freq: 380, freqEnd: 3000, q: 1.2 } })
        lead(ctx, out, { type: t.lead, freq: 170, freqEnd: 560, start: at, duration: 0.5, gain: 0.3 * t.loudness, attack: 0.06 })
      },
    },
    tick: {
      duration: 0.04,
      level: 0.5,
      build: (ctx, out, at) => {
        tone(ctx, out, { type: t.blip, freq: t.tick, freqEnd: t.tick * 0.7, start: at, duration: 0.032, gain: 0.6 * t.loudness, attack: 0.001 })
        noise(ctx, out, { start: at, duration: 0.014, gain: 0.3 * t.grit, attack: 0.001, filter: { type: 'highpass', freq: 3200 } })
      },
    },
    suspense: {
      duration: 1.5,
      level: 0.6,
      build: (ctx, out, at) => {
        tone(ctx, out, {
          type: t.lead,
          freq: 110,
          freqEnd: 330,
          start: at,
          duration: 1.45,
          gain: 0.38 * t.loudness,
          attack: 0.2,
          tremolo: { rate: 11, depth: 0.42 },
          lowpass: { freq: 500, freqEnd: Math.max(900, t.cutoff), q: 2 },
        })
        noise(ctx, out, { start: at, duration: 1.45, gain: 0.16 * t.grit, attack: 1.1, filter: { type: 'bandpass', freq: 700, freqEnd: 4200, q: 1.5 } })
      },
    },
    countdown: {
      duration: 0.18,
      level: 0.6,
      build: (ctx, out, at) => {
        tone(ctx, out, { type: t.blip, freq: 880, start: at, duration: 0.16, gain: 0.55 * t.loudness, attack: t.attack })
        tone(ctx, out, { type: 'sine', freq: 1760, start: at, duration: 0.12, gain: 0.14, attack: t.attack })
      },
    },
    reveal: {
      duration: 0.55,
      level: 0.85,
      build: (ctx, out, at) => {
        // Sub drop for the "impact", a noise burst for air, a bright sweep on top.
        tone(ctx, out, { type: 'sine', freq: 210, freqEnd: 46, start: at, duration: 0.5, gain: 0.85, attack: 0.004 })
        noise(ctx, out, { start: at, duration: 0.32, gain: 0.5 * t.grit, attack: 0.002, filter: { type: 'lowpass', freq: 3200, freqEnd: 260 } })
        lead(ctx, out, { type: t.lead, freq: 620, freqEnd: 1240, start: at, duration: 0.28, gain: 0.22 * t.loudness })
      },
    },
    winner: {
      duration: 1.7,
      level: 0.8,
      build: (ctx, out, at) => {
        const step = 0.13
        t.fanfare.forEach((note, index) => {
          const start = at + index * step
          lead(ctx, out, { type: t.lead, freq: midi(note), start, duration: 0.26, gain: 0.34 * t.loudness })
          tone(ctx, out, { type: 'sine', freq: midi(note + 12), start, duration: 0.2, gain: 0.1, attack: t.attack })
        })
        // Hold the full chord at the top.
        const hold = at + t.fanfare.length * step
        for (const note of t.fanfare) {
          lead(ctx, out, { type: t.lead, freq: midi(note), start: hold, duration: 0.95, gain: 0.2 * t.loudness, attack: 0.02 })
        }
        tone(ctx, out, { type: 'sine', freq: midi((t.fanfare[0] ?? 60) - 24), start: hold, duration: 0.9, gain: 0.3, attack: 0.01 })
      },
    },
    confetti: {
      duration: 0.55,
      level: 0.5,
      build: (ctx, out, at) => {
        const sparkles = [96, 91, 100, 88, 95, 103, 98] as const
        sparkles.forEach((note, index) => {
          tone(ctx, out, { type: 'sine', freq: midi(note), start: at + index * 0.055, duration: 0.14, gain: 0.3, attack: 0.002 })
        })
        noise(ctx, out, { start: at, duration: 0.4, gain: 0.14 * t.grit, attack: 0.01, filter: { type: 'highpass', freq: 6500 } })
      },
    },
    error: {
      duration: 0.42,
      level: 0.6,
      build: (ctx, out, at) => {
        lead(ctx, out, { type: t.lead, freq: 196, freqEnd: 160, start: at, duration: 0.16, gain: 0.45 * t.loudness })
        lead(ctx, out, { type: t.lead, freq: 147, freqEnd: 104, start: at + 0.17, duration: 0.23, gain: 0.45 * t.loudness })
      },
    },
  }
}

export const SOUND_THEMES: Record<SoundThemeId, SoundTheme> = {
  neon: {
    id: 'neon',
    label: 'Neon',
    description: 'ซินธ์นุ่มลึกแบบเกมยุคใหม่',
    sounds: createSounds({
      lead: 'sawtooth',
      blip: 'sine',
      attack: 0.004,
      cutoff: 2600,
      loudness: 1,
      grit: 1,
      click: [720, 1080],
      tick: 1500,
      fanfare: [72, 76, 79, 84],
    }),
    music: { lead: 'sawtooth', bass: 'triangle', cutoff: 1800, drawTempo: 132, idleTempo: 84 },
  },
  arcade: {
    id: 'arcade',
    label: 'Arcade',
    description: 'เสียง 8-bit แบบตู้เกม',
    sounds: createSounds({
      lead: 'square',
      blip: 'square',
      attack: 0.001,
      cutoff: 6000,
      loudness: 0.55,
      grit: 0.55,
      click: [880, 880],
      tick: 1100,
      fanfare: [67, 72, 76, 79, 84],
    }),
    music: { lead: 'square', bass: 'square', cutoff: 5000, drawTempo: 144, idleTempo: 96 },
  },
  soft: {
    id: 'soft',
    label: 'Soft',
    description: 'นุ่มนวล ไม่รบกวน เหมาะกับห้องเรียน',
    sounds: createSounds({
      lead: 'triangle',
      blip: 'sine',
      attack: 0.018,
      cutoff: 1700,
      loudness: 0.8,
      grit: 0.3,
      click: [520, 620],
      tick: 760,
      fanfare: [72, 76, 79, 84],
    }),
    music: { lead: 'triangle', bass: 'sine', cutoff: 1200, drawTempo: 116, idleTempo: 72 },
  },
}

/** Every theme must define every event — checked by the unit tests. */
export function listRecipes(theme: SoundTheme): [SfxEvent, SoundRecipe][] {
  return SFX_EVENTS.map((event) => [event, theme.sounds[event]])
}
