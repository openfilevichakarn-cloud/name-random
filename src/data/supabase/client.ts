import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from './database.types'

export type AppSupabaseClient = SupabaseClient<Database>

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''

/** Accounts and cloud sync exist only when the deployment is connected to a Supabase project. */
export const isSupabaseConfigured = url !== '' && key !== ''

let clientPromise: Promise<AppSupabaseClient> | null = null

/**
 * The shared Supabase client. supabase-js is loaded on first use, so people who only use the
 * app locally never download it.
 */
export function getSupabaseClient(): Promise<AppSupabaseClient> {
  if (!isSupabaseConfigured) return Promise.reject(new Error('Supabase is not configured'))
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient<Database>(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Picks up the session from e-mail confirmation and password-reset links.
        detectSessionInUrl: true,
        storageKey: 'ngsr:auth',
      },
    }),
  )
  return clientPromise
}
