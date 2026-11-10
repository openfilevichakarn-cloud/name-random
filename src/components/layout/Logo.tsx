import { useId } from 'react'

import { cn } from '@/lib/utils'

interface LogoMarkProps {
  className?: string
}

/** Brand mark: a neon dice face with a spark. */
export function LogoMark({ className }: LogoMarkProps) {
  const gradientId = useId()
  return (
    <svg viewBox="0 0 64 64" fill="none" className={cn('size-10', className)} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22D3EE" />
          <stop offset="0.5" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#EC4899" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="16" fill="#0B1020" />
      <rect x="6.5" y="6.5" width="51" height="51" rx="13.5" stroke={`url(#${gradientId})`} strokeWidth="3" />
      <circle cx="22" cy="22" r="5" fill="#22D3EE" />
      <circle cx="32" cy="32" r="5" fill="#F8FAFC" />
      <circle cx="42" cy="42" r="5" fill="#EC4899" />
      <path d="M42 17l1.8 4.2L48 23l-4.2 1.8L42 29l-1.8-4.2L36 23l4.2-1.8L42 17z" fill="#FBBF24" />
    </svg>
  )
}

interface LogoProps {
  className?: string
  /** Hide the wordmark and show only the mark. */
  compact?: boolean
}

export function Logo({ className, compact = false }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <LogoMark />
      {compact ? (
        <span className="sr-only">NEXT-GEN STUDENT RANDOMIZER</span>
      ) : (
        <span className="flex flex-col leading-none">
          <span className="hud-label text-neon-cyan">Next-Gen Student</span>
          <span className="text-gradient mt-1 text-lg font-extrabold tracking-wide">RANDOMIZER</span>
        </span>
      )}
    </span>
  )
}
