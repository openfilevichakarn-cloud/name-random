import { describe, expect, it } from 'vitest'

import type { Student } from '@/data/types'

import { encodeAvatar, getBotTraits, isValidAvatar, parseAvatar, randomBotAvatar } from './avatar'
import { compareStudents, getDisplayName, getFullName, matchesStudent, nextFreeNumber } from './names'
import { cleanText, compareText, foldText, graphemeLength } from './text'

function student(partial: Partial<Student>): Student {
  return {
    id: 's',
    schoolId: null,
    classroomId: 'c1',
    studentCode: '',
    number: 1,
    firstName: 'กิตติพงษ์',
    lastName: 'ใจดี',
    nickname: 'กิต',
    avatar: '',
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

describe('text helpers', () => {
  it('cleans whitespace and invisible characters', () => {
    expect(cleanText('  ก​ข \t ค﻿ ')).toBe('กข ค')
    expect(cleanText(null)).toBe('')
    expect(cleanText(42)).toBe('42')
  })

  it('folds case for comparisons', () => {
    expect(foldText('  ABC  ')).toBe('abc')
  })

  it('sorts numbers inside text naturally', () => {
    expect(['ป.5/10', 'ป.5/2', 'ป.5/1'].sort(compareText)).toEqual(['ป.5/1', 'ป.5/2', 'ป.5/10'])
  })

  it('counts graphemes, not code units', () => {
    // Each consonant carries its vowel and tone mark: 6 code units, 2 user-perceived characters.
    expect('ที่นี่'.length).toBe(6)
    expect(graphemeLength('ที่นี่')).toBe(2)
    expect(graphemeLength('abc')).toBe(3)
  })
})

describe('names', () => {
  it('builds the full name without stray spaces', () => {
    expect(getFullName(student({}))).toBe('กิตติพงษ์ ใจดี')
    expect(getFullName(student({ lastName: '' }))).toBe('กิตติพงษ์')
  })

  it('formats the display name per setting, falling back when there is no nickname', () => {
    expect(getDisplayName(student({}), 'nickname')).toBe('กิต')
    expect(getDisplayName(student({ nickname: '' }), 'nickname')).toBe('กิตติพงษ์')
    expect(getDisplayName(student({}), 'first')).toBe('กิตติพงษ์')
    expect(getDisplayName(student({}), 'full')).toBe('กิตติพงษ์ ใจดี')
  })

  it('searches number, code and every name', () => {
    const target = student({ number: 12, studentCode: 'A-77' })
    expect(matchesStudent(target, '')).toBe(true)
    expect(matchesStudent(target, '12')).toBe(true)
    expect(matchesStudent(target, 'a-77')).toBe(true)
    expect(matchesStudent(target, 'ใจดี')).toBe(true)
    expect(matchesStudent(target, 'พงษ์ ใจ')).toBe(true)
    expect(matchesStudent(target, 'กิต')).toBe(true)
    expect(matchesStudent(target, 'ไม่มี')).toBe(false)
  })

  it('sorts students by each key', () => {
    const a = student({ id: 'a', number: 2, firstName: 'ข', nickname: '', studentCode: '9' })
    const b = student({ id: 'b', number: 1, firstName: 'ค', nickname: 'ก', studentCode: '' })
    const c = student({ id: 'c', number: 3, firstName: 'ก', nickname: 'ข', studentCode: '10' })
    const ids = (key: Parameters<typeof compareStudents>[2]) =>
      [a, b, c].sort((x, y) => compareStudents(x, y, key)).map((s) => s.id)
    expect(ids('number')).toEqual(['b', 'a', 'c'])
    expect(ids('name')).toEqual(['c', 'a', 'b'])
    expect(ids('nickname')).toEqual(['b', 'c', 'a'])
    expect(ids('studentCode')).toEqual(['a', 'c', 'b'])
  })

  it('finds the next free roll number', () => {
    expect(nextFreeNumber([])).toBe(1)
    expect(nextFreeNumber([1, 2, 4])).toBe(3)
    expect(nextFreeNumber([2, 3])).toBe(1)
  })
})

describe('avatar', () => {
  it('round-trips both avatar kinds', () => {
    expect(parseAvatar(encodeAvatar({ kind: 'bot', seed: 'abc123' }), 'x')).toEqual({ kind: 'bot', seed: 'abc123' })
    expect(parseAvatar(encodeAvatar({ kind: 'emoji', emoji: '🦊' }), 'x')).toEqual({ kind: 'emoji', emoji: '🦊' })
  })

  it('falls back to a bot built from the seed', () => {
    expect(parseAvatar('', 'student-1')).toEqual({ kind: 'bot', seed: 'student-1' })
    expect(parseAvatar('http://evil.example/x.png', 'student-1')).toEqual({ kind: 'bot', seed: 'student-1' })
    expect(parseAvatar(null, '')).toEqual({ kind: 'bot', seed: 'default' })
  })

  it('validates stored values', () => {
    expect(isValidAvatar('')).toBe(true)
    expect(isValidAvatar(randomBotAvatar())).toBe(true)
    expect(isValidAvatar('emoji:🐼')).toBe(true)
    expect(isValidAvatar('bot:')).toBe(false)
    expect(isValidAvatar('javascript:alert(1)')).toBe(false)
    expect(isValidAvatar(12)).toBe(false)
  })

  it('derives the same traits from the same seed', () => {
    expect(getBotTraits('seed-a')).toEqual(getBotTraits('seed-a'))
    const distinct = new Set(Array.from({ length: 40 }, (_unused, i) => JSON.stringify(getBotTraits(`seed-${i}`))))
    expect(distinct.size).toBeGreaterThan(30)
  })
})
