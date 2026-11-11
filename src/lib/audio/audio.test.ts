import { describe, expect, it, vi } from 'vitest'

import { SOUND_THEMES as THEME_IDS } from '@/data/settings'

import { playSfx, setSfxPlayer, SFX_EVENTS } from './sfx'
import { midi } from './synth'
import { listRecipes, SOUND_THEMES } from './themes'
import { encodeWav, normalize, peakLevel } from './wav'

function ascii(view: DataView, offset: number, length: number): string {
  return Array.from({ length }, (_unused, index) => String.fromCharCode(view.getUint8(offset + index))).join('')
}

describe('encodeWav', () => {
  it('writes a valid 16-bit PCM mono header', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1])
    const view = new DataView(encodeWav([samples], 44_100))

    expect(view.byteLength).toBe(44 + samples.length * 2)
    expect(ascii(view, 0, 4)).toBe('RIFF')
    expect(view.getUint32(4, true)).toBe(36 + samples.length * 2)
    expect(ascii(view, 8, 4)).toBe('WAVE')
    expect(ascii(view, 12, 4)).toBe('fmt ')
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // channels
    expect(view.getUint32(24, true)).toBe(44_100)
    expect(view.getUint32(28, true)).toBe(44_100 * 2) // byte rate
    expect(view.getUint16(32, true)).toBe(2) // block align
    expect(view.getUint16(34, true)).toBe(16) // bits per sample
    expect(ascii(view, 36, 4)).toBe('data')
    expect(view.getUint32(40, true)).toBe(samples.length * 2)
  })

  it('scales samples to int16 and clips out-of-range values', () => {
    const view = new DataView(encodeWav([new Float32Array([0, 1, -1, 2, -2, 0.5])], 8000))
    const read = (index: number) => view.getInt16(44 + index * 2, true)
    expect(read(0)).toBe(0)
    expect(read(1)).toBe(32_767)
    expect(read(2)).toBe(-32_768)
    expect(read(3)).toBe(32_767)
    expect(read(4)).toBe(-32_768)
    expect(read(5)).toBe(16_383)
  })

  it('interleaves stereo channels', () => {
    const view = new DataView(encodeWav([new Float32Array([1, 0]), new Float32Array([-1, 0])], 8000))
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getInt16(44, true)).toBe(32_767)
    expect(view.getInt16(46, true)).toBe(-32_768)
  })

  it('rejects an empty channel list', () => {
    expect(() => encodeWav([], 8000)).toThrow(RangeError)
  })
})

describe('normalize', () => {
  it('scales the loudest sample to the target and leaves silence alone', () => {
    const samples = normalize(new Float32Array([0.1, -0.2, 0.05]), 0.8)
    expect(peakLevel(samples)).toBeCloseTo(0.8, 5)
    expect(samples[0]).toBeCloseTo(0.4, 5)

    const silence = normalize(new Float32Array(4), 0.9)
    expect(Array.from(silence)).toEqual([0, 0, 0, 0])
  })
})

describe('sound themes', () => {
  it('defines every theme listed in the settings', () => {
    expect(Object.keys(SOUND_THEMES).sort()).toEqual([...THEME_IDS].sort())
  })

  it.each(THEME_IDS)('%s defines all ten sound events with sane parameters', (themeId) => {
    const recipes = listRecipes(SOUND_THEMES[themeId])
    expect(recipes.map(([event]) => event)).toEqual([...SFX_EVENTS])
    for (const [, recipe] of recipes) {
      expect(recipe.duration).toBeGreaterThan(0)
      expect(recipe.duration).toBeLessThanOrEqual(2)
      expect(recipe.level).toBeGreaterThan(0)
      expect(recipe.level).toBeLessThanOrEqual(1)
      expect(typeof recipe.build).toBe('function')
    }
  })

  it('keeps hover the quietest and the reveal the loudest effect', () => {
    for (const themeId of THEME_IDS) {
      const { sounds } = SOUND_THEMES[themeId]
      const levels = SFX_EVENTS.map((event) => sounds[event].level)
      expect(sounds.hover.level).toBe(Math.min(...levels))
      expect(sounds.reveal.level).toBe(Math.max(...levels))
    }
  })
})

describe('midi', () => {
  it('converts note numbers to equal-tempered frequencies', () => {
    expect(midi(69)).toBe(440)
    expect(midi(81)).toBeCloseTo(880, 6)
    expect(midi(60)).toBeCloseTo(261.626, 2)
  })
})

describe('playSfx facade', () => {
  it('is silent until a player is registered and forwards calls afterwards', () => {
    expect(() => playSfx('click')).not.toThrow()

    const player = vi.fn()
    setSfxPlayer(player)
    playSfx('tick', { volume: 0.5 })
    expect(player).toHaveBeenCalledWith('tick', { volume: 0.5 })

    setSfxPlayer(null)
    playSfx('tick')
    expect(player).toHaveBeenCalledTimes(1)
  })
})
