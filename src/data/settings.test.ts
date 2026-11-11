import { describe, expect, it } from 'vitest'

import { createDefaultSettings, LIMITS, sanitizeSettings } from './settings'

describe('sanitizeSettings', () => {
  it('returns the defaults for missing or non-object input', () => {
    const defaults = createDefaultSettings()
    expect(sanitizeSettings(undefined)).toEqual(defaults)
    expect(sanitizeSettings(null)).toEqual(defaults)
    expect(sanitizeSettings('nope')).toEqual(defaults)
    expect(sanitizeSettings([1, 2, 3])).toEqual(defaults)
  })

  it('keeps valid values and fills in missing keys', () => {
    const result = sanitizeSettings({
      appearance: { accent: 'pink' },
      sound: { master: 0.25, theme: 'arcade' },
    })
    expect(result.appearance.accent).toBe('pink')
    expect(result.appearance.scale).toBe('md')
    expect(result.sound.master).toBe(0.25)
    expect(result.sound.theme).toBe('arcade')
    expect(result.rules.repeatPolicy).toBe('no-repeat')
  })

  it('rejects unknown enum values and wrong types', () => {
    const result = sanitizeSettings({
      animation: { level: 'ultra', confetti: 'yes', countdownSeconds: 4 },
      general: { defaultMode: 'bingo', teacherName: 42 },
    })
    const defaults = createDefaultSettings()
    expect(result.animation.level).toBe(defaults.animation.level)
    expect(result.animation.confetti).toBe(defaults.animation.confetti)
    expect(result.animation.countdownSeconds).toBe(5)
    expect(result.general.defaultMode).toBe('wheel')
    expect(result.general.teacherName).toBe('')
  })

  it('clamps numbers into their allowed ranges', () => {
    const result = sanitizeSettings({
      sound: { master: 7, sfx: -3, music: Number.NaN },
      rules: { multipleCount: 999, teamCount: 0, teamSize: 2.6 },
    })
    expect(result.sound.master).toBe(1)
    expect(result.sound.sfx).toBe(0)
    expect(result.sound.music).toBe(createDefaultSettings().sound.music)
    expect(result.rules.multipleCount).toBe(LIMITS.multipleCount.max)
    expect(result.rules.teamCount).toBe(LIMITS.teamCount.min)
    expect(result.rules.teamSize).toBe(3)
  })

  it('keeps the number range ordered and within the maximum span', () => {
    const swapped = sanitizeSettings({ rules: { numberMin: 30, numberMax: 10 } })
    expect(swapped.rules.numberMin).toBe(30)
    expect(swapped.rules.numberMax).toBe(30)

    const huge = sanitizeSettings({ rules: { numberMin: 1, numberMax: 9999 } })
    expect(huge.rules.numberMax - huge.rules.numberMin + 1).toBe(LIMITS.numberSpan)
  })

  it('cleans free-text lists', () => {
    const result = sanitizeSettings({
      features: { challenges: ['  ร้องเพลง  ', '', 5, 'x'.repeat(500)] },
    })
    expect(result.features.challenges).toHaveLength(2)
    expect(result.features.challenges[0]).toBe('ร้องเพลง')
    expect(result.features.challenges[1]).toHaveLength(LIMITS.listItemLength)
  })

  it('removes duplicate list items, ignoring case and spacing', () => {
    const result = sanitizeSettings({
      features: { rewards: ['Sticker', 'sticker ', 'ได้  ดาว', 'ได้ ดาว', 'อื่น ๆ'] },
    })
    expect(result.features.rewards).toEqual(['Sticker', 'ได้ ดาว', 'อื่น ๆ'])
  })

  it('caps list length', () => {
    const many = Array.from({ length: LIMITS.listItems + 10 }, (_, index) => `ภารกิจ ${index}`)
    expect(sanitizeSettings({ features: { challenges: many } }).features.challenges).toHaveLength(LIMITS.listItems)
  })

  it('keeps an emptied list empty instead of restoring the presets', () => {
    expect(sanitizeSettings({ features: { challenges: [] } }).features.challenges).toEqual([])
    expect(sanitizeSettings({}).features.challenges.length).toBeGreaterThan(0)
  })

  it('validates the quiz timer and the reward chance', () => {
    const result = sanitizeSettings({ features: { answerTimer: 17, rewardChance: 0.333_33 } })
    expect(result.features.answerTimer).toBe(30)
    expect(result.features.rewardChance).toBe(0.33)
    expect(sanitizeSettings({ features: { answerTimer: 60, rewardChance: 7 } }).features).toMatchObject({
      answerTimer: 60,
      rewardChance: 1,
    })
  })

  it('drops unknown keys', () => {
    const result = sanitizeSettings({ appearance: { accent: 'cyan', evil: true }, extra: 1 })
    expect(result.appearance).not.toHaveProperty('evil')
    expect(result).not.toHaveProperty('extra')
  })
})
