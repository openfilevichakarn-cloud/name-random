import type { Session } from '@supabase/supabase-js'

import { getRepository, setRepository } from '@/data'
import { LocalRepository } from '@/data/local/localRepository'
import type { ImportSummary } from '@/data/repository'
import { getSupabaseClient, isSupabaseConfigured, type AppSupabaseClient } from '@/data/supabase/client'
import type { UserRow } from '@/data/supabase/database.types'
import { SupabaseRepository } from '@/data/supabase/supabaseRepository'
import type { UserRole } from '@/data/types'
import { useAuthStore, type AccountProfile, type AccountSchool } from '@/stores/authStore'
import { useDataStore } from '@/stores/dataStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useStudioStore } from '@/stores/studioStore'

import { describeAuthError } from './errors'
import { startSettingsSync } from './settingsSync'

/** `${userId}:${schoolId}` of the cloud account whose data is active, or null in local mode. */
let activeAccount: string | null = null
let stopSettingsSync: (() => void) | null = null
let started = false
/** Bumped on every auth change, so a slow profile load cannot overwrite a newer state. */
let generation = 0

async function reloadStores(): Promise<void> {
  useStudioStore.getState().detachSessions()
  await Promise.all([useDataStore.getState().reload(), useHistoryStore.getState().reload()])
}

async function switchToLocalData(): Promise<void> {
  if (activeAccount === null) return
  activeAccount = null
  stopSettingsSync?.()
  stopSettingsSync = null
  setRepository(new LocalRepository())
  await reloadStores()
}

async function switchToCloudData(client: AppSupabaseClient, profile: AccountProfile, schoolId: string): Promise<void> {
  const key = `${profile.id}:${schoolId}`
  if (activeAccount === key) return
  activeAccount = key
  stopSettingsSync?.()
  stopSettingsSync = null
  // Switch the repository before anyone is told the account is ready, so no screen loads the wrong data.
  setRepository(new SupabaseRepository(client, { userId: profile.id, schoolId }))
  void reloadStores()
  const stop = await startSettingsSync(client, profile.id)
  if (activeAccount === key) stopSettingsSync = stop
  else stop()
}

async function loadAccount(
  client: AppSupabaseClient,
  session: Session,
): Promise<{ profile: AccountProfile; school: AccountSchool | null }> {
  const { user } = session
  const { data, error } = await client
    .from('users')
    .select('id, school_id, display_name, role')
    .eq('id', user.id)
    .maybeSingle()
  if (error) throw error
  const row = data as Pick<UserRow, 'id' | 'school_id' | 'display_name' | 'role'> | null
  const metadataName = typeof user.user_metadata.display_name === 'string' ? user.user_metadata.display_name : ''
  const profile: AccountProfile = {
    id: user.id,
    email: user.email ?? '',
    displayName: row?.display_name || metadataName || (user.email ?? '').split('@')[0] || '',
    role: (row?.role ?? 'teacher') as UserRole,
    schoolId: row?.school_id ?? null,
  }
  if (!profile.schoolId) return { profile, school: null }

  const school = await client.from('schools').select('id, name').eq('id', profile.schoolId).maybeSingle()
  if (school.error) throw school.error
  return { profile, school: school.data ? { id: school.data.id, name: school.data.name } : null }
}

async function handleSession(client: AppSupabaseClient, session: Session | null): Promise<void> {
  const current = (generation += 1)
  if (!session) {
    await switchToLocalData()
    if (current === generation) useAuthStore.setState({ status: 'signed-out', profile: null, school: null, error: null })
    return
  }
  try {
    const { profile, school } = await loadAccount(client, session)
    if (current !== generation) return
    if (!profile.schoolId || !school) {
      await switchToLocalData()
      useAuthStore.setState({ status: 'needs-school', profile, school: null, error: null })
      return
    }
    await switchToCloudData(client, profile, school.id)
    if (current === generation) useAuthStore.setState({ status: 'ready', profile, school, error: null })
  } catch (error) {
    if (current !== generation) return
    console.error(error)
    await switchToLocalData()
    useAuthStore.setState({
      status: 'signed-out',
      profile: null,
      school: null,
      error: describeAuthError(error, 'โหลดข้อมูลบัญชีไม่สำเร็จ กำลังใช้งานแบบออฟไลน์ในเครื่องนี้'),
    })
  }
}

/** Start listening to the Supabase session. Safe to call more than once. */
export function initAuth(): void {
  if (started || !isSupabaseConfigured) return
  started = true
  getSupabaseClient()
    .then((client) => {
      client.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') useAuthStore.setState({ recovering: true })
        if (event === 'TOKEN_REFRESHED') return
        // Never await Supabase calls inside this callback: it runs while the auth lock is held.
        setTimeout(() => void handleSession(client, session), 0)
      })
    })
    .catch((error: unknown) => {
      console.error(error)
      useAuthStore.setState({ status: 'signed-out', error: 'โหลดระบบบัญชีไม่สำเร็จ กำลังใช้งานแบบออฟไลน์ในเครื่องนี้' })
    })
}

