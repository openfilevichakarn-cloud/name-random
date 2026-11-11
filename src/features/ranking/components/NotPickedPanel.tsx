import { Dices, PartyPopper, UserRoundSearch } from 'lucide-react'

import { GlassCard } from '@/components/common/GlassCard'
import { StudentAvatar } from '@/components/common/StudentAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { NameFormat } from '@/data/settings'
import type { Student } from '@/data/types'
import { getDisplayName } from '@/features/students/lib/names'

interface NotPickedPanelProps {
  students: readonly Student[]
  /** e.g. "สัปดาห์นี้" */
  periodLabel: string
  nameFormat: NameFormat
  onDrawThem: () => void
}

/** Fairness check: who has not had a turn yet, with a shortcut to draw only from them. */
export function NotPickedPanel({ students, periodLabel, nameFormat, onDrawThem }: NotPickedPanelProps) {
  return (
    <GlassCard className="flex flex-col gap-4 self-start p-5" data-testid="not-picked">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <UserRoundSearch className="size-5 text-neon-cyan" aria-hidden />
            ยังไม่ถูกเลือก
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">ช่วงเวลา: {periodLabel}</p>
        </div>
        <Badge variant={students.length > 0 ? 'cyan' : 'lime'} className="tabular shrink-0">
          {students.length} คน
        </Badge>
      </div>

      {students.length === 0 ? (
        <p className="flex items-center gap-2 rounded-2xl border border-neon-lime/35 bg-neon-lime/8 p-4 text-sm">
          <PartyPopper className="size-5 shrink-0 text-neon-lime" aria-hidden />
          ทุกคนได้ถูกเลือกแล้วในช่วงนี้
        </p>
      ) : (
        <>
          <ul className="flex max-h-80 flex-wrap gap-1.5 overflow-y-auto" aria-label="นักเรียนที่ยังไม่ถูกเลือก">
            {students.map((student) => (
              <li
                key={student.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-ink/60 py-0.5 pr-2.5 pl-0.5 text-sm"
              >
                <StudentAvatar avatar={student.avatar} seed={student.id} className="size-6" />
                {getDisplayName(student, nameFormat)}
              </li>
            ))}
          </ul>
          <Button variant="neon" onClick={onDrawThem}>
            <Dices aria-hidden />
            สุ่มจาก {students.length} คนนี้
          </Button>
        </>
      )}
    </GlassCard>
  )
}
