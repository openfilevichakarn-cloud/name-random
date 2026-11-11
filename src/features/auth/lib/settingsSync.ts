import type { AppSettings } from '@/data/settings'
import type { AppSupabaseClient } from '@/data/supabase/client'
import type { Json } from '@/data/supabase/database.types'
import { useSettingsStore } from '@/stores/settingsStore'

const PUSH_DELAY_MS = 800

function toRows(settings: AppSettings, userId: string) {
  return {
    random: {
      user_id: userId,
      general: settings.general as unknown as Json,
      appearance: settings.appearance as unknown as Json,
      animation: settings.animation as unknown as Json,
      rules: settings.rules as unknown as Json,
      display: settings.display as unknown as Json,
      features: settings.features as unknown as Json,
    },
    sound: {
      user_id: userId,
      enabled: settings.sound.enabled,
      master_volume: settings.sound.master,
      music_volume: settings.sound.music,
      sfx_volume: settings.sound.sfx,
      theme: settings.sound.theme,
      music_mode: settings.sound.musicMode,
      hover: settings.sound.hover,
    },
  }
}

async function push(client: AppSupabaseClient, userId: string, settings: AppSettings): Promise<void> {
  const rows = toRows(settings, userId)
  const [random, sound] = await Promise.all([
    client.from('random_settings').upsert(rows.random, { onConflict: 'user_id' }),
    client.from('sound_settings').upsert(rows.sound, { onConflict: 'user_id' }),
  ])
  if (random.error) throw random.error
  if (sound.error) throw sound.error
}

/**
 * Keep the settings of a signed-in teacher in their account, so every classroom computer they
 * sign in on looks and sounds the same. Returns a function that stops syncing.
 *
 * On start the account wins when it already has settings; otherwise the settings of this
 * device are uploaded. Afterwards every change is pushed (debounced). Failures are logged and
 * retried with the next change: settings always keep working locally.
 */
export async function startSettingsSync(client: AppSupabaseClient, userId: string): Promise<() => void> {
  const store = useSettingsStore
  let applyingRemote = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  try {
    const [random, sound] = await Promise.all([
      client.from('random_settings').select('*').eq('user_id', userId).maybeSingle(),
      client.from('sound_settings').select('*').eq('user_id', userId).maybeSingle(),
    ])
    if (random.error) throw random.error
    if (sound.error) throw sound.error
    if (random.data || sound.data) {
      const current = store.getState().settings
      applyingRemote = true
      store.getState().replaceAll({
        ...current,
        ...(random.data
          ? {
              general: random.data.general,
              appearance: random.data.appearance,
              animation: random.data.animation,
              rules: random.data.rules,
              display: random.data.display,
              features: random.data.features,
            }
          : {}),
        ...(sound.data
          ? {
              sound: {
                enabled: sound.data.enabled,
                master: Number(sound.data.master_volume),
                music: Number(sound.data.music_volume),
                sfx: Number(sound.data.sfx_volume),
                theme: sound.data.theme,
                musicMode: sound.data.music_mode,
                hover: sound.data.hover,
              },
            }
          : {}),
      })
      applyingRemote = false
    } else {
      await push(client, userId, store.getState().settings)
    }
  } catch (error) {
    applyingRemote = false
    console.warn('Settings sync: initial load failed', error)
  }

  const unsubscribe = store.subscribe((state, previous) => {
    if (applyingRemote || stopped || state.settings === previous.settings) return
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      push(client, userId, store.getState().settings).catch((error: unknown) => {
        console.warn('Settings sync: upload failed', error)
      })
    }, PUSH_DELAY_MS)
  })

  return () => {
    stopped = true
    unsubscribe()
    if (timer !== null) clearTimeout(timer)
  }
}
