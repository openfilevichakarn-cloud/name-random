import { motion } from 'framer-motion'
import { ChevronRight, Trophy, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { StudentAvatar } from '@/components/common/StudentAvatar'
import { Button } from '@/components/ui/button'
import { playSfx } from '@/lib/audio/sfx'

import type { Candidate } from '../engine/types'

interface DrawSummaryProps {
  winners: readonly Candidate[]
  /** Fewer winners than requested were available. */
  clamped: boolean
  reduced: boolean
  canDrawAgain: boolean
  onAgain: () => void
  onClose: () => void
}

/** Final screen of a multiple draw: everyone who was picked, in order. */
export function DrawSummary({ winners, clamped, reduced, canDrawAgain, onAgain, onClose }: DrawSummaryProps) {
  const primaryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    playSfx('winner')
    const focus = setTimeout(() => primaryRef.current?.focus({ preventScroll: true }), 300)
    return () => clearTimeout(focus)
  }, [])

  return (
    <motion.div
      className="absolute inset-0 z-30 flex flex-col items-center gap-3 overflow-y-auto rounded-[inherit] bg-ink/94 p-4 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      data-testid="draw-summary"
    >
      <p className="hud-label mt-auto flex items-center gap-2 text-neon-gold">
        <Trophy className="size-4" aria-hidden />
        Winners
      </p>
      <h2 className="text-[clamp(1.4rem,6cqmin,3rem)] leading-tight font-extrabold" role="status" aria-live="assertive">
        ผู้ถูกเลือก <span className="text-gradient-gold tabular">{winners.length}</span> คน
      </h2>
      {clamped ? <p className="text-sm text-neon-gold">มีผู้เข้าร่วมเหลือน้อยกว่าจำนวนที่ตั้งไว้</p> : null}

      <ol className="flex w-full flex-wrap items-stretch justify-center gap-2.5">
        {winners.map((winner, index) => (
          <motion.li
            key={winner.id}
            initial={reduced ? false : { opacity: 0, scale: 0.6, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 24, delay: reduced ? 0 : index * 0.07 }}
            className="glass flex w-[min(10.5rem,44%)] flex-col items-center gap-1.5 rounded-2xl border-neon-gold/50 p-3"
          >
            <span className="tabular hud-label text-neon-cyan">#{index + 1}</span>
            {winner.avatar ? <StudentAvatar avatar={winner.avatar} seed={winner.id} className="size-14" /> : null}
            <span
              className={winner.avatar ? 'max-w-full truncate font-bold' : 'tabular text-3xl font-extrabold text-neon-gold'}
            >
              {winner.label}
            </span>
            {winner.avatar && winner.number !== null ? (
              <span className="tabular text-xs text-muted-foreground">เลขที่ {winner.number}</span>
            ) : winner.detail ? (
              <span className="max-w-full truncate text-xs text-muted-foreground">{winner.detail}</span>
            ) : null}
          </motion.li>
        ))}
      </ol>

      <div className="mb-auto flex flex-wrap items-center justify-center gap-2.5 pt-1">
        {canDrawAgain ? (
          <Button ref={primaryRef} variant="neon" size="lg" onClick={onAgain}>
            สุ่มอีกครั้ง
            <ChevronRight aria-hidden />
          </Button>
        ) : null}
        <Button ref={canDrawAgain ? undefined : primaryRef} variant="ghost" onClick={onClose}>
          <X aria-hidden />
          ปิด
        </Button>
      </div>
    </motion.div>
  )
}
