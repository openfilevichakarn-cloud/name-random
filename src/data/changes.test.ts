import { describe, expect, it } from 'vitest'

import { subscribeDataChanges, trackChanges, withoutChangeEvents } from './changes'
import { LocalRepository } from './local/localRepository'

describe('trackChanges', () => {
  it('reports writes, not reads, and can be muted', async () => {
    const repository = trackChanges(new LocalRepository(`ngsr-changes-${Date.now()}`))
    let count = 0
    const stop = subscribeDataChanges(() => {
      count += 1
    })
    const classroom = await repository.createClassroom({ name: 'A', gradeLevel: '', academicYear: '', color: 'cyan' })
    expect(count).toBe(1)
    await repository.listClassrooms()
    expect(count).toBe(1)
    await withoutChangeEvents(() => repository.updateClassroom(classroom.id, { name: 'B' }))
    expect(count).toBe(1)
    await expect(repository.updateClassroom('missing', { name: 'C' })).rejects.toThrow()
    expect(count).toBe(1)
    expect(repository.kind).toBe('local')
    stop()
    await repository.deleteClassroom(classroom.id)
    expect(count).toBe(1)
  })
})
