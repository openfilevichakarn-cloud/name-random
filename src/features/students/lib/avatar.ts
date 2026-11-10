import { createToken } from '@/lib/id'

/**
 * Avatars are generated, never uploaded: no photos of children are stored.
 * A student's avatar is a short string — `bot:<seed>` or `emoji:<emoji>`.
 */
export type AvatarSpec = { kind: 'bot'; seed: string } | { kind: 'emoji'; emoji: string }

export const AVATAR_EMOJIS = [
  '🦊', '🐼', '🐯', '🦁', '🐸', '🐵', '🐶', '🐱', '🐰', '🐻',
  '🐨', '🐷', '🐮', '🐔', '🐧', '🦄', '🐲', '🦖', '🐙', '🦋',
  '🐝', '🐢', '🐬', '🦈', '🦉', '🦅', '🚀', '🛸', '⚡', '🔥',
  '🌈', '⭐', '🌙', '🍀', '🌸', '🍎', '🍉', '🍩', '🎮', '🎧',
  '🎨', '⚽', '🏀', '🎸', '👾', '🤖', '👑', '💎', '🎯', '🧩',
] as const

const MAX_SEED_LENGTH = 40
const MAX_EMOJI_LENGTH = 16

export function encodeAvatar(spec: AvatarSpec): string {
  return spec.kind === 'bot' ? `bot:${spec.seed}` : `emoji:${spec.emoji}`
}

/** Decode a stored avatar. Anything unrecognised becomes a bot generated from `fallbackSeed`. */
export function parseAvatar(value: string | null | undefined, fallbackSeed: string): AvatarSpec {
  if (value) {
    if (value.startsWith('bot:')) {
      const seed = value.slice(4, 4 + MAX_SEED_LENGTH)
      if (seed) return { kind: 'bot', seed }
    } else if (value.startsWith('emoji:')) {
      const emoji = value.slice(6, 6 + MAX_EMOJI_LENGTH)
      if (emoji) return { kind: 'emoji', emoji }
    }
  }
  return { kind: 'bot', seed: fallbackSeed || 'default' }
}

/** True when `value` is a well-formed avatar string. */
export function isValidAvatar(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (value === '') return true
  if (value.startsWith('bot:')) return value.length > 4 && value.length <= 4 + MAX_SEED_LENGTH
  if (value.startsWith('emoji:')) return value.length > 6 && value.length <= 6 + MAX_EMOJI_LENGTH
  return false
}

export function randomBotAvatar(): string {
  return encodeAvatar({ kind: 'bot', seed: createToken(8) })
}

// ---------------------------------------------------------------------------
// Deterministic bot traits
// ---------------------------------------------------------------------------

/** FNV-1a 32-bit hash. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** mulberry32 — small deterministic PRNG. Cosmetic use only, never for draw results. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

export const AVATAR_BACKGROUNDS: readonly (readonly [string, string])[] = [
  ['#8B5CF6', '#4338CA'],
  ['#22D3EE', '#2563EB'],
  ['#EC4899', '#7C3AED'],
  ['#A3E635', '#0D9488'],
  ['#FBBF24', '#EA580C'],
  ['#F472B6', '#F97316'],
  ['#22D3EE', '#8B5CF6'],
  ['#6366F1', '#EC4899'],
]

const HEAD_COLORS = ['#F8FAFC', '#E0E7FF', '#CFFAFE', '#FCE7F3', '#ECFCCB', '#FEF3C7'] as const
const LED_COLORS = ['#22D3EE', '#A3E635', '#FBBF24', '#F472B6', '#C4B5FD', '#F8FAFC'] as const

export const BOT_VARIANTS = { antenna: 5, head: 4, ears: 3, eyes: 7, mouth: 6 } as const

export interface BotTraits {
  background: readonly [string, string]
  head: string
  led: string
  antenna: number
  headShape: number
  ears: number
  eyes: number
  mouth: number
  blush: boolean
}

export function getBotTraits(seed: string): BotTraits {
  const random = createSeededRandom(hashString(seed))
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T
  const variant = (count: number): number => Math.floor(random() * count)
  return {
    background: pick(AVATAR_BACKGROUNDS),
    head: pick(HEAD_COLORS),
    led: pick(LED_COLORS),
    antenna: variant(BOT_VARIANTS.antenna),
    headShape: variant(BOT_VARIANTS.head),
    ears: variant(BOT_VARIANTS.ears),
    eyes: variant(BOT_VARIANTS.eyes),
    mouth: variant(BOT_VARIANTS.mouth),
    blush: random() < 0.3,
  }
}

/** Background gradient for an emoji avatar, stable per emoji. */
export function getEmojiBackground(emoji: string): readonly [string, string] {
  return AVATAR_BACKGROUNDS[hashString(emoji) % AVATAR_BACKGROUNDS.length] as readonly [string, string]
}
