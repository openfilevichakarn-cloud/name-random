import { create } from 'zustand'

import { isSupabaseConfigured } from '@/data/supabase/client'
import type { UserRole } from '@/data/types'

/**
 * `disabled`     — no Supabase project configured: local mode only.
 * `loading`      — checking for a saved session.
 * `signed-out`   — accounts are available but nobody is signed in (local mode).
 * `needs-school` — signed in, but not yet a member of a school.
 * `ready`        — signed in with a school: data lives in the cloud.
 */
export type AuthStatus = 'disabled' | 'loading' | 'signed-out' | 'needs-school' | 'ready'

export interface AccountProfile {
  id: string
  email: string
  displayName: string
  role: UserRole
  schoolId: string | null
}

export interface AccountSchool {
  id: string
  name: string
}

interface AuthState {
  status: AuthStatus
  profile: AccountProfile | null
  school: AccountSchool | null
  /** The user arrived through a password-reset link and must choose a new password. */
  recovering: boolean
  /** Why loading the account failed, when it did. */
  error: string | null
}

export const useAuthStore = create<AuthState>()(() => ({
  status: isSupabaseConfigured ? 'loading' : 'disabled',
  profile: null,
  school: null,
  recovering: false,
  error: null,
}))

export function canManageSchool(profile: AccountProfile | null): boolean {
  return profile?.role === 'owner' || profile?.role === 'admin'
}
