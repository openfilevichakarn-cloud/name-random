import { motion } from 'framer-motion'
import { Flame } from 'lucide-react'

import { cn } from '@/lib/utils'

interface StreakBadgeProps {
  /** Picks of the student today, this one included (≥ 2). */
  count: number
  reduced?: boolean
  className?: string
}

/** Lucky Streak: the student has been picked more than once today. */
export function StreakBadge({ count, reduced = false, className }: StreakBadgeProps) {
  return (
    <motion.span
      initial={reduced ? false : { scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 18, delay: reduced ? 0 : 0.45 }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-neon-pink/55 bg-neon-pink/15 px-3 py-1 text-sm font-bold text-[#f9a8d4] shadow-[0_0_18px_-4px_var(--neon-pink)]',
        className,
      )}
      title={`ถูกเลือกเป็นครั้งที่ ${count} ของวันนี้`}
      data-testid="streak-badge"
    >
      <Flame className="size-4 fill-neon-pink/60 text-neon-pink" aria-hidden />
      Lucky Streak ×{count}
      <span className="sr-only">ถูกเลือกเป็นครั้งที่ {count} ของวันนี้</span>
    </motion.span>
  )
}
