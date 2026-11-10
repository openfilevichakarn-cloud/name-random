import type { Candidate } from '../../engine/types'
import { stageColor } from '../types'

const INK = '#0B1020'
const SEGMENT_TONES = ['#1B2048', '#141838'] as const
const TEXT = '#F8FAFC'
const FONT_FAMILY = 'Prompt, "Noto Sans Thai", sans-serif'
const MIN_FONT = 9
const MAX_FONT = 34
/** Above this many segments the 1px separators would merge into a solid ring. */
const MAX_SEPARATORS = 160

function rgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`
}

function graphemes(text: string): string[] {
  if (typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(text), (part) => part.segment)
  }
  return Array.from(text)
}

/** Shorten `text` with an ellipsis until it fits, cutting only between whole Thai characters. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  const parts = graphemes(text)
  while (parts.length > 1) {
    parts.pop()
    const candidate = `${parts.join('')}…`
    if (ctx.measureText(candidate).width <= maxWidth) return candidate
  }
  return parts.join('')
}

export interface DrawWheelOptions {
  /** CSS pixel size of the (square) canvas. */
  size: number
  /** Device pixel ratio the backing store was created with. */
  dpr: number
  candidates: readonly Candidate[]
  /** Segment to light up after the wheel has stopped; the rest is dimmed. */
  highlightId?: string | null
}

/**
 * Paint the wheel face. It is drawn once per pool change and then only rotated by the GPU,
 * so the spin itself costs no canvas work.
 */
export function drawWheel(ctx: CanvasRenderingContext2D, options: DrawWheelOptions): void {
  const { size, dpr, candidates, highlightId = null } = options
  const count = candidates.length
  const radius = size / 2

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, size, size)
  ctx.translate(radius, radius)

  if (count === 0) {
    ctx.fillStyle = SEGMENT_TONES[0]
    ctx.beginPath()
    ctx.arc(0, 0, radius, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  const arc = (Math.PI * 2) / count
  const band = Math.max(3, radius * 0.045)
  const hubRadius = radius * 0.2

  for (let i = 0; i < count; i += 1) {
    const candidate = candidates[i] as Candidate
    const start = i * arc
    const end = start + arc
    const color = stageColor(i, count)
    const isWinner = highlightId !== null && candidate.id === highlightId

    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, radius, start, end)
    ctx.closePath()
    ctx.fillStyle = SEGMENT_TONES[i % 2] as string
    ctx.fill()

    // Colour glow rising towards the rim; labels stay on the dark inner part for contrast.
    const glow = ctx.createRadialGradient(0, 0, radius * 0.5, 0, 0, radius)
    glow.addColorStop(0, rgba(color, isWinner ? 0.35 : 0))
    glow.addColorStop(1, rgba(color, isWinner ? 0.95 : 0.5))
    ctx.fillStyle = glow
    ctx.fill()

    if (highlightId !== null && !isWinner) {
      ctx.fillStyle = rgba(INK, 0.62)
      ctx.fill()
    }

    ctx.beginPath()
    ctx.arc(0, 0, radius - band / 2, start, end)
    ctx.lineWidth = band
    ctx.strokeStyle = highlightId !== null && !isWinner ? rgba(color, 0.35) : color
    ctx.stroke()
  }

  if (count > 1 && count <= MAX_SEPARATORS) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i < count; i += 1) {
      const angle = i * arc
      ctx.moveTo(Math.cos(angle) * hubRadius, Math.sin(angle) * hubRadius)
      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
    }
    ctx.stroke()
  }

  // Labels run along the radius and end near the rim, so the one under the pointer reads left to right.
  const chord = arc * radius * 0.7
  const fontSize = Math.min(MAX_FONT, radius * 0.09, chord * 0.56)
  if (fontSize >= MIN_FONT) {
    const maxWidth = radius * 0.56
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.font = `600 ${fontSize}px ${FONT_FAMILY}`
    for (let i = 0; i < count; i += 1) {
      const candidate = candidates[i] as Candidate
      const dimmed = highlightId !== null && candidate.id !== highlightId
      ctx.save()
      ctx.rotate(i * arc + arc / 2)
      ctx.fillStyle = dimmed ? 'rgba(248, 250, 252, 0.4)' : TEXT
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
      ctx.shadowBlur = 4
      ctx.fillText(fitText(ctx, candidate.label, maxWidth), radius * 0.86, 0)
      ctx.restore()
    }
  }

  // Dark centre behind the hub button.
  ctx.beginPath()
  ctx.arc(0, 0, hubRadius, 0, Math.PI * 2)
  ctx.fillStyle = INK
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(148, 163, 255, 0.35)'
  ctx.stroke()
}
