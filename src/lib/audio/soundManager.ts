import { Howl, Howler } from 'howler'

import type { SoundSettings, SoundThemeId } from '@/data/settings'
import { clamp } from '@/lib/utils'

import { MusicEngine, type MusicPattern } from './music'
import { setSfxPlayer, type SfxEvent, type SfxOptions } from './sfx'
import { listRecipes, SOUND_THEMES, type SoundRecipe } from './themes'
import { encodeWav, normalize } from './wav'

/**
 * `locked`  — no user gesture yet; no AudioContext exists.
 * `loading` — unlocked, sound effects are being synthesised.
 * `ready`   — sounds can play.
 * `unsupported` — the browser has no Web Audio; the app stays silent.
 */
export type AudioStatus = 'locked' | 'loading' | 'ready' | 'unsupported'

const SAMPLE_RATE = 44_100
/** Extra silence rendered after each recipe so release tails are not cut. */
const TAIL_SECONDS = 0.06
const FADE_SAMPLES = 256
/** Sounds that can overlap themselves many times per second need a deeper voice pool. */
const POOL_SIZE: Partial<Record<SfxEvent, number>> = { tick: 12, hover: 6, click: 6, countdown: 4 }

type OfflineContextConstructor = typeof OfflineAudioContext

function getOfflineContext(): OfflineContextConstructor | null {
  if (typeof window === 'undefined') return null
  const scope = window as unknown as {
    OfflineAudioContext?: OfflineContextConstructor
    webkitOfflineAudioContext?: OfflineContextConstructor
  }
  return scope.OfflineAudioContext ?? scope.webkitOfflineAudioContext ?? null
}

/** Render one recipe to a WAV file using an offline (faster than real time) audio graph. */
async function renderRecipe(recipe: SoundRecipe, Offline: OfflineContextConstructor): Promise<ArrayBuffer> {
  const length = Math.ceil((recipe.duration + TAIL_SECONDS) * SAMPLE_RATE)
  const ctx = new Offline(1, length, SAMPLE_RATE)
  recipe.build(ctx, ctx.destination, 0.004)
  const buffer = await ctx.startRendering()
  const samples = new Float32Array(buffer.getChannelData(0))
  // A short fade guarantees the buffer ends at zero (no click when a voice is cut by the tail).
  for (let i = 0; i < FADE_SAMPLES && i < samples.length; i += 1) {
    const index = samples.length - 1 - i
    samples[index] = (samples[index] as number) * (i / FADE_SAMPLES)
  }
  return encodeWav([normalize(samples, 0.9)], SAMPLE_RATE)
}

/**
 * Owns every sound the app makes.
 *
 * Sound effects are synthesised with the Web Audio API (OfflineAudioContext) when audio is
 * unlocked, encoded as WAV and handed to Howler, which takes care of voice pooling, per-play
 * volume and rate, and global volume/mute. Music is generated live by `MusicEngine` on Howler's
 * AudioContext. Nothing is created before the first user gesture, as browser autoplay policies require.
 */
class SoundManager {
  private status: AudioStatus = 'locked'
  private settings: SoundSettings | null = null
  private howls = new Map<SfxEvent, Howl>()
  private urls: string[] = []
  private loadedTheme: SoundThemeId | null = null
  /** Bumped whenever a (re)load starts, so a slower, older load cannot overwrite a newer one. */
  private generation = 0
  private wantedMusic: MusicPattern | null = null
  private preview: MusicPattern | null = null
  private readonly music = new MusicEngine()
  private readonly listeners = new Set<(status: AudioStatus) => void>()

  getStatus(): AudioStatus {
    return this.status
  }

