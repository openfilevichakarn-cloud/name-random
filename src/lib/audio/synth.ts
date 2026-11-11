/**
 * Small subtractive-synth toolkit on top of the Web Audio API.
 * Every sound in the app is built from these two voices, so no audio files are shipped.
 * The functions work on any BaseAudioContext: an OfflineAudioContext to render sound effects
 * ahead of time, or the live AudioContext for the music sequencer.
 */

const SILENCE = 0.0001

export interface ToneOptions {
  type: OscillatorType
  /** Frequency in Hz at the start of the note. */
  freq: number
  /** Glide to this frequency over the note (exponential). */
  freqEnd?: number
  /** Start time in seconds on the context's clock. */
  start: number
  duration: number
  /** Peak gain, 0–1. */
  gain: number
  /** Seconds to reach the peak. */
  attack?: number
  /** Cents of detune (for a second, slightly off voice). */
  detune?: number
  /** Amplitude tremolo. */
  tremolo?: { rate: number; depth: number }
  /** Low-pass the voice, optionally sweeping the cutoff. */
  lowpass?: { freq: number; freqEnd?: number; q?: number }
}

/** One enveloped oscillator note. */
export function tone(ctx: BaseAudioContext, destination: AudioNode, options: ToneOptions): void {
  const { type, freq, freqEnd, start, duration, gain, attack = 0.005, detune = 0, tremolo, lowpass } = options
  const end = start + duration
  const oscillator = ctx.createOscillator()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(freq, start)
  if (freqEnd !== undefined) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), end)
  oscillator.detune.value = detune

  const envelope = ctx.createGain()
  envelope.gain.setValueAtTime(SILENCE, start)
  envelope.gain.linearRampToValueAtTime(gain, start + Math.min(attack, duration / 2))
  envelope.gain.exponentialRampToValueAtTime(SILENCE, end)

  let tail: AudioNode = oscillator
  if (lowpass) {
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = lowpass.q ?? 1
    filter.frequency.setValueAtTime(lowpass.freq, start)
    if (lowpass.freqEnd !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(20, lowpass.freqEnd), end)
    tail.connect(filter)
    tail = filter
  }
  tail.connect(envelope)

  if (tremolo) {
    const lfo = ctx.createOscillator()
    const depth = ctx.createGain()
    const wobble = ctx.createGain()
    lfo.frequency.value = tremolo.rate
    depth.gain.value = tremolo.depth
    wobble.gain.value = 1 - tremolo.depth
    lfo.connect(depth)
    depth.connect(wobble.gain)
    envelope.connect(wobble)
    wobble.connect(destination)
    lfo.start(start)
    lfo.stop(end + 0.02)
  } else {
    envelope.connect(destination)
  }

  oscillator.start(start)
  oscillator.stop(end + 0.02)
}

export interface NoiseOptions {
  start: number
  duration: number
  gain: number
  attack?: number
  filter: { type: BiquadFilterType; freq: number; freqEnd?: number; q?: number }
}

/**
 * Deterministic white noise: the same samples on every render, so a sound effect always
 * comes out identical (no `Math.random`).
 */
function fillNoise(samples: Float32Array): void {
  let state = 0x2545f491
  for (let i = 0; i < samples.length; i += 1) {
    // xorshift32
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    samples[i] = ((state >>> 0) / 0x8000_0000 - 1) * 0.9
  }
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>()

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buffer = noiseCache.get(ctx)
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 1.5), ctx.sampleRate)
    fillNoise(buffer.getChannelData(0))
    noiseCache.set(ctx, buffer)
  }
  return buffer
}

/** One enveloped, filtered burst of noise (whooshes, hats, impacts). */
export function noise(ctx: BaseAudioContext, destination: AudioNode, options: NoiseOptions): void {
  const { start, duration, gain, attack = 0.004, filter } = options
  const end = start + duration
  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer(ctx)
  source.loop = true

  const biquad = ctx.createBiquadFilter()
  biquad.type = filter.type
  biquad.Q.value = filter.q ?? 0.8
  biquad.frequency.setValueAtTime(filter.freq, start)
  if (filter.freqEnd !== undefined) biquad.frequency.exponentialRampToValueAtTime(Math.max(20, filter.freqEnd), end)

  const envelope = ctx.createGain()
  envelope.gain.setValueAtTime(SILENCE, start)
  envelope.gain.linearRampToValueAtTime(gain, start + Math.min(attack, duration / 2))
  envelope.gain.exponentialRampToValueAtTime(SILENCE, end)

  source.connect(biquad)
  biquad.connect(envelope)
  envelope.connect(destination)
  source.start(start)
  source.stop(end + 0.02)
}

/** Equal-tempered pitch: MIDI note number → Hz (69 = A4 = 440 Hz). */
export function midi(note: number): number {
  return 440 * 2 ** ((note - 69) / 12)
}
