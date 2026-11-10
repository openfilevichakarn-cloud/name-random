import { describe, expect, it } from 'vitest'

import { addDays, fileTimestamp, formatRelative, fromDateKey, startOfDay, toDateKey } from './date'
import { safeFileName } from './download'
import { createId, createToken, isUuid } from './id'
import { decodeText, escapeFormula } from './spreadsheet'
import { clamp } from './utils'

describe('id', () => {
  it('creates distinct RFC 4122 v4 UUIDs', () => {
    const ids = new Set(Array.from({ length: 500 }, () => createId()))
    expect(ids.size).toBe(500)
    for (const id of ids) expect(isUuid(id)).toBe(true)
  })

  it('falls back to getRandomValues when randomUUID is unavailable (insecure context)', () => {
    const original = crypto.randomUUID
    try {
      Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
      const id = createId()
      expect(isUuid(id)).toBe(true)
      expect(id[14]).toBe('4')
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true })
    }
  })

  it('creates hex tokens of the requested length', () => {
    expect(createToken(8)).toMatch(/^[0-9a-f]{8}$/)
    expect(createToken(5)).toMatch(/^[0-9a-f]{5}$/)
  })

  it('recognises UUIDs', () => {
    expect(isUuid('not-a-uuid')).toBe(false)
    expect(isUuid(null)).toBe(false)
  })
})

describe('date', () => {
  it('round-trips local date keys', () => {
    const date = new Date(2026, 10, 9, 15, 30)
    expect(toDateKey(date)).toBe('2026-11-09')
    expect(fromDateKey('2026-11-09')?.getTime()).toBe(startOfDay(date).getTime())
    expect(fromDateKey('09/11/2026')).toBeNull()
  })

  it('adds days across month boundaries', () => {
    expect(toDateKey(addDays(new Date(2026, 0, 31), 1))).toBe('2026-02-01')
    expect(toDateKey(addDays(new Date(2026, 2, 1), -1))).toBe('2026-02-28')
  })

  it('describes recent times relatively', () => {
    const now = new Date(2026, 10, 9, 12, 0, 0)
    expect(formatRelative(new Date(now.getTime() - 10_000), now)).toBe('เมื่อสักครู่')
    expect(formatRelative(new Date(now.getTime() - 5 * 60_000), now)).toContain('5')
    expect(formatRelative(new Date(now.getTime() - 3 * 3_600_000), now)).toContain('3')
  })

  it('builds file-name-safe timestamps', () => {
    expect(fileTimestamp(new Date(2026, 10, 9, 8, 5))).toBe('2026-11-09_0805')
  })
})

describe('spreadsheet helpers', () => {
  it('decodes UTF-8 with and without a BOM', () => {
    const text = 'เลขที่,ชื่อ'
    const plain = new TextEncoder().encode(text)
    expect(decodeText(plain.buffer as ArrayBuffer)).toBe(text)
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...plain])
    expect(decodeText(withBom.buffer as ArrayBuffer)).toBe(text)
  })

  it('falls back to Windows-874 for legacy Thai CSV files', () => {
    // "ชื่อ" in TIS-620 / Windows-874
    const legacy = new Uint8Array([0xaa, 0xd7, 0xe8, 0xcd])
    expect(decodeText(legacy.buffer as ArrayBuffer)).toBe('ชื่อ')
  })

  it('neutralises formula injection in text cells only', () => {
    expect(escapeFormula('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)")
    expect(escapeFormula('+66812345678')).toBe("'+66812345678")
    expect(escapeFormula('@cmd')).toBe("'@cmd")
    expect(escapeFormula('มานี')).toBe('มานี')
    expect(escapeFormula(-5)).toBe(-5)
  })
})

describe('misc', () => {
  it('sanitises file names', () => {
    expect(safeFileName('รายชื่อ ป.5/1: ห้อง "A"')).toBe('รายชื่อ ป.5-1- ห้อง -A-')
    expect(safeFileName('   ')).toBe('export')
    expect(safeFileName('name...')).toBe('name')
  })

  it('clamps numbers', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-1, 0, 3)).toBe(0)
    expect(clamp(2, 0, 3)).toBe(2)
  })
})
