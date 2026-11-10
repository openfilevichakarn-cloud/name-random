import { memo, type ReactNode } from 'react'

import { getBotTraits, getEmojiBackground, parseAvatar, type BotTraits } from '@/features/students/lib/avatar'
import { cn } from '@/lib/utils'

const SCREEN = '#0B1020'

interface HeadBox {
  x: number
  y: number
  w: number
  h: number
  rx: number
}

const HEADS: readonly HeadBox[] = [
  { x: 20, y: 30, w: 60, h: 50, rx: 16 },
  { x: 22, y: 28, w: 56, h: 54, rx: 26 },
  { x: 17, y: 32, w: 66, h: 46, rx: 12 },
  { x: 24, y: 28, w: 52, h: 54, rx: 10 },
]

function Antenna({ variant, top, led, head }: { variant: number; top: number; led: string; head: string }) {
  switch (variant) {
    case 1:
      return (
        <>
          <line x1="50" y1={top} x2="50" y2={top - 12} stroke={head} strokeWidth="3" strokeLinecap="round" />
          <circle cx="50" cy={top - 15} r="4.5" fill={led} />
        </>
      )
    case 2:
      return (
        <>
          <line x1="38" y1={top + 1} x2="35" y2={top - 9} stroke={head} strokeWidth="3" strokeLinecap="round" />
          <line x1="62" y1={top + 1} x2="65" y2={top - 9} stroke={head} strokeWidth="3" strokeLinecap="round" />
          <circle cx="34.5" cy={top - 11.5} r="3.4" fill={led} />
          <circle cx="65.5" cy={top - 11.5} r="3.4" fill={led} />
        </>
      )
    case 3:
      return (
        <polyline
          points={`50,${top} 45,${top - 7} 55,${top - 9} 50,${top - 17}`}
          fill="none"
          stroke={led}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    case 4:
      return (
        <>
          <line x1="50" y1={top} x2="50" y2={top - 8} stroke={head} strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="50" cy={top - 12} rx="12" ry="3.6" fill="none" stroke={led} strokeWidth="2.6" />
        </>
      )
    default:
      return null
  }
}

function Ears({ variant, box, head, led }: { variant: number; box: HeadBox; head: string; led: string }) {
  const cy = box.y + box.h / 2
  if (variant === 1) {
    return (
      <>
        <rect x={box.x - 7} y={cy - 8} width="9" height="16" rx="3.5" fill={head} />
        <rect x={box.x + box.w - 2} y={cy - 8} width="9" height="16" rx="3.5" fill={head} />
      </>
    )
  }
  if (variant === 2) {
    return (
      <>
        <circle cx={box.x - 1} cy={cy} r="6.5" fill={head} />
        <circle cx={box.x + box.w + 1} cy={cy} r="6.5" fill={head} />
        <circle cx={box.x - 1} cy={cy} r="2.6" fill={led} />
        <circle cx={box.x + box.w + 1} cy={cy} r="2.6" fill={led} />
      </>
    )
  }
  return null
}

function Eyes({ variant, cy, led, screen }: { variant: number; cy: number; led: string; screen: HeadBox }) {
  const left = 39
  const right = 61
  const arc = (cx: number) => `M ${cx - 5} ${cy + 2} Q ${cx} ${cy - 6} ${cx + 5} ${cy + 2}`
  switch (variant) {
    case 1:
      return (
        <>
          <rect x={screen.x + 5} y={cy - 4} width={screen.w - 10} height="8" rx="4" fill={led} opacity="0.28" />
          <circle cx={left} cy={cy} r="2.6" fill={led} />
          <circle cx={right} cy={cy} r="2.6" fill={led} />
        </>
      )
    case 2:
      return (
        <>
          <rect x={left - 4} y={cy - 4} width="8" height="8" rx="1.8" fill={led} />
          <rect x={right - 4} y={cy - 4} width="8" height="8" rx="1.8" fill={led} />
        </>
      )
    case 3:
      return (
        <>
          <path d={arc(left)} fill="none" stroke={led} strokeWidth="3" strokeLinecap="round" />
          <path d={arc(right)} fill="none" stroke={led} strokeWidth="3" strokeLinecap="round" />
        </>
      )
    case 4:
      return (
        <>
          <circle cx="50" cy={cy} r="7" fill={led} />
          <circle cx="51.5" cy={cy - 0.5} r="2.8" fill={SCREEN} />
        </>
      )
    case 5:
      return (
        <>
          <line x1={left - 5} y1={cy} x2={left + 5} y2={cy} stroke={led} strokeWidth="3.2" strokeLinecap="round" />
          <line x1={right - 5} y1={cy} x2={right + 5} y2={cy} stroke={led} strokeWidth="3.2" strokeLinecap="round" />
        </>
      )
    case 6:
      return (
        <>
          <circle cx={left} cy={cy} r="4.4" fill={led} />
          <path d={arc(right)} fill="none" stroke={led} strokeWidth="3" strokeLinecap="round" />
        </>
      )
    default:
      return (
        <>
          <circle cx={left} cy={cy} r="4.4" fill={led} />
          <circle cx={right} cy={cy} r="4.4" fill={led} />
        </>
      )
  }
}

function Mouth({ variant, cy, led }: { variant: number; cy: number; led: string }) {
  switch (variant) {
    case 0:
      return (
        <path
          d={`M 43 ${cy - 1} Q 50 ${cy + 5} 57 ${cy - 1}`}
          fill="none"
          stroke={led}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      )
    case 1:
      return (
        <>
          <rect x="43" y={cy - 2.5} width="2.4" height="5" rx="1" fill={led} />
          <rect x="48.8" y={cy - 2.5} width="2.4" height="5" rx="1" fill={led} />
          <rect x="54.6" y={cy - 2.5} width="2.4" height="5" rx="1" fill={led} />
        </>
      )
    case 2:
      return <line x1="44" y1={cy} x2="56" y2={cy} stroke={led} strokeWidth="2.6" strokeLinecap="round" />
    case 3:
      return <circle cx="50" cy={cy} r="2.8" fill={led} />
    case 4:
      return (
        <polyline
          points={`42,${cy} 46,${cy - 2.5} 50,${cy + 1.5} 54,${cy - 2.5} 58,${cy}`}
          fill="none"
          stroke={led}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    default:
      return null
  }
}

function BotFace({ traits }: { traits: BotTraits }) {
  const box = HEADS[traits.headShape % HEADS.length] as HeadBox
  const screen: HeadBox = { x: box.x + 7, y: box.y + 9, w: box.w - 14, h: box.h - 21, rx: 9 }
  const eyeY = screen.y + screen.h * 0.4
  const mouthY = screen.y + screen.h * 0.78

  return (
    <svg viewBox="0 0 100 100" className="size-full" aria-hidden>
      {/* Shoulders peeking in from the bottom edge */}
      <rect x="27" y="85" width="46" height="24" rx="13" fill={traits.head} opacity="0.88" />
      <rect x="44" y={box.y + box.h - 3} width="12" height="10" fill={traits.head} opacity="0.7" />
      <Antenna variant={traits.antenna} top={box.y} led={traits.led} head={traits.head} />
      <Ears variant={traits.ears} box={box} head={traits.head} led={traits.led} />
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={box.rx} fill={traits.head} />
      <ellipse cx={box.x + box.w * 0.3} cy={box.y + 5} rx={box.w * 0.18} ry="2.2" fill="#fff" opacity="0.7" />
      <rect x={screen.x} y={screen.y} width={screen.w} height={screen.h} rx={screen.rx} fill={SCREEN} />
      <Eyes variant={traits.eyes} cy={eyeY} led={traits.led} screen={screen} />
      <Mouth variant={traits.mouth} cy={mouthY} led={traits.led} />
      {traits.blush ? (
        <>
          <circle cx={screen.x + 5} cy={mouthY - 1} r="2.6" fill="#F472B6" opacity="0.75" />
          <circle cx={screen.x + screen.w - 5} cy={mouthY - 1} r="2.6" fill="#F472B6" opacity="0.75" />
        </>
      ) : null}
    </svg>
  )
}

export interface StudentAvatarProps {
  /** Encoded avatar (`bot:…` / `emoji:…`). Empty or invalid values fall back to a bot built from `seed`. */
  avatar: string | null | undefined
  /** Stable fallback seed — normally the student id. */
  seed: string
  /** Sizing/shape classes, e.g. `size-10`. */
  className?: string
  /** When set the avatar is announced as an image; otherwise it is decorative. */
  label?: string
}

/** Generated avatar: a procedural robot or an emoji on a neon gradient tile. */
export const StudentAvatar = memo(function StudentAvatar({ avatar, seed, className, label }: StudentAvatarProps) {
  const spec = parseAvatar(avatar, seed)
  let background: readonly [string, string]
  let content: ReactNode

  if (spec.kind === 'bot') {
    const traits = getBotTraits(spec.seed)
    background = traits.background
    content = <BotFace traits={traits} />
  } else {
    background = getEmojiBackground(spec.emoji)
    content = (
      <svg viewBox="0 0 100 100" className="size-full" aria-hidden>
        <text x="50" y="54" fontSize="58" textAnchor="middle" dominantBaseline="middle">
          {spec.emoji}
        </text>
      </svg>
    )
  }

  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        'relative inline-block size-10 shrink-0 overflow-hidden rounded-[28%] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.22)]',
        className,
      )}
      style={{ backgroundImage: `linear-gradient(145deg, ${background[0]}, ${background[1]})` }}
    >
      {content}
    </span>
  )
})
