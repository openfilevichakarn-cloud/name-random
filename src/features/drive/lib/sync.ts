import { getRepository } from '@/data'
import { createBackup, parseBackup, type BackupParseResult } from '@/data/backup'
import { subscribeDataChanges, withoutChangeEvents } from '@/data/changes'
import type { DataSnapshot } from '@/data/repository'
import { useBattleStore } from '@/stores/battleStore'
import { useDataStore } from '@/stores/dataStore'
import { useDriveStore, type DataCounts } from '@/stores/driveStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useStudioStore } from '@/stores/studioStore'

import { DRIVE_FILE_NAME, isDriveConfigured } from './config'
import { DriveClient, DriveError, type DriveFile } from './driveApi'
import { GoogleAuthError, requestAccessToken, revokeAccessToken, type AccessToken } from './gis'
import { planSync } from './syncPlan'

/** Wait this long after the last change before saving, so a burst of edits is one upload. */
export const SAVE_DELAY_MS = 2000

let token: AccessToken | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let queue: Promise<void> = Promise.resolve()
/** Bumped on every local change; tells whether data changed while an upload was in flight. */
let changeSeq = 0
/** True while data that came from Drive is being applied (those writes are not changes). */
let applying = false
/** The Drive side of an open conflict. */
let conflictRemote: { file: DriveFile; backup: Extract<BackupParseResult, { ok: true }> | null } | null = null
let started = false

const state = () => useDriveStore.getState()

function counts(data: DataSnapshot): DataCounts {
  return { classrooms: data.classrooms.length, students: data.students.length, results: data.results.length }
}

function isEmpty(data: DataSnapshot): boolean {
  return data.classrooms.length + data.students.length + data.sessions.length + data.results.length === 0
}

function hasToken(): boolean {
  return token !== null && token.expiresAt > Date.now()
}

function describe(error: unknown, fallback: string): string {
  if (error instanceof DriveError || error instanceof GoogleAuthError) return error.message
  return fallback
}

function fail(error: unknown, fallback = 'ซิงก์กับ Google Drive ไม่สำเร็จ'): void {
  console.error(error)
  if (error instanceof DriveError && error.code === 'unauthorized') {
    token = null
    state().set({ status: 'needs-auth', error: null })
    return
  }
  state().set({ status: 'error', error: describe(error, fallback) })
}

function markChanged(): void {
  if (applying || getRepository().kind !== 'local') return
  changeSeq += 1
  const drive = state()
  if (!drive.linked) return
  drive.set({ localChanged: true })
  if (drive.status === 'conflict' || !hasToken()) {
    if (drive.status !== 'conflict') drive.set({ status: 'needs-auth' })
    return
  }
  drive.set({ status: 'pending' })
  if (timer !== null) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void syncNow()
  }, SAVE_DELAY_MS)
}

/** Start listening for changes. Call once at startup (does nothing unless Drive is configured). */
export function initDriveSync(): void {
  if (!isDriveConfigured || started) return
  started = true
  subscribeDataChanges(markChanged)
  useSettingsStore.subscribe((next, previous) => {
    if (next.settings !== previous.settings) markChanged()
  })
}

async function upload(client: DriveClient, file: DriveFile | null, data: DataSnapshot, seq: number): Promise<void> {
  const content = JSON.stringify(createBackup(data, useSettingsStore.getState().settings))
  const saved = file ? await client.update(file.id, content) : await client.create(DRIVE_FILE_NAME, content)
  const stillChanged = changeSeq !== seq
  state().set({
    fileId: saved.id,
    fileLink: saved.webViewLink,
    lastSyncedVersion: saved.version,
    lastSyncedAt: new Date().toISOString(),
    localChanged: stillChanged,
    status: stillChanged ? 'pending' : 'saved',
    error: null,
    conflict: null,
  })
  if (stillChanged) markChanged()
}

/** Replace this device's data with the Drive file. */
async function apply(file: DriveFile, backup: Extract<BackupParseResult, { ok: true }>): Promise<void> {
  applying = true
  try {
    await withoutChangeEvents(async () => {
      const repository = getRepository()
      await repository.clearAll()
      await repository.importSnapshot(backup.data)
    })
    if (backup.settings) useSettingsStore.getState().replaceAll(backup.settings)
  } finally {
    applying = false
  }
  // Rounds and battles of this device point at rows that may not exist in the Drive data.
  useStudioStore.getState().detachSessions()
  useBattleStore.getState().detachResults()
  await Promise.all([useDataStore.getState().reload(), useHistoryStore.getState().reload()])
  state().set({
    fileId: file.id,
    fileLink: file.webViewLink,
    lastSyncedVersion: file.version,
    lastSyncedAt: new Date().toISOString(),
    localChanged: false,
    status: 'saved',
    error: null,
    conflict: null,
  })
}

