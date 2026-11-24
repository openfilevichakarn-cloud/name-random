/** Racer drawings, all facing right (the direction of the race). `color` is the racer's team colour. */

interface RacerProps {
  color: string
  className?: string
}

export function KartRacer({ color, className }: RacerProps) {
  return (
    <svg viewBox="0 0 80 40" className={className} aria-hidden>
      {/* rear spoiler */}
      <rect x="4" y="9" width="5" height="16" rx="1.5" fill="#1e1b4b" />
      <rect x="2" y="8" width="12" height="4" rx="1.5" fill={color} />
      {/* body */}
      <path d="M8 24 Q10 17 22 17 L50 17 Q60 17 68 21 L76 24 Q78 28 74 29 L10 29 Q6 29 8 24 Z" fill={color} />
      <path d="M22 17 L50 17 Q56 17 60 19 L24 21 Z" fill="#ffffff" opacity="0.35" />
      {/* number plate */}
      <circle cx="58" cy="24" r="4" fill="#ffffff" />
      {/* driver */}
      <rect x="31" y="11" width="12" height="9" rx="3" fill="#0b1020" />
      <circle cx="37" cy="9" r="7" fill="#f8fafc" />
      <path d="M37 4 A6 6 0 0 1 43 9 L37 9 Z" fill={color} />
      <rect x="38" y="7" width="6" height="3.2" rx="1.4" fill="#0b1020" />
      {/* wheels */}
      <circle cx="18" cy="30" r="7.5" fill="#0b1020" />
      <circle cx="18" cy="30" r="3" fill="#94a3b8" />
      <circle cx="64" cy="31" r="6.5" fill="#0b1020" />
      <circle cx="64" cy="31" r="2.6" fill="#94a3b8" />
    </svg>
  )
}

export function DuckRacer({ color, className }: RacerProps) {
  return (
    <svg viewBox="0 0 80 40" className={className} aria-hidden>
      {/* tail */}
      <path d="M10 22 L2 12 L16 18 Z" fill={color} />
      {/* body */}
      <ellipse cx="34" cy="26" rx="26" ry="11" fill={color} />
      <ellipse cx="32" cy="23" rx="12" ry="6" fill="#ffffff" opacity="0.3" />
      {/* wing */}
      <path d="M22 22 Q34 14 44 24 Q34 30 22 22 Z" fill="#0b1020" opacity="0.18" />
      {/* head */}
      <circle cx="56" cy="13" r="9.5" fill={color} />
      <circle cx="59" cy="11" r="2.2" fill="#0b1020" />
      <circle cx="59.6" cy="10.4" r="0.7" fill="#ffffff" />
      {/* beak */}
      <path d="M64 13 L76 15 Q72 19 63 17 Z" fill="#f97316" />
      {/* water line */}
      <path d="M4 33 Q12 30 20 33 T36 33 T52 33 T68 33" fill="none" stroke="#e0f2fe" strokeWidth="2" opacity="0.8" />
    </svg>
  )
}

/** Thai long-tail boat (เรือหางยาว): long wooden hull, garlands at the bow, long-shaft engine at the stern. */
export function LongTailBoatRacer({ color, className }: RacerProps) {
  return (
    <svg viewBox="0 0 96 40" className={className} aria-hidden>
      {/* long propeller shaft trailing behind, with spray */}
      <path d="M22 22 L2 31" stroke="#475569" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M0 29 L5 33 M1 34 L4 28" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="3" cy="35" r="3" fill="#e0f2fe" opacity="0.7" />
      <circle cx="9" cy="36" r="2" fill="#e0f2fe" opacity="0.55" />
      {/* engine */}
      <rect x="18" y="14" width="12" height="9" rx="2" fill="#334155" />
      <rect x="20" y="11" width="6" height="4" rx="1" fill="#64748b" />
      {/* driver */}
      <circle cx="32" cy="8" r="3.6" fill="#7c2d12" />
      <path d="M28 5 Q32 1 36 5 Z" fill="#facc15" />
      <rect x="30" y="11" width="5" height="10" rx="2" fill={color} />
      {/* hull: dark wood with a colour stripe, bow curving up */}
      <path d="M14 22 L76 22 Q86 20 92 8 Q93 16 88 24 Q80 32 66 32 L22 32 Q14 30 14 22 Z" fill="#78350f" />
      <path d="M16 25 L80 25 Q86 23 90 16" fill="none" stroke={color} strokeWidth="2.6" />
      <path d="M22 30 L70 30" stroke="#451a03" strokeWidth="1.4" />
      {/* garlands and ribbons at the bow (พวงมาลัย / ผ้าแพร) */}
      <path d="M90 9 L95 4" stroke="#f472b6" strokeWidth="2" strokeLinecap="round" />
      <circle cx="90" cy="10" r="2.6" fill="#facc15" />
      <circle cx="86.5" cy="13" r="2.2" fill="#f472b6" />
      <circle cx="84" cy="16" r="2" fill="#a3e635" />
      <path d="M92 8 Q96 14 93 20" fill="none" stroke="#ef4444" strokeWidth="1.5" />
      {/* wake */}
      <path d="M20 35 Q40 33 60 35 T96 35" fill="none" stroke="#e0f2fe" strokeWidth="1.6" opacity="0.6" />
    </svg>
  )
}
