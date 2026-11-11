const MAX_DPR = 2
const COLORS = ['#8B5CF6', '#22D3EE', '#EC4899', '#A3E635', '#FBBF24', '#F8FAFC'] as const
/** Hard cap on live pieces, so repeated bursts can never pile up into a slow frame. */
const MAX_PIECES = 600

interface Piece {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rotation: number
  spin: number
  /** Phase of the flutter that makes a piece look like it is tumbling. */
  flutter: number
  flutterSpeed: number
  color: string
  round: boolean
  age: number
  lifetime: number
}

export interface BurstOptions {
  /** Origin as a fraction of the canvas (0–1). */
  x: number
  y: number
  /** Launch direction in radians (0 = right, -π/2 = up). */
  angle: number
  /** Half-width of the launch cone in radians. */
  spread: number
  count: number
  /** Launch speed as a fraction of the canvas height per second. */
  power?: number
}

/**
 * Lightweight confetti on a single canvas. The animation loop only runs while pieces are
 * alive, and stops by itself when the last one has fallen out of view.
 */
export class ConfettiEngine {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D | null
  private pieces: Piece[] = []
  private width = 0
  private height = 0
  private dpr = 1
  private frame = 0
  private last = 0
  private running = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
  }

  /** Match the backing store to the element's current size. Call before a burst. */
  resize(): void {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    if (width === this.width && height === this.height) return
    this.width = width
    this.height = height
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    this.canvas.width = Math.round(width * this.dpr)
    this.canvas.height = Math.round(height * this.dpr)
  }

  burst({ x, y, angle, spread, count, power = 1.5 }: BurstOptions): void {
    if (!this.ctx || this.width === 0 || this.height === 0) return
    const room = MAX_PIECES - this.pieces.length
    const total = Math.max(0, Math.min(count, room))
    const scale = Math.max(this.width, this.height) / 900
    for (let i = 0; i < total; i += 1) {
      const direction = angle + (Math.random() - 0.5) * 2 * spread
      const speed = this.height * power * (0.45 + Math.random() * 0.75)
      this.pieces.push({
        x: x * this.width,
        y: y * this.height,
        vx: Math.cos(direction) * speed,
        vy: Math.sin(direction) * speed,
        size: (7 + Math.random() * 7) * Math.max(0.8, scale),
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 14,
        flutter: Math.random() * Math.PI * 2,
        flutterSpeed: 6 + Math.random() * 8,
        color: COLORS[Math.floor(Math.random() * COLORS.length)] as string,
        round: Math.random() < 0.25,
        age: 0,
        lifetime: 2.4 + Math.random() * 1.6,
      })
    }
    if (!this.running && this.pieces.length > 0) {
      this.running = true
      this.last = performance.now()
      this.frame = requestAnimationFrame(this.tick)
    }
  }

  /** Remove everything immediately. */
  clear(): void {
    this.pieces = []
    this.ctx?.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  dispose(): void {
    cancelAnimationFrame(this.frame)
    this.running = false
    this.pieces = []
  }

  private readonly tick = (now: number): void => {
    const ctx = this.ctx
    if (!ctx) return
    const dt = Math.min(0.04, (now - this.last) / 1000)
    this.last = now
    const gravity = this.height * 2.1
    // Air drag: fast pieces slow down quickly, then drift.
    const drag = Math.exp(-1.9 * dt)

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)

    let alive = 0
    for (const piece of this.pieces) {
      piece.age += dt
      piece.vx *= drag
      piece.vy = piece.vy * drag + gravity * dt
      piece.flutter += piece.flutterSpeed * dt
      piece.x += (piece.vx + Math.sin(piece.flutter) * 40) * dt
      piece.y += piece.vy * dt
      piece.rotation += piece.spin * dt
      if (piece.age >= piece.lifetime || piece.y > this.height + 40) continue

      // Keep the survivors at the front of the array (in-place compaction, no allocation).
      this.pieces[alive] = piece
      alive += 1

      const fade = Math.min(1, (piece.lifetime - piece.age) / 0.5)
      ctx.globalAlpha = fade
      ctx.fillStyle = piece.color
      ctx.save()
      ctx.translate(piece.x, piece.y)
      ctx.rotate(piece.rotation)
      // Squash along one axis to fake a paper strip turning in the air.
      ctx.scale(1, Math.cos(piece.flutter))
      if (piece.round) {
        ctx.beginPath()
        ctx.arc(0, 0, piece.size / 2.4, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2)
      }
      ctx.restore()
    }
    this.pieces.length = alive
    ctx.globalAlpha = 1

    if (alive === 0) {
      this.running = false
      ctx.clearRect(0, 0, this.width, this.height)
      return
    }
    this.frame = requestAnimationFrame(this.tick)
  }
}
