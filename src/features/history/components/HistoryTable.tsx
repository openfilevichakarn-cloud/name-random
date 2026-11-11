import { Star, Trash2 } from 'lucide-react'

import { StudentAvatar } from '@/components/common/StudentAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Hint } from '@/components/ui/tooltip'
import type { ID, RandomResult, RandomSession } from '@/data/types'
import { DRAW_TYPE_LABELS, RESULT_MODE_META } from '@/features/randomizer/lib/modes'
import { formatDate, formatTime } from '@/lib/date'

import { ResultExtras } from './ResultExtras'

interface HistoryTableProps {
  rows: readonly RandomResult[]
  sessions: ReadonlyMap<ID, RandomSession>
  onDelete: (result: RandomResult) => void
}

function teamLabel(result: RandomResult): string | null {
  if (result.teamIndex === null) return null
  return result.meta?.teamName ?? `ทีม ${result.teamIndex + 1}`
}

/** Flat list of results, newest first. */
export function HistoryTable({ rows, sessions, onDelete }: HistoryTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-32 pl-4 sm:pl-6">วันที่ · เวลา</TableHead>
          <TableHead>ชื่อ</TableHead>
          <TableHead className="hidden md:table-cell">ห้องเรียน</TableHead>
          <TableHead className="hidden sm:table-cell">รูปแบบ</TableHead>
          <TableHead className="w-14 pr-3 sm:pr-5">
            <span className="sr-only">การจัดการ</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((result) => {
          const meta = RESULT_MODE_META[result.mode]
          const classroomName = sessions.get(result.sessionId)?.classroomName ?? ''
          const team = teamLabel(result)
          return (
            <TableRow key={result.id}>
              <TableCell className="tabular pl-4 text-sm whitespace-nowrap sm:pl-6">
                <span className="block">{formatDate(result.createdAt)}</span>
                <span className="block text-muted-foreground">{formatTime(result.createdAt)}</span>
              </TableCell>
              <TableCell className="w-full max-w-0">
                <div className="flex min-w-0 items-center gap-3">
                  {result.avatar ? (
                    <StudentAvatar avatar={result.avatar} seed={result.studentId ?? result.id} className="size-10" />
                  ) : (
                    <span className="tabular flex size-10 shrink-0 items-center justify-center rounded-[28%] bg-neon-violet/20 font-bold text-neon-cyan">
                      {result.studentNumber ?? '#'}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-medium">
                      <span className="truncate">{result.displayName}</span>
                      {result.points > 0 ? (
                        <span className="tabular inline-flex shrink-0 items-center gap-0.5 text-xs text-neon-gold">
                          <Star className="size-3.5 fill-current" aria-hidden />
                          {result.points}
                          <span className="sr-only"> ดาว</span>
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[
                        result.avatar && result.studentNumber !== null ? `เลขที่ ${result.studentNumber}` : '',
                        team,
                        // Columns hidden on narrow screens fold into this line.
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      <span className="md:hidden">{classroomName ? ` · ${classroomName}` : ''}</span>
                      <span className="sm:hidden"> · {meta.label}</span>
                    </p>
                    <ResultExtras meta={result.meta} />
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden max-w-48 truncate text-muted-foreground md:table-cell">
                {classroomName || '—'}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <div className="flex flex-col items-start gap-1">
                  <Badge variant={result.mode === 'team' ? 'cyan' : 'default'}>
                    <meta.icon aria-hidden />
                    {meta.english}
                  </Badge>
                  {result.drawType === 'multiple' ? (
                    <span className="text-xs text-muted-foreground">{DRAW_TYPE_LABELS.multiple}</span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="pr-3 sm:pr-5">
                <Hint label="ลบรายการนี้">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="hover:bg-destructive/15 hover:text-destructive"
                    onClick={() => onDelete(result)}
                    aria-label={`ลบผลการสุ่ม ${result.displayName}`}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </Hint>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
