import { ArrowRight, Hash } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { RANDOM_MODES, type Classroom, type ID } from '@/data/types'
import { toneStyle } from '@/features/classrooms/lib/colors'
import { MODE_META } from '@/features/randomizer/lib/modes'
import { cn } from '@/lib/utils'

const NUMBERS = 'none'

interface QuickStartProps {
  classrooms: readonly Classroom[]
  /** Classroom preselected when the dashboard opens (the one used last). */
  initialClassroomId: ID | null
}

const chipClassName = cn(
  'inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold outline-none transition-colors',
  'focus-visible:ring-2 focus-visible:ring-ring',
)

/** Two taps to a draw: pick who, then pick the game. */
export function QuickStart({ classrooms, initialClassroomId }: QuickStartProps) {
  const [selected, setSelected] = useState<string>(
    classrooms.some((classroom) => classroom.id === initialClassroomId)
      ? (initialClassroomId as string)
      : (classrooms[0]?.id ?? NUMBERS),
  )

  return (
    <div className="grid gap-4">
      <fieldset>
        <legend className="hud-label mb-2 text-neon-cyan">1 · เลือกผู้เข้าร่วม</legend>
        <div className="flex flex-wrap gap-2">
          {classrooms.map((classroom) => {
            const active = selected === classroom.id
            return (
              <label key={classroom.id} className="relative cursor-pointer" style={toneStyle(classroom.color)}>
                <input
                  type="radio"
                  name="quick-start-classroom"
                  value={classroom.id}
                  checked={active}
                  onChange={() => setSelected(classroom.id)}
                  className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0"
                />
                <span
                  className={cn(
                    chipClassName,
                    'peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
                    active ? 'border-(--tone) bg-(--tone)/15 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span aria-hidden className="size-2.5 rounded-full bg-(--tone)" />
                  {classroom.name}
                </span>
              </label>
            )
          })}
          <label className="relative cursor-pointer">
            <input
              type="radio"
              name="quick-start-classroom"
              value={NUMBERS}
              checked={selected === NUMBERS}
              onChange={() => setSelected(NUMBERS)}
              className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0"
            />
            <span
              className={cn(
                chipClassName,
                'peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
                selected === NUMBERS
                  ? 'border-neon-gold bg-neon-gold/15 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <Hash className="size-4" aria-hidden />
              สุ่มตัวเลข
            </span>
          </label>
        </div>
      </fieldset>

      <div>
        <p className="hud-label mb-2 text-neon-cyan">2 · เลือกโหมดแล้วเริ่มเลย</p>
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {RANDOM_MODES.map((mode) => {
            const meta = MODE_META[mode]
            return (
              <li key={mode}>
                <Link
                  to={`/studio?classroom=${selected}&mode=${mode}`}
                  className={cn(
                    'group flex h-full flex-col gap-1.5 rounded-2xl border border-border bg-ink/45 p-3.5 outline-none',
                    'transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-neon-pink/60 hover:shadow-glow-pink',
                    'focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  <meta.icon className="size-7 text-neon-pink" aria-hidden />
                  <span className="font-bold">{meta.english}</span>
                  <span className="text-xs text-muted-foreground">{meta.description}</span>
                  <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-semibold text-neon-cyan">
                    เริ่ม
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
