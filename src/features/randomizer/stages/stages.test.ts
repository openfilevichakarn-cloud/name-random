import { beforeEach, describe, expect, it } from 'vitest'

import { EMPTY_POOL, poolKey, useStudioStore } from '@/stores/studioStore'

import { getCardCapacity, layoutCards, MAX_CARDS } from './card/cardLayout'
import { stageColor } from './types'
import { getSpinTarget, normalizeAngle, segmentAtPointer } from './wheel/wheelGeometry'

describe('wheel geometry', () => {
  it('normalises angles into [0, 360)', () => {
    expect(normalizeAngle(370)).toBe(10)
    expect(normalizeAngle(-10)).toBe(350)
    expect(normalizeAngle(720)).toBe(0)
  })

  it('finds the segment under the pointer', () => {
    // 4 segments of 90°. Unrotated, the pointer sits at the start of segment 0.
    expect(segmentAtPointer(0, 4)).toBe(0)
    // Rotating the wheel clockwise brings the previous segment under the pointer.
    expect(segmentAtPointer(10, 4)).toBe(3)
    expect(segmentAtPointer(100, 4)).toBe(2)
    expect(segmentAtPointer(-100, 4)).toBe(1)
    expect(segmentAtPointer(0, 0)).toBe(-1)
  })

  it('computes a target that lands on the winner for any start angle and pool size', () => {
    for (const count of [1, 2, 3, 7, 24, 40, 150]) {
      for (const current of [0, 33.3, -725.5, 99_999.25]) {
        for (let winnerIndex = 0; winnerIndex < count; winnerIndex += Math.max(1, Math.floor(count / 6))) {
          for (const fraction of [0.16, 0.5, 0.84]) {
            const target = getSpinTarget({ current, count, winnerIndex, turns: 5, fraction })
            expect(segmentAtPointer(target, count)).toBe(winnerIndex)
            // Always spins forwards by at least the requested number of turns.
            expect(target - current).toBeGreaterThanOrEqual(5 * 360)
            expect(target - current).toBeLessThan(6 * 360)
          }
        }
      }
    }
  })
})

describe('card layout', () => {
  it('fits every card inside the box', () => {
    for (const [count, width, height] of [
      [15, 900, 560],
      [12, 360, 400],
      [3, 320, 300],
      [1, 800, 500],
    ] as const) {
      const layout = layoutCards(count, width, height)
      expect(layout.columns * layout.rows).toBeGreaterThanOrEqual(count)
      expect(layout.cardWidth).toBeGreaterThan(0)
      const totalWidth = layout.columns * layout.cardWidth + (layout.columns - 1) * 12
      const totalHeight = layout.rows * (layout.cardWidth / 0.72) + (layout.rows - 1) * 12
      expect(totalWidth).toBeLessThanOrEqual(width + 0.5)
      expect(totalHeight).toBeLessThanOrEqual(height + 0.5)
    }
  })

  it('returns a harmless layout for an unmeasured box', () => {
    expect(layoutCards(12, 0, 0).cardWidth).toBe(0)
    expect(layoutCards(0, 500, 500).cardWidth).toBe(0)
  })

  it('offers more cards on larger stages and never fewer than three', () => {
    const phone = getCardCapacity(360, 400)
    const desktop = getCardCapacity(900, 560)
    expect(phone).toBeGreaterThanOrEqual(3)
    expect(desktop).toBeGreaterThanOrEqual(phone)
    expect(desktop).toBeLessThanOrEqual(MAX_CARDS)
    expect(getCardCapacity(0, 0)).toBe(3)
  })
})

describe('stageColor', () => {
  it('never gives the two ends of a closed ring the same colour', () => {
    for (let count = 2; count <= 40; count += 1) {
      expect(stageColor(count - 1, count)).not.toBe(stageColor(0, count))
      for (let index = 1; index < count; index += 1) {
        expect(stageColor(index, count)).not.toBe(stageColor(index - 1, count))
      }
    }
  })
})

describe('studio store', () => {
  const key = poolKey('c1', 'students', 1, 40)

  beforeEach(() => {
    useStudioStore.getState().clearPools()
  })

  it('keys pools by classroom, source and number range', () => {
    expect(poolKey('c1', 'students', 1, 40)).toBe(poolKey('c1', 'students', 5, 9))
    expect(poolKey('c1', 'numbers', 1, 40)).not.toBe(poolKey('c1', 'numbers', 1, 30))
    expect(poolKey(null, 'numbers', 1, 40)).not.toBe(poolKey('c1', 'numbers', 1, 40))
  })

  it('tracks drawn candidates without duplicates and can put one back', () => {
    const studio = useStudioStore.getState()
    studio.markDrawn(key, ['a', 'b'])
    studio.markDrawn(key, ['b', 'c'])
    expect(useStudioStore.getState().pools[key]?.drawnIds).toEqual(['a', 'b', 'c'])
    studio.restoreDrawn(key, 'b')
    expect(useStudioStore.getState().pools[key]?.drawnIds).toEqual(['a', 'c'])
  })

  it('excludes with a reason, restores, and restricts the pool to a group', () => {
    const studio = useStudioStore.getState()
    studio.setExclusion(key, ['a'], 'manual')
    studio.setExclusion(key, ['b'], 'picked')
    expect(useStudioStore.getState().pools[key]?.excluded).toEqual({ a: 'manual', b: 'picked' })
    studio.setExclusion(key, ['a'], null)
    expect(useStudioStore.getState().pools[key]?.excluded).toEqual({ b: 'picked' })

    studio.restrictTo(key, ['a', 'b', 'c', 'd'], ['b', 'd'])
    expect(useStudioStore.getState().pools[key]?.excluded).toEqual({ a: 'manual', c: 'manual' })
  })

  it('counts draws and starts a new round without losing manual exclusions', () => {
    const studio = useStudioStore.getState()
    expect(studio.beginDraw(key)).toBe(1)
    expect(studio.beginDraw(key)).toBe(2)
    studio.markDrawn(key, ['a'])
    studio.setExclusion(key, ['z'], 'manual')
    studio.setSession(key, 'session-1')

    expect(studio.resetRound(key)).toBe('session-1')
    expect(useStudioStore.getState().pools[key]).toEqual({
      sessionId: null,
      drawCount: 0,
      drawnIds: [],
      excluded: { z: 'manual' },
    })
    expect(studio.resetRound(key)).toBeNull()
  })

  it('forgets a deleted classroom and detaches sessions when history is cleared', () => {
    const studio = useStudioStore.getState()
    const other = poolKey('c2', 'students', 1, 40)
    studio.setClassroom('c1')
    studio.markDrawn(key, ['a'])
    studio.setSession(key, 's1')
    studio.markDrawn(other, ['x'])
    studio.setSession(other, 's2')

    studio.detachSessions()
    expect(useStudioStore.getState().pools[other]).toMatchObject({ sessionId: null, drawnIds: ['x'] })

    studio.forgetClassroom('c1')
    const state = useStudioStore.getState()
    expect(state.classroomId).toBeNull()
    expect(state.pools[key]).toBeUndefined()
    expect(state.pools[other]).toBeDefined()
  })

  it('never mutates the shared empty pool', () => {
    useStudioStore.getState().markDrawn(key, ['a'])
    expect(EMPTY_POOL.drawnIds).toEqual([])
  })
})
