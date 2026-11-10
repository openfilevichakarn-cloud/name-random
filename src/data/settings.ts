import { RANDOM_MODES, type RandomMode, type RepeatPolicy } from './types'

// ---------------------------------------------------------------------------
// Option vocabularies
// ---------------------------------------------------------------------------

export const ANIMATION_LEVELS = ['low', 'medium', 'high'] as const
export type AnimationLevel = (typeof ANIMATION_LEVELS)[number]

export const ACCENT_PRESETS = ['violet', 'cyan', 'pink'] as const
export type AccentPreset = (typeof ACCENT_PRESETS)[number]

export const UI_SCALES = ['md', 'lg', 'xl'] as const
export type UiScale = (typeof UI_SCALES)[number]

export const NAME_FORMATS = ['nickname', 'first', 'full'] as const
/** Which name is used as the big label while drawing. */
export type NameFormat = (typeof NAME_FORMATS)[number]

export const SOUND_THEMES = ['neon', 'arcade', 'soft'] as const
export type SoundThemeId = (typeof SOUND_THEMES)[number]

export const MUSIC_MODES = ['off', 'draw', 'always'] as const
/** `draw` = music only while a draw is running, `always` = also while idle in the studio. */
export type MusicMode = (typeof MUSIC_MODES)[number]

export const REVEAL_PACES = ['short', 'normal', 'long'] as const
export type RevealPace = (typeof REVEAL_PACES)[number]

export const TEAM_SPLITS = ['count', 'size'] as const
/** Split by a fixed number of teams, or by a target team size. */
export type TeamSplit = (typeof TEAM_SPLITS)[number]

export const NAME_SIZES = ['md', 'lg', 'xl'] as const
export type NameSize = (typeof NAME_SIZES)[number]

export const COUNTDOWN_OPTIONS = [3, 5, 10] as const
export type CountdownSeconds = (typeof COUNTDOWN_OPTIONS)[number]

const REPEAT_POLICIES = ['no-repeat', 'allow-repeat'] as const satisfies readonly RepeatPolicy[]

// ---------------------------------------------------------------------------
// Settings shape (one object per Settings tab)
// ---------------------------------------------------------------------------

export interface GeneralSettings {
  teacherName: string
  nameFormat: NameFormat
  defaultMode: RandomMode
  /** Reopen the studio with the classroom that was used last. */
  rememberLastClassroom: boolean
}

export interface AppearanceSettings {
  accent: AccentPreset
  scale: UiScale
  particles: boolean
  grid: boolean
}

export interface SoundSettings {
  enabled: boolean
  /** 0–1 */
  master: number
  /** 0–1 */
  music: number
  /** 0–1 */
  sfx: number
  theme: SoundThemeId
  musicMode: MusicMode
  /** Play the subtle hover blip on pointer devices. */
  hover: boolean
}

export interface AnimationSettings {
  level: AnimationLevel
  confetti: boolean
  pace: RevealPace
  countdownSeconds: CountdownSeconds
}

export interface RuleSettings {
  repeatPolicy: RepeatPolicy
  /** How many winners a "multiple" draw produces. */
  multipleCount: number
  teamSplit: TeamSplit
  teamCount: number
  teamSize: number
  numberMin: number
  numberMax: number
}

export interface DisplaySettings {
  showAvatar: boolean
  showNumber: boolean
  /** Show the full name under the big label on the winner screen. */
  showFullName: boolean
  nameSize: NameSize
  /** Hold a screen wake lock while Big Screen Mode is on. */
  keepAwake: boolean
  /** Enter browser fullscreen together with Big Screen Mode. */
  autoFullscreen: boolean
}

export interface FeatureSettings {
  /** Class Ranking: award stars on the winner screen. */
  stars: boolean
  /** Lucky Streak badge when a student is drawn again and again. */
  streak: boolean
  /** Random Challenge: draw a mission for the winner. */
  challenge: boolean
  challenges: string[]
  /** Surprise Reward: occasionally attach a reward to the winner. */
  reward: boolean
  rewards: string[]
  /** 0–1 probability that a draw carries a reward. */
  rewardChance: number
  /** Answer timer in seconds shown after the reveal; 0 = off. */
  answerTimer: number
}

