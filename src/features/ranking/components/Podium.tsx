import { motion } from 'framer-motion'
import { Crown, Star } from 'lucide-react'

import { StudentAvatar } from '@/components/common/StudentAvatar'
import type { NameFormat } from '@/data/settings'
import { getDisplayName } from '@/features/students/lib/names'
import { cn } from '@/lib/utils'

import type { RankingEntry } from '../lib/ranking'

/** Pedestal height and accent per place. */
const PLACES: Record<number, { height: string; ring: string; tone: string }> = {
  1: { height: 'h-28 sm:h-32', ring: 'ring-neon-gold', tone: 'from-neon-gold/45 to-neon-gold/5 border-neon-gold/60' },
  2: { height: 'h-20 sm:h-24', ring: 'ring-neon-cyan', tone: 'from-neon-cyan/35 to-neon-cyan/5 border-neon-cyan/50' },
  3: { height: 'h-14 sm:h-18', ring: 'ring-neon-pink', tone: 'from-neon-pink/35 to-neon-pink/5 border-neon-pink/50' },
}

interface PodiumProps {
  leaders: readonly RankingEntry[]
  nameFormat: NameFormat
  reduced: boolean
}

/** The top three, second-first-third like a real podium. Shared places stand at the same height. */
export function Podium({ leaders, nameFormat, reduced }: PodiumProps) {
  const top = leaders.slice(0, 3)
  // Visual order: 2nd, 1st, 3rd.
  const order = [top[1], top[0], top[2]].filter((entry): entry is RankingEntry => entry !== undefined)

  return (
    <ol className="flex items-end justify-center gap-2 sm:gap-4" aria-label="สามอันดับแรก" data-testid="podium">
      {order.map((entry, position) => {
        const place = PLACES[Math.min(entry.rank, 3)] ?? PLACES[3]
        const first = entry.rank === 1
        return (
          <motion.li
            key={entry.student.id}
            initial={reduced ? false : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22, delay: reduced ? 0 : 0.12 * (2 - position) }}
            className="flex w-[min(10rem,32%)] flex-col items-center gap-2"
          >
            <div className="relative">
              {first ? (
                <Crown
                  className="absolute -top-6 left-1/2 size-7 -translate-x-1/2 fill-neon-gold/40 text-neon-gold drop-shadow-[0_0_10px_rgb(251_191_36/0.7)]"
                  aria-hidden
                />
              ) : null}
              <StudentAvatar
                avatar={entry.student.avatar}
                seed={entry.student.id}
                className={cn(
                  'ring-4 ring-offset-4 ring-offset-ink',
                  place?.ring,
                  first ? 'size-20 sm:size-24 immersive:size-32' : 'size-16 sm:size-20 immersive:size-24',
                )}
              />
            </div>
            <p className="max-w-full truncate text-center text-lg font-extrabold immersive:text-2xl">
              {getDisplayName(entry.student, nameFormat)}
            </p>
            <p className="flex items-center gap-1 text-lg font-bold">
              <Star className="size-5 fill-neon-gold text-neon-gold" aria-hidden />
              <span className="tabular">{entry.stars}</span>
              <span className="sr-only">ดาว</span>
            </p>
            <div
              className={cn(
                'flex w-full items-start justify-center rounded-t-2xl border border-b-0 bg-linear-to-b pt-2',
                place?.height,
                place?.tone,
              )}
            >
              <span className="tabular text-3xl font-extrabold text-foreground/90 immersive:text-4xl">
                <span className="sr-only">อันดับ </span>
                {entry.rank}
              </span>
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}
