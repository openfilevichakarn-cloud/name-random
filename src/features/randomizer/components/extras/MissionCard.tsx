import { AnimatePresence, motion } from 'framer-motion'
import { Shuffle, Target } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { playSfx } from '@/lib/audio/sfx'
import { cn } from '@/lib/utils'

interface MissionCardProps {
  challenge: string
  /** Offer "สุ่มใหม่" (only when the list has another mission to give). */
  onReroll?: () => void
  reduced?: boolean
  compact?: boolean
}

/** Random Challenge: the mission the winner has to do. */
export function MissionCard({ challenge, onReroll, reduced = false, compact = false }: MissionCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-neon-violet/45 bg-neon-violet/12 text-left shadow-[0_0_28px_-10px_var(--neon-violet)]',
        compact ? 'p-2.5' : 'p-3',
      )}
    >
      <div className="flex items-center gap-2">
        <Target className="size-4 shrink-0 text-neon-violet" aria-hidden />
        <p className="hud-label text-[#c4b5fd]">Mission</p>
        {onReroll ? (
          <Button
            variant="ghost"
            size="sm"
            className="-my-1 ml-auto"
            onClick={() => {
              playSfx('tick')
              onReroll()
            }}
          >
            <Shuffle aria-hidden />
            สุ่มภารกิจใหม่
          </Button>
        ) : null}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={challenge}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className={cn(
            'mt-1 leading-snug font-bold break-words',
            compact ? 'line-clamp-3 text-sm' : 'text-[clamp(1.05rem,3.4cqmin,1.75rem)]',
          )}
          data-testid="winner-challenge"
          aria-live="polite"
        >
          {challenge}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
