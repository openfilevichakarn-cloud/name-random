import { cryptoRng, type Rng } from './rng'

/**
 * Fisher–Yates (Durstenfeld) shuffle. Returns a new array; every permutation is equally likely.
 */
export function shuffle<T>(items: readonly T[], rng: Rng = cryptoRng): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(i + 1)
    const tmp = result[i] as T
    result[i] = result[j] as T
    result[j] = tmp
  }
  return result
}

/**
 * Draw `count` distinct items without replacement using a partial Fisher–Yates shuffle:
 * after k swap steps the first k positions hold a uniformly random k-subset in uniformly random order.
 * Asking for more items than exist returns all of them (shuffled).
 */
export function sample<T>(items: readonly T[], count: number, rng: Rng = cryptoRng): T[] {
  const pool = [...items]
  const k = Math.min(Math.max(0, Math.floor(count)), pool.length)
  for (let i = 0; i < k; i += 1) {
    const j = i + rng.nextInt(pool.length - i)
    const tmp = pool[i] as T
    pool[i] = pool[j] as T
    pool[j] = tmp
  }
  return pool.slice(0, k)
}

/** One uniformly random item (with replacement across calls). Throws on an empty list. */
export function pickOne<T>(items: readonly T[], rng: Rng = cryptoRng): T {
  if (items.length === 0) throw new RangeError('Cannot pick from an empty list')
  return items[rng.nextInt(items.length)] as T
}
