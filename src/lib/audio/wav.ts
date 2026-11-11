/**
 * Encode PCM audio as a 16-bit WAV file.
 * `channels` holds one Float32Array per channel with samples in [-1, 1].
 */
export function encodeWav(channels: readonly Float32Array[], sampleRate: number): ArrayBuffer {
  const channelCount = channels.length
  if (channelCount === 0) throw new RangeError('encodeWav needs at least one channel')
  const frames = channels[0]?.length ?? 0
  const bytesPerSample = 2
  const blockAlign = channelCount * bytesPerSample
  const dataSize = frames * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
  }

  writeText(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, channelCount, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true) // byte rate
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bytesPerSample * 8, true)
  writeText(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel]?.[frame] ?? 0))
      // Asymmetric scaling keeps -1 and +1 inside the int16 range.
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += bytesPerSample
    }
  }
  return buffer
}

/** Largest absolute sample value (0 for silence). */
export function peakLevel(samples: Float32Array): number {
  let peak = 0
  for (const sample of samples) {
    const value = Math.abs(sample)
    if (value > peak) peak = value
  }
  return peak
}

/** Scale samples in place so the loudest one sits at `target` (never amplifies silence). */
export function normalize(samples: Float32Array, target = 0.9): Float32Array {
  const peak = peakLevel(samples)
  if (peak < 1e-5) return samples
  const gain = target / peak
  for (let i = 0; i < samples.length; i += 1) samples[i] = (samples[i] as number) * gain
  return samples
}
