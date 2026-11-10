import { Minus, Plus } from 'lucide-react'
import { useId, useState } from 'react'

import { clamp, cn } from '@/lib/utils'

interface NumberStepperProps {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  /** Accessible name of the field. */
  label: string
  /** Unit shown after the number, e.g. "คน". */
  suffix?: string
  disabled?: boolean
  className?: string
}

const buttonClassName = cn(
  'inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none',
  'transition-colors enabled:hover:bg-accent enabled:hover:text-foreground',
  'focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-35',
)

/** Touch-friendly integer input with − / + buttons. Out-of-range input is clamped on blur. */
export function NumberStepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  suffix,
  disabled = false,
  className,
}: NumberStepperProps) {
  const id = useId()
  const [draft, setDraft] = useState(String(value))
  // Follow external changes (reset, clamping by the store): derived state, resynced during render.
  const [syncedValue, setSyncedValue] = useState(value)
  if (syncedValue !== value) {
    setSyncedValue(value)
    setDraft(String(value))
  }

  const commit = (text: string) => {
    const parsed = Number.parseInt(text, 10)
    const next = Number.isFinite(parsed) ? clamp(parsed, min, max) : value
    setDraft(String(next))
    if (next !== value) onChange(next)
  }

  return (
    <div
      className={cn(
        'inline-flex h-11 items-center gap-0.5 rounded-xl border border-input bg-ink/60 px-0.5',
        'focus-within:border-neon-cyan focus-within:ring-2 focus-within:ring-neon-cyan/30',
        disabled && 'opacity-50',
        className,
      )}
    >
      <button
        type="button"
        className={buttonClassName}
        onClick={() => onChange(clamp(value - step, min, max))}
        disabled={disabled || value <= min}
        aria-label={`ลด${label}`}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ''))}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit(event.currentTarget.value)
        }}
        inputMode="numeric"
        disabled={disabled}
        className="tabular w-12 min-w-0 flex-1 bg-transparent text-center text-base font-semibold outline-none"
      />
      {suffix ? <span className="pr-1 text-sm text-muted-foreground">{suffix}</span> : null}
      <button
        type="button"
        className={buttonClassName}
        onClick={() => onChange(clamp(value + step, min, max))}
        disabled={disabled || value >= max}
        aria-label={`เพิ่ม${label}`}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  )
}
