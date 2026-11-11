import { Check, Undo2, UserX } from 'lucide-react'
import { useMemo, useState } from 'react'

import { SearchInput } from '@/components/common/SearchInput'
import { StudentAvatar } from '@/components/common/StudentAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { DrawSource, RepeatPolicy } from '@/data/types'
import { foldText } from '@/features/students/lib/text'
import { cn } from '@/lib/utils'
import type { PoolRecord } from '@/stores/studioStore'

import type { Candidate } from '../engine/types'

const SEARCH_THRESHOLD = 12

export interface ParticipantsPanelProps {
  candidates: readonly Candidate[]
  pool: PoolRecord
  policy: RepeatPolicy
  source: DrawSource
  /** Changes are locked while a draw is running. */
  disabled: boolean
  /** How many times each candidate was drawn in the current round. */
  pickCounts: ReadonlyMap<string, number>
  onSetExcluded: (ids: string[], excluded: boolean) => void
  onRestoreDrawn: (id: string) => void
}

type Status = 'in' | 'drawn' | 'manual' | 'picked'

/** Who takes part in the draw: manual exclusion per person, plus the state of the current round. */
export function ParticipantsPanel({
  candidates,
  pool,
  policy,
  source,
  disabled,
  pickCounts,
  onSetExcluded,
  onRestoreDrawn,
}: ParticipantsPanelProps) {
  const [query, setQuery] = useState('')
  const drawn = useMemo(() => new Set(policy === 'no-repeat' ? pool.drawnIds : []), [policy, pool.drawnIds])

  const statusOf = (candidate: Candidate): Status => {
    const reason = pool.excluded[candidate.id]
    if (reason) return reason
    return drawn.has(candidate.id) ? 'drawn' : 'in'
  }

  const counts = candidates.reduce(
    (totals, candidate) => {
      const status = statusOf(candidate)
      if (status === 'in') totals.in += 1
      else if (status === 'drawn') totals.drawn += 1
      else totals.out += 1
      return totals
    },
    { in: 0, drawn: 0, out: 0 },
  )

  const visible = useMemo(() => {
    const needle = foldText(query)
    if (!needle) return candidates
    return candidates.filter(
      (candidate) =>
        foldText(candidate.label).includes(needle) ||
        foldText(candidate.detail).includes(needle) ||
        String(candidate.number ?? '') === needle,
    )
  }, [candidates, query])

  const allIds = candidates.map((candidate) => candidate.id)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" aria-live="polite">
        <Badge variant="lime">ในกองสุ่ม {counts.in}</Badge>
        {policy === 'no-repeat' ? <Badge variant="cyan">สุ่มแล้ว {counts.drawn}</Badge> : null}
        {counts.out > 0 ? <Badge variant="muted">ตัดออก {counts.out}</Badge> : null}
      </div>

      {candidates.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          ยังไม่มีผู้เข้าร่วม เลือกห้องเรียนที่มีรายชื่อ หรือเปลี่ยนไปสุ่มจากตัวเลขในแท็บ “กติกา”
        </p>
      ) : (
        <>
          {source === 'students' && candidates.length > SEARCH_THRESHOLD ? (
            <SearchInput value={query} onChange={setQuery} label="ค้นหาผู้เข้าร่วม" placeholder="ค้นหาชื่อหรือเลขที่" />
          ) : null}

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              disabled={disabled || counts.out === 0}
              onClick={() => onSetExcluded(allIds, false)}
            >
              <Check aria-hidden />
              เข้าร่วมทุกคน
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              disabled={disabled || counts.out === candidates.length}
              onClick={() => onSetExcluded(allIds, true)}
            >
              <UserX aria-hidden />
              ตัดออกทั้งหมด
            </Button>
          </div>

          {source === 'numbers' ? (
            // A focusable region scrolls from the keyboard even while the buttons inside are disabled.
            <div
              role="region"
              tabIndex={0}
              aria-label="หมายเลขในกองสุ่ม"
              className="min-h-0 flex-1 overflow-y-auto rounded-lg pr-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ul className="grid auto-rows-min grid-cols-5 gap-1.5">
                {visible.map((candidate) => {
                  const status = statusOf(candidate)
                  const excluded = status === 'manual' || status === 'picked'
                  return (
                    <li key={candidate.id}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!excluded}
                        aria-label={`หมายเลข ${candidate.label}${status === 'drawn' ? ' (สุ่มแล้ว)' : ''}`}
                        disabled={disabled}
                        onClick={() => onSetExcluded([candidate.id], !excluded)}
                        className={cn(
                          'tabular flex h-10 w-full items-center justify-center rounded-lg border text-sm font-bold outline-none transition-colors',
                          'focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed',
                          excluded && 'border-border bg-transparent text-muted-foreground/50 line-through',
                          status === 'drawn' && 'border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan',
                          status === 'in' && 'border-neon-lime/40 bg-neon-lime/10 text-foreground',
                        )}
                      >
                        {candidate.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <div
              role="region"
              tabIndex={0}
              aria-label="รายชื่อในกองสุ่ม"
              className="min-h-0 flex-1 overflow-y-auto rounded-lg pr-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ul className="flex flex-col gap-1">
                {visible.map((candidate) => {
                  const status = statusOf(candidate)
                  const excluded = status === 'manual' || status === 'picked'
                  const times = pickCounts.get(candidate.id) ?? 0
                  return (
                    <li key={candidate.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!excluded}
                        aria-label={`${candidate.label} เข้าร่วมการสุ่ม`}
                        disabled={disabled}
                        onClick={() => onSetExcluded([candidate.id], !excluded)}
                        className={cn(
                          'flex min-h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-transparent px-2 py-1.5 text-left outline-none transition-colors',
                          'enabled:hover:border-border enabled:hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed',
                          excluded && 'opacity-50',
                        )}
                      >
                        <StudentAvatar
                          avatar={candidate.avatar}
                          seed={candidate.id}
                          className={cn('size-9', excluded && 'grayscale')}
                        />
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate font-medium', excluded && 'line-through')}>
                            {candidate.label}
                          </span>
                          <span className="tabular block truncate text-xs text-muted-foreground">
                            {candidate.number !== null ? `เลขที่ ${candidate.number}` : ''}
                            {times > 0 ? ` · ถูกสุ่ม ${times} ครั้ง` : ''}
                          </span>
                        </span>
                        {status === 'drawn' ? <Badge variant="cyan">สุ่มแล้ว</Badge> : null}
                        {status === 'manual' ? <Badge variant="muted">ไม่เข้าร่วม</Badge> : null}
                        {status === 'picked' ? <Badge variant="pink">ตัดออก</Badge> : null}
                      </button>
                      {status === 'drawn' ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={disabled}
                          onClick={() => onRestoreDrawn(candidate.id)}
                          aria-label={`ใส่ ${candidate.label} กลับเข้ากองสุ่ม`}
                        >
                          <Undo2 aria-hidden />
                        </Button>
                      ) : null}
                    </li>
                  )
                })}
                {visible.length === 0 ? (
                  <li className="px-2 py-6 text-center text-sm text-muted-foreground">ไม่พบชื่อที่ค้นหา</li>
                ) : null}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
