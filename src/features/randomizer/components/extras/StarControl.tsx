import { motion } from 'framer-motion'
import { Minus, Star } from 'lucide-react'
import { useRef } from 'react'

import { Button } from '@/components/ui/button'
import { playSfx } from '@/lib/audio/sfx'
import { cn } from '@/lib/utils'

import { MAX_STARS_PER_PICK } from '../../engine/extras'

interface StarControlProps {
  value: number
  /** Whose stars these are (for screen readers). */
  name: string
  onChange: (value: number) => void
  compact?: boolean
  reduced?: boolean
}

/** Class Ranking: give (or take back) stars for one pick. */
export function StarControl({ value, name, onChange, compact = false, reduced = false }: StarControlProps) {
  const addRef = useRef<HTMLButtonElement>(null)
  const removeRef = useRef<HTMLButtonElement>(null)
  const full = value >= MAX_STARS_PER_PICK

  const add = () => {
    if (full) return
    onChange(value + 1)
    playSfx('confetti', { volume: 0.6 })
    // The add button is disabled at the limit: keep keyboard focus inside the control.
    if (value + 1 >= MAX_STARS_PER_PICK) requestAnimationFrame(() => removeRef.current?.focus())
  }

  const remove = () => {
    if (value <= 0) return
    onChange(value - 1)
    playSfx('click')
    // The remove button disappears at zero.
    if (value - 1 <= 0) requestAnimationFrame(() => addRef.current?.focus())
  }

  return (
    <div
      role="group"
      aria-label={`ดาวของ ${name}`}
      className={cn('flex flex-wrap items-center justify-center', compact ? 'gap-1.5' : 'gap-2')}
      data-testid="star-control"
    >
      {value > 0 ? (
        <span className="flex items-center gap-0.5" aria-hidden>
          {Array.from({ length: value }, (_, index) => (
            <motion.span
              key={index}
              initial={reduced ? false : { scale: 0, rotate: -120 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 16 }}
            >
              <Star
                className={cn(
                  'fill-neon-gold text-neon-gold drop-shadow-[0_0_6px_rgb(251_191_36/0.7)]',
                  compact ? 'size-4' : 'size-6',
                )}
              />
            </motion.span>
          ))}
        </span>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {value} ดาว
      </span>
      {value > 0 ? (
        <Button ref={removeRef} variant="ghost" size="icon-sm" onClick={remove} aria-label={`ลดดาวของ ${name} 1 ดวง`}>
          <Minus aria-hidden />
        </Button>
      ) : null}
      <Button
        ref={addRef}
        variant="outline"
        size="sm"
        onClick={add}
        disabled={full}
        aria-label={`ให้ดาว ${name} 1 ดวง`}
        className="border-neon-gold/50 text-neon-gold hover:bg-neon-gold/10 hover:text-neon-gold"
      >
        <Star className="fill-current" aria-hidden />
        {compact ? '+1' : value === 0 ? 'ให้ดาว' : 'ให้ดาวเพิ่ม'}
      </Button>
    </div>
  )
}