export interface AppSettings {
  general: GeneralSettings
  appearance: AppearanceSettings
  sound: SoundSettings
  animation: AnimationSettings
  rules: RuleSettings
  display: DisplaySettings
  features: FeatureSettings
}

export type SettingsSection = keyof AppSettings

// ---------------------------------------------------------------------------
// Limits shared by the UI and the validators
// ---------------------------------------------------------------------------

export const LIMITS = {
  multipleCount: { min: 2, max: 20 },
  teamCount: { min: 2, max: 12 },
  teamSize: { min: 2, max: 20 },
  number: { min: 0, max: 9999 },
  /** Largest allowed size of a number range (max - min + 1). */
  numberSpan: 500,
  listItems: 30,
  listItemLength: 80,
  answerTimer: { min: 0, max: 300 },
} as const

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

export function createDefaultSettings(): AppSettings {
  return {
    general: {
      teacherName: '',
      nameFormat: 'nickname',
      defaultMode: 'wheel',
      rememberLastClassroom: true,
    },
    appearance: {
      accent: 'violet',
      scale: 'md',
      particles: true,
      grid: true,
    },
    sound: {
      enabled: true,
      master: 0.8,
      music: 0.5,
      sfx: 0.9,
      theme: 'neon',
      musicMode: 'draw',
      hover: true,
    },
    animation: {
      level: prefersReducedMotion() ? 'low' : 'medium',
      confetti: true,
      pace: 'normal',
      countdownSeconds: 5,
    },
    rules: {
      repeatPolicy: 'no-repeat',
      multipleCount: 3,
      teamSplit: 'count',
      teamCount: 4,
      teamSize: 5,
      numberMin: 1,
      numberMax: 40,
    },
    display: {
      showAvatar: true,
      showNumber: true,
      showFullName: true,
      nameSize: 'lg',
      keepAwake: true,
      autoFullscreen: true,
    },
    features: {
      stars: true,
      streak: true,
      challenge: false,
      challenges: [],
      reward: false,
      rewards: [],
      rewardChance: 0.2,
      answerTimer: 0,
    },
  }
}

// ---------------------------------------------------------------------------
// Sanitising — settings come from localStorage / the cloud, so never trust them
// ---------------------------------------------------------------------------

type Dict = Record<string, unknown>

function isDict(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function pickEnum<T extends string | number>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback
}

function pickBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function pickNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function pickInt(value: unknown, min: number, max: number, fallback: number): number {
  return Math.round(pickNumber(value, min, max, fallback))
}

function pickText(value: unknown, maxLength: number, fallback: string): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : fallback
}

function pickTextList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, LIMITS.listItemLength))
    .filter((item) => item.length > 0)
    .slice(0, LIMITS.listItems)
}

/**
 * Build a complete, valid settings object from untrusted input.
 * Unknown keys are dropped, invalid values fall back to the defaults.
 */
