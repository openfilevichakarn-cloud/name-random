import { motion } from 'framer-motion'
import { Gift, PartyPopper } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { playSfx } from '@/lib/audio/sfx'

interface SurpriseGiftProps {
  reward: string
  reduced?: boolean
}

/** Surprise Reward: a gift box the class opens together. */
export function SurpriseGift({ reward, reduced = false }: SurpriseGiftProps) {
  const [open, setOpen] = useState(false)
  const revealedRef = useRef<HTMLDivElement>(null)

  // The button disappears when the box opens: move keyboard focus to what replaced it.
  useEffect(() => {
    if (open) revealedRef.current?.focus({ preventScroll: true })
  }, [open])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          playSfx('confetti')
        }}
        className="flex w-full items-center gap-3 rounded-2xl border border-neon-lime/50 bg-neon-lime/10 p-3 text-left transition-colors outline-none hover:bg-neon-lime/18 focus-visible:ring-4 focus-visible:ring-neon-lime/40"
        data-testid="surprise-gift"
      >
        <motion.span
          aria-hidden
          animate={reduced ? undefined : { rotate: [0, -14, 12, -8, 6, 0], scale: [1, 1.08, 1] }}
          transition={reduced ? undefined : { duration: 0.7, repeat: Infinity, repeatDelay: 1.1 }}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-neon-lime/20 text-neon-lime"
        >
          <Gift className="size-6" />
        </motion.span>
        <span className="min-w-0">
          <span className="block font-bold text-neon-lime">มีรางวัลเซอร์ไพรส์!</span>
          <span className="block text-sm text-muted-foreground">แตะเพื่อเปิดกล่องรางวัล</span>
        </span>
      </button>
    )
  }

  return (
    <motion.div
      ref={revealedRef}
      tabIndex={-1}
      role="status"
      initial={reduced ? false : { scale: 0.5, opacity: 0, rotate: -6 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 15 }}
      className="flex w-full items-center gap-3 rounded-2xl border border-neon-lime/60 bg-neon-lime/15 p-3 text-left shadow-[0_0_32px_-8px_var(--neon-lime)] outline-none"
    >
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-neon-lime/25 text-neon-lime"
        aria-hidden
      >
        <PartyPopper className="size-6" />
      </span>
      <span className="min-w-0">
        <span className="hud-label block text-neon-lime">Surprise Reward</span>
        <span className="block text-lg leading-snug font-bold break-words" data-testid="winner-reward">
          {reward}
        </span>
      </span>
    </motion.div>
  )
}
