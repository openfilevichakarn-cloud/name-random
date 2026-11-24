import { describe, expect, it } from 'vitest'

import { planSync, type SyncState } from './syncPlan'

const base: SyncState = { remote: { version: '5', empty: false }, lastSyncedVersion: '5', localChanged: false, localEmpty: false }

describe('planSync', () => {
  it('creates the file when Drive has none', () => {
    expect(planSync({ ...base, remote: null })).toBe('upload')
    expect(planSync({ ...base, remote: null, localEmpty: true })).toBe('upload')
  })

  it('on first contact takes whichever side has data, and asks when both do', () => {
    const first = { ...base, lastSyncedVersion: null }
    expect(planSync({ ...first, localEmpty: true })).toBe('download')
    expect(planSync({ ...first, remote: { version: '5', empty: true } })).toBe('upload')
    expect(planSync(first)).toBe('conflict')
  })

  it('uploads local changes when Drive did not move', () => {
    expect(planSync({ ...base, localChanged: true })).toBe('upload')
    expect(planSync(base)).toBe('none')
  })

  it('downloads changes made on another device, and never overwrites both-sided changes', () => {
    expect(planSync({ ...base, remote: { version: '9', empty: false } })).toBe('download')
    expect(planSync({ ...base, remote: { version: '9', empty: false }, localChanged: true })).toBe('conflict')
  })
})
