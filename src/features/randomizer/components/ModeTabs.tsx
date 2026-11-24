import { ToggleGroup } from 'radix-ui'

import { RANDOM_MODES, type RandomMode } from '@/data/types'
import { cn } from '@/lib/utils'

import { MODE_META } from '../lib/modes'

interface ModeTabsProps {
  value: RandomMode
  onValueChange: (mode: RandomMode) => void
  disabled?: boolean
  className?: string
}

/** The game modes as a single-choice switcher (scrolls sideways when they do not fit). */
export function ModeTabs({ value, onValueChange, disabled = false, className }: ModeTabsProps) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      aria-label="โหมดการสุ่ม"
      disabled={disabled}
      onValueChange={(next) => {
        if (next) onValueChange(next as RandomMode)
      }}
      className={cn(
        // Wraps instead of scrolling: every mode stays visible (4 per row on phones).
        'glass grid max-w-full grid-cols-4 items-stretch gap-1 rounded-2xl p-1.5 sm:flex sm:flex-wrap',
        disabled && 'opacity-60',
        className,
      )}
    >
      {RANDOM_MODES.map((mode) => {
        const meta = MODE_META[mode]
        return (
          <ToggleGroup.Item
            key={mode}
            value={mode}
            aria-label={`${meta.english} — ${meta.label}`}
            title={meta.description}
            className={cn(
              'flex min-h-12 min-w-0 flex-auto flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 text-muted-foreground sm:min-w-[4.25rem] sm:px-3',
              'outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
              'data-[state=on]:bg-primary/25 data-[state=on]:text-foreground data-[state=on]:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_60%,transparent)]',
              'disabled:pointer-events-none sm:flex-row sm:gap-2',
            )}
          >
            <meta.icon className="size-5 shrink-0" aria-hidden />
            <span className="max-w-full truncate text-[0.6875rem] leading-tight font-semibold sm:text-sm">{meta.label}</span>
          </ToggleGroup.Item>
        )
      })}
    </ToggleGroup.Root>
  )
}
