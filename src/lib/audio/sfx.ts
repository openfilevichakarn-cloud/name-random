/** The ten sound events of the product spec. */
export const SFX_EVENTS = [
  'click',
  'hover',
  'spin',
  'tick',
  'suspense',
  'countdown',
  'reveal',
  'winner',
  'confetti',
  'error',
] as const
export type SfxEvent = (typeof SFX_EVENTS)[number]

export interface SfxOptions {
  /** Extra gain for this one play, 0–1 (default 1). */
  volume?: number
  /** Playback rate; 2 is an octave up (default 1). */
  rate?: number
}

type SfxPlayer = (event: SfxEvent, options?: SfxOptions) => void

let player: SfxPlayer | null = null

/**
 * Sound facade used by UI and stage code. Components only ever call `playSfx`;
 * the SoundManager plugs itself in here once audio has been unlocked by a user gesture,
 * so calling this early (or with sound disabled) is always safe and silent.
 */
export function playSfx(event: SfxEvent, options?: SfxOptions): void {
  player?.(event, options)
}

export function setSfxPlayer(next: SfxPlayer | null): void {
  player = next
}