async function runSync(): Promise<void> {
  const drive = state()
  if (!drive.linked || getRepository().kind !== 'local') return
  if (!hasToken() || !token) {
    drive.set({ status: 'needs-auth' })
    return
  }
  drive.set({ status: 'syncing', error: null })
  const client = new DriveClient(token.token)

  let file: DriveFile | null = null
  if (drive.fileId) {
    try {
      file = await client.getFile(drive.fileId)
    } catch (error) {
      if (!(error instanceof DriveError && error.code === 'not-found')) throw error
    }
  }
  file ??= await client.findFile(DRIVE_FILE_NAME)
  const lastSynced = file && file.id === drive.fileId ? drive.lastSyncedVersion : null

  let backup: BackupParseResult | null = null
  if (file && file.version !== lastSynced) backup = parseBackup(await client.download(file.id))

  const seq = changeSeq
  const local = await getRepository().exportSnapshot()
  const action =
    backup && !backup.ok
      ? 'conflict'
      : planSync({
          remote: file ? { version: file.version, empty: backup?.ok ? isEmpty(backup.data) : false } : null,
          lastSyncedVersion: lastSynced,
          localChanged: state().localChanged,
          localEmpty: isEmpty(local),
        })

  if (action === 'upload') await upload(client, file, local, seq)
  else if (action === 'download' && file && backup?.ok) await apply(file, backup)
  else if (action === 'conflict' && file) {
    conflictRemote = { file, backup: backup?.ok ? backup : null }
    state().set({
      status: 'conflict',
      conflict: {
        drive: backup?.ok ? { ...counts(backup.data), modifiedTime: file.modifiedTime } : null,
        device: counts(local),
      },
    })
  } else state().set({ status: 'saved', fileId: file?.id ?? drive.fileId, fileLink: file?.webViewLink ?? drive.fileLink })
}

/** Sync now (serialised: a call while one runs waits for it). */
export function syncNow(): Promise<void> {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
  queue = queue.then(runSync).catch((error: unknown) => fail(error))
  return queue
}

/** Link Google Drive, or get access again. Must be called from a click (Google opens a popup). */
export async function connectDrive(): Promise<boolean> {
  const drive = state()
  drive.set({ status: 'connecting', error: null })
  try {
    token = await requestAccessToken(drive.email || undefined)
    const email = await new DriveClient(token.token).accountEmail()
    // Another Google account: its Drive has its own file.
    if (drive.linked && drive.email && email && email !== drive.email) {
      drive.set({ fileId: null, fileLink: null, lastSyncedVersion: null })
    }
    drive.set({ linked: true, email })
  } catch (error) {
    token = null
    const cancelled = error instanceof GoogleAuthError && (error.reason === 'popup_closed' || error.reason === 'access_denied')
    drive.set({
      status: drive.linked ? 'needs-auth' : 'off',
      error: cancelled ? null : describe(error, 'เชื่อมต่อ Google Drive ไม่สำเร็จ'),
    })
    if (!cancelled) console.error(error)
    return false
  }
  await syncNow()
  return state().status === 'saved' || state().status === 'conflict' || state().status === 'pending'
}

/** Settle a conflict: keep the Drive file (replaces this device) or this device (overwrites Drive). */
export function resolveConflict(keep: 'drive' | 'device'): Promise<void> {
  queue = queue
    .then(async () => {
      const remote = conflictRemote
      if (!remote || !token) return
      if (keep === 'drive') {
        if (!remote.backup) return
        await apply(remote.file, remote.backup)
      } else {
        const client = new DriveClient(token.token)
        const seq = changeSeq
        await upload(client, remote.file, await getRepository().exportSnapshot(), seq)
      }
      conflictRemote = null
    })
    .catch((error: unknown) => fail(error))
  return queue
}

/** Stop syncing on this device. The data stays here and in Drive. */
export async function disconnectDrive(): Promise<void> {
  if (timer !== null) clearTimeout(timer)
  timer = null
  const current = token
  token = null
  conflictRemote = null
  useDriveStore.getState().reset()
  if (current) await revokeAccessToken(current.token)
}
