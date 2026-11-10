import type { AnimationLevel, RevealPace } from '@/data/settings'

/** Everything a component needs to know to scale its effects to the chosen animation level. */
export interface AnimationProfile {
  level: AnimationLevel
  /** Background particle budget for a 1920×1080 viewport (scaled down for smaller screens). */
  particles: number
  /** Draw connecting lines between nearby background particles. */
  particleLinks: boolean
  /** Confetti pieces per burst. 0 disables confetti. */
  confetti: number
  /** Screen shake on impact moments. */
  shake: boolean
  /** Rotating light rays behind the winner. */
  rays: boolean
  /** Decorative looping motion (floating cards, LED chase, glow pulses). */
  ambient: boolean
  /** Multiplier applied to stage animation durations. */
  durationScale: number
}

const PROFILES: Record<AnimationLevel, AnimationProfile> = {
  low: {
    level: 'low',
    particles: 0,
    particleLinks: false,
    confetti: 0,
    shake: false,
    rays: false,
    ambient: false,
    durationScale: 0.55,
  },
  medium: {
    level: 'medium',
    particles: 42,
    particleLinks: false,
    confetti: 110,
    shake: false,
    rays: true,
    ambient: true,
    durationScale: 1,
  },
  high: {
    level: 'high',
    particles: 80,
    particleLinks: true,
    confetti: 220,
    shake: true,
    rays: true,
    ambient: true,
    durationScale: 1.15,
  },
}

const PACE_SCALE: Record<RevealPace, number> = {
  short: 0.7,
  normal: 1,
  long: 1.4,
}

export function getAnimationProfile(level: AnimationLevel): AnimationProfile {
  return PROFILES[level]
}

/** Combined duration multiplier for stage timelines (animation level × reveal pace). */
export function getDurationScale(level: AnimationLevel, pace: RevealPace): number {
  return PROFILES[level].durationScale * PACE_SCALE[pace]
}