  subscribe(listener: (status: AudioStatus) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Apply the sound settings. Safe to call before audio is unlocked. */
  configure(settings: SoundSettings): void {
    this.settings = settings
    if (this.status === 'locked' || this.status === 'unsupported') return
    Howler.volume(settings.master)
    Howler.mute(!settings.enabled)
    this.music.setVolume(settings.music)
    this.music.setVoice(SOUND_THEMES[settings.theme].music)
    if (settings.theme !== this.loadedTheme) void this.loadTheme(settings.theme)
    this.syncMusic()
  }

  /**
   * Create the audio system. Must be called from a user gesture (click, key press, touch):
   * this is the first moment an AudioContext is allowed to start.
   */
  async unlock(): Promise<void> {
    if (this.status !== 'locked') return
    const Offline = getOfflineContext()
    if (!Offline || !Howler.usingWebAudio) {
      this.setStatus('unsupported')
      return
    }
    this.setStatus('loading')
    const settings = this.settings
    if (settings) {
      Howler.volume(settings.master)
      Howler.mute(!settings.enabled)
    }
    await this.loadTheme(settings?.theme ?? 'neon')

    // Howler created its AudioContext while loading the first sound; share it with the music engine.
    if (Howler.ctx) {
      this.music.attach(Howler.ctx, Howler.masterGain)
      if (settings) {
        this.music.setVolume(settings.music)
        this.music.setVoice(SOUND_THEMES[settings.theme].music)
      }
    }
    setSfxPlayer((event, options) => this.play(event, options))
    this.setStatus('ready')
    this.syncMusic()
  }

  play(event: SfxEvent, options: SfxOptions = {}): void {
    const settings = this.settings
    if (this.status !== 'ready' || !settings?.enabled || settings.sfx <= 0) return
    if (event === 'hover' && !settings.hover) return
    const howl = this.howls.get(event)
    if (!howl) return
    const level = SOUND_THEMES[this.loadedTheme ?? settings.theme].sounds[event].level
    const id = howl.play()
    howl.volume(clamp(settings.sfx * level * (options.volume ?? 1), 0, 1), id)
    if (options.rate !== undefined && options.rate !== 1) howl.rate(clamp(options.rate, 0.5, 4), id)
  }

  /** Ask for background music. It starts as soon as audio is ready and the settings allow it. */
  setMusic(pattern: MusicPattern | null): void {
    this.wantedMusic = pattern
    this.syncMusic()
  }

  /** Settings preview: play a loop regardless of the music mode (pass null to stop). */
  previewMusic(pattern: MusicPattern | null): void {
    this.preview = pattern
    this.syncMusic()
  }

  private syncMusic(): void {
    const settings = this.settings
    if (this.status !== 'ready' || !settings) return
    if (this.preview) {
      if (settings.enabled && settings.music > 0) this.music.start(this.preview)
      else this.music.stop()
      return
    }
    const allowed =
      settings.enabled &&
      settings.music > 0 &&
      (settings.musicMode === 'always' || (settings.musicMode === 'draw' && this.wantedMusic === 'draw'))
    if (allowed && this.wantedMusic) this.music.start(this.wantedMusic)
    else this.music.stop()
  }

  private async loadTheme(themeId: SoundThemeId): Promise<void> {
    const Offline = getOfflineContext()
    if (!Offline) return
    const generation = (this.generation += 1)
    const rendered = await Promise.all(
      listRecipes(SOUND_THEMES[themeId]).map(async ([event, recipe]) => {
        const wav = await renderRecipe(recipe, Offline)
        return [event, URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }))] as const
      }),
    )
    if (generation !== this.generation) {
      for (const [, url] of rendered) URL.revokeObjectURL(url)
      return
    }

    const previous = [...this.howls.values()]
    const previousUrls = this.urls
    const next = new Map<SfxEvent, Howl>()
    await Promise.all(
      rendered.map(
        ([event, url]) =>
          new Promise<void>((resolve) => {
            const howl = new Howl({
              src: [url],
              format: ['wav'],
              pool: POOL_SIZE[event] ?? 3,
              onload: () => resolve(),
              onloaderror: () => resolve(),
            })
            next.set(event, howl)
          }),
      ),
    )
    this.howls = next
    this.urls = rendered.map(([, url]) => url)
    this.loadedTheme = themeId
    for (const howl of previous) howl.unload()
    for (const url of previousUrls) URL.revokeObjectURL(url)
  }

  private setStatus(status: AudioStatus): void {
    this.status = status
    if (typeof document !== 'undefined') document.documentElement.dataset.audio = status
    for (const listener of this.listeners) listener(status)
  }
}

export const soundManager = new SoundManager()

/**
 * Arm the one-time unlock: the audio system is created on the first pointer or key press.
 * Returns a function that removes the listeners.
 */
export function armAudioUnlock(): () => void {
  if (typeof window === 'undefined') return () => undefined
  document.documentElement.dataset.audio = soundManager.getStatus()
  const events = ['pointerdown', 'keydown', 'touchend'] as const
  const disarm = () => {
    for (const name of events) window.removeEventListener(name, onGesture, true)
  }
  function onGesture() {
    disarm()
    void soundManager.unlock()
  }
  for (const name of events) window.addEventListener(name, onGesture, { capture: true, passive: true })
  return disarm
}
