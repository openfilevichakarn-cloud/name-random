/** Source of uniform random integers. Everything in the engine draws through this interface. */
export interface Rng {
  /** Uniform integer in the half-open range [0, maxExclusive). */
  nextInt(maxExclusive: number): number
}

const UINT32_RANGE = 0x1_0000_0000

function assertValidBound(maxExclusive: number): void {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > UINT32_RANGE) {
    throw new RangeError(`nextInt bound must be an integer between 1 and 2^32, got ${maxExclusive}`)
  }
}

/** Fills the given array with cryptographically strong random values. */
export type EntropySource = (buffer: Uint32Array<ArrayBuffer>) => void

/**
 * Random integers from `crypto.getRandomValues()`.
 *
 * A plain `value % n` favours small results whenever 2^32 is not a multiple of n.
 * Rejection sampling removes that bias: values that fall in the incomplete last bucket are
 * thrown away and redrawn, so every result in [0, n) is exactly equally likely.
 */
export function createCryptoRng(source: EntropySource = (buffer) => crypto.getRandomValues(buffer)): Rng {
  const buffer = new Uint32Array(1)
  return {
    nextInt(maxExclusive) {
      assertValidBound(maxExclusive)
      if (maxExclusive === 1) return 0
      const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive)
      for (;;) {
        source(buffer)
        const value = buffer[0] as number
        if (value < limit) return value % maxExclusive
      }
    },
  }
}

/** The RNG used for every real draw. */
export const cryptoRng: Rng = createCryptoRng()

/**
 * Deterministic RNG (mulberry32) — for tests and reproducible demos only.
 * Never use it to decide a real draw.
 */
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (t ^ (t >>> 14)) >>> 0
  }
  return createCryptoRng((buffer) => {
    buffer[0] = next()
  })
}