export function sanitizeSettings(input: unknown, defaults: AppSettings = createDefaultSettings()): AppSettings {
  const root = isDict(input) ? input : {}
  const section = (key: SettingsSection): Dict => (isDict(root[key]) ? (root[key] as Dict) : {})

  const general = section('general')
  const appearance = section('appearance')
  const sound = section('sound')
  const animation = section('animation')
  const rules = section('rules')
  const display = section('display')
  const features = section('features')

  const numberMin = pickInt(rules.numberMin, LIMITS.number.min, LIMITS.number.max, defaults.rules.numberMin)
  let numberMax = pickInt(rules.numberMax, LIMITS.number.min, LIMITS.number.max, defaults.rules.numberMax)
  if (numberMax < numberMin) numberMax = numberMin
  if (numberMax - numberMin + 1 > LIMITS.numberSpan) numberMax = numberMin + LIMITS.numberSpan - 1

  return {
    general: {
      teacherName: pickText(general.teacherName, 60, defaults.general.teacherName),
      nameFormat: pickEnum(general.nameFormat, NAME_FORMATS, defaults.general.nameFormat),
      defaultMode: pickEnum(general.defaultMode, RANDOM_MODES, defaults.general.defaultMode),
      rememberLastClassroom: pickBool(general.rememberLastClassroom, defaults.general.rememberLastClassroom),
    },
    appearance: {
      accent: pickEnum(appearance.accent, ACCENT_PRESETS, defaults.appearance.accent),
      scale: pickEnum(appearance.scale, UI_SCALES, defaults.appearance.scale),
      particles: pickBool(appearance.particles, defaults.appearance.particles),
      grid: pickBool(appearance.grid, defaults.appearance.grid),
    },
    sound: {
      enabled: pickBool(sound.enabled, defaults.sound.enabled),
      master: pickNumber(sound.master, 0, 1, defaults.sound.master),
      music: pickNumber(sound.music, 0, 1, defaults.sound.music),
      sfx: pickNumber(sound.sfx, 0, 1, defaults.sound.sfx),
      theme: pickEnum(sound.theme, SOUND_THEMES, defaults.sound.theme),
      musicMode: pickEnum(sound.musicMode, MUSIC_MODES, defaults.sound.musicMode),
      hover: pickBool(sound.hover, defaults.sound.hover),
    },
    animation: {
      level: pickEnum(animation.level, ANIMATION_LEVELS, defaults.animation.level),
      confetti: pickBool(animation.confetti, defaults.animation.confetti),
      pace: pickEnum(animation.pace, REVEAL_PACES, defaults.animation.pace),
      countdownSeconds: pickEnum(animation.countdownSeconds, COUNTDOWN_OPTIONS, defaults.animation.countdownSeconds),
    },
    rules: {
      repeatPolicy: pickEnum(rules.repeatPolicy, REPEAT_POLICIES, defaults.rules.repeatPolicy),
      multipleCount: pickInt(
        rules.multipleCount,
        LIMITS.multipleCount.min,
        LIMITS.multipleCount.max,
        defaults.rules.multipleCount,
      ),
      teamSplit: pickEnum(rules.teamSplit, TEAM_SPLITS, defaults.rules.teamSplit),
      teamCount: pickInt(rules.teamCount, LIMITS.teamCount.min, LIMITS.teamCount.max, defaults.rules.teamCount),
      teamSize: pickInt(rules.teamSize, LIMITS.teamSize.min, LIMITS.teamSize.max, defaults.rules.teamSize),
      numberMin,
      numberMax,
    },
    display: {
      showAvatar: pickBool(display.showAvatar, defaults.display.showAvatar),
      showNumber: pickBool(display.showNumber, defaults.display.showNumber),
      showFullName: pickBool(display.showFullName, defaults.display.showFullName),
      nameSize: pickEnum(display.nameSize, NAME_SIZES, defaults.display.nameSize),
      keepAwake: pickBool(display.keepAwake, defaults.display.keepAwake),
      autoFullscreen: pickBool(display.autoFullscreen, defaults.display.autoFullscreen),
    },
    features: {
      stars: pickBool(features.stars, defaults.features.stars),
      streak: pickBool(features.streak, defaults.features.streak),
      challenge: pickBool(features.challenge, defaults.features.challenge),
      challenges: pickTextList(features.challenges, defaults.features.challenges),
      reward: pickBool(features.reward, defaults.features.reward),
      rewards: pickTextList(features.rewards, defaults.features.rewards),
      rewardChance: pickNumber(features.rewardChance, 0, 1, defaults.features.rewardChance),
      answerTimer: pickInt(
        features.answerTimer,
        LIMITS.answerTimer.min,
        LIMITS.answerTimer.max,
        defaults.features.answerTimer,
      ),
    },
  }
}