/** Re-read the signed-in account (after joining a school, renaming, …). */
export async function refreshAccount(): Promise<void> {
  const client = await getSupabaseClient()
  const { data } = await client.auth.getSession()
  await handleSession(client, data.session)
}

// -----------------------------------------------------------------------------
// Account actions. They throw supabase errors; turn them into messages with describeAuthError.
// -----------------------------------------------------------------------------

export async function signIn(email: string, password: string): Promise<void> {
  const client = await getSupabaseClient()
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw error
}

/** Returns whether the account still has to be confirmed through the e-mail link. */
export async function signUp(email: string, password: string, displayName: string): Promise<{ needsConfirmation: boolean }> {
  const client = await getSupabaseClient()
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { display_name: displayName.trim() },
      emailRedirectTo: `${window.location.origin}/login`,
    },
  })
  if (error) throw error
  return { needsConfirmation: !data.session }
}

/** Sign out on this device only: other classroom computers stay signed in. */
export async function signOut(): Promise<void> {
  const client = await getSupabaseClient()
  const { error } = await client.auth.signOut({ scope: 'local' })
  if (error) throw error
}

export async function requestPasswordReset(email: string): Promise<void> {
  const client = await getSupabaseClient()
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

export async function updatePassword(password: string): Promise<void> {
  const client = await getSupabaseClient()
  const { error } = await client.auth.updateUser({ password })
  if (error) throw error
  useAuthStore.setState({ recovering: false })
}

export async function createSchool(name: string, displayName: string): Promise<void> {
  const client = await getSupabaseClient()
  const { error } = await client.rpc('create_school', { school_name: name.trim(), display_name: displayName.trim() })
  if (error) throw error
  await refreshAccount()
}

export async function joinSchool(code: string, displayName: string): Promise<void> {
  const client = await getSupabaseClient()
  const { error } = await client.rpc('join_school', { join_code: code.trim(), display_name: displayName.trim() })
  if (error) throw error
  await refreshAccount()
}

export async function updateDisplayName(displayName: string): Promise<void> {
  const client = await getSupabaseClient()
  const profile = useAuthStore.getState().profile
  if (!profile) return
  const { error } = await client.from('users').update({ display_name: displayName.trim() }).eq('id', profile.id)
  if (error) throw error
  useAuthStore.setState({ profile: { ...profile, displayName: displayName.trim() } })
}

export async function renameSchool(name: string): Promise<void> {
  const client = await getSupabaseClient()
  const school = useAuthStore.getState().school
  if (!school) return
  // No `.select()`: returning the row would need read access to every column, including the join code.
  const { error } = await client.from('schools').update({ name: name.trim() }).eq('id', school.id)
  if (error) throw error
  useAuthStore.setState({ school: { ...school, name: name.trim() } })
}

export async function fetchJoinCode(): Promise<string> {
  const client = await getSupabaseClient()
  const { data, error } = await client.rpc('get_join_code')
  if (error) throw error
  return data ?? ''
}

export async function regenerateJoinCode(): Promise<string> {
  const client = await getSupabaseClient()
  const { data, error } = await client.rpc('regenerate_join_code')
  if (error) throw error
  return data ?? ''
}

export interface SchoolMember {
  id: string
  displayName: string
  role: UserRole
}

export async function listMembers(): Promise<SchoolMember[]> {
  const client = await getSupabaseClient()
  const school = useAuthStore.getState().school
  if (!school) return []
  const { data, error } = await client
    .from('users')
    .select('id, display_name, role, created_at')
    .eq('school_id', school.id)
    .order('created_at')
  if (error) throw error
  return (data ?? []).map((row) => ({ id: row.id, displayName: row.display_name, role: row.role }))
}

export async function setMemberRole(memberId: string, role: 'admin' | 'teacher'): Promise<void> {
  const client = await getSupabaseClient()
  const { error } = await client.rpc('set_member_role', { member_id: memberId, new_role: role })
  if (error) throw error
}

/** Copy everything stored in this browser into the signed-in account. */
export async function uploadLocalData(): Promise<ImportSummary> {
  const snapshot = await new LocalRepository().exportSnapshot()
  const summary = await getRepository().importSnapshot(snapshot)
  await reloadStores()
  return summary
}

/** Whether this browser holds any local data worth uploading. */
export async function hasLocalData(): Promise<boolean> {
  const snapshot = await new LocalRepository().exportSnapshot()
  return snapshot.classrooms.length + snapshot.results.length > 0
}
