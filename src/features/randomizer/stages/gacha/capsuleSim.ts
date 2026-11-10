import { STAGE_COLORS } from '../types'

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  angle: number
}

const MAX_DPR = 2
const RESTITUTION = 0.5
/** Frames of near-stillness before the loop stops, so an idle machine costs nothing. */
const SLEEP_FRAMES = 45
export const MAX_CAPSULES = 18

/**
 * Tiny 2D physics toy for the capsules inside the gacha dome: gravity, a circular wall and
 * ball-to-ball collisions. Purely decorative — it has no influence on who is drawn.
 */
export class CapsuleSim {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D | null
  private balls: Ball[] = []
  private size = 0
  private dpr = 1
  private frame = 0
  private last = 0
  private stillFrames = 0
  private agitating = false
  private running = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
  }

  /** Set the CSS pixel size of the (square) dome. */
  resize(size: number): void {
    if (size <= 0 || Math.abs(size - this.size) < 0.5) return
    const ratio = this.size > 0 ? size / this.size : 1
    this.size = size
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    this.canvas.width = Math.round(size * this.dpr)
    this.canvas.height = Math.round(size * this.dpr)
    for (const ball of this.balls) {
      ball.x *= ratio
      ball.y *= ratio
      ball.radius *= ratio
    }
    this.wake()
  }

  /** Show `count` capsules (capped), adding or removing as needed. */
  setCount(count: number): void {
    const target = Math.max(0, Math.min(MAX_CAPSULES, Math.floor(count)))
    if (this.size <= 0) return
    const radius = this.ballRadius(target)
    for (const ball of this.balls) ball.radius = radius
    while (this.balls.length > target) this.balls.pop()
    while (this.balls.length < target) {
      const index = this.balls.length
      this.balls.push({
        x: this.size * (0.3 + Math.random() * 0.4),
        y: this.size * (0.15 + Math.random() * 0.3),
        vx: (Math.random() - 0.5) * this.size,
        vy: 0,
        radius,
        color: STAGE_COLORS[index % STAGE_COLORS.length] as string,
        angle: Math.random() * Math.PI * 2,
      })
    }
    this.wake()
  }

  /** Stir the capsules (while the crank is turning). */
  setAgitating(on: boolean): void {
    this.agitating = on
    if (on) this.wake()
  }

  /** Take one capsule out (the one that drops into the tray) and return its colour. */
  removeOne(): string {
    // Prefer the lowest capsule: it is the one nearest to the chute.
    let lowest = -1
    for (let i = 0; i < this.balls.length; i += 1) {
      if (lowest < 0 || (this.balls[i] as Ball).y > (this.balls[lowest] as Ball).y) lowest = i
    }
    const [removed] = lowest >= 0 ? this.balls.splice(lowest, 1) : []
    this.wake()
    return removed?.color ?? (STAGE_COLORS[0] as string)
  }

  dispose(): void {
    cancelAnimationFrame(this.frame)
    this.running = false
  }

  private ballRadius(count: number): number {
    const dome = this.size / 2
    return dome * Math.min(0.21, Math.sqrt(0.4 / Math.max(1, count)))
  }

  private wake(): void {
    this.stillFrames = 0
    if (this.running) return
    this.running = true
    this.last = performance.now()
    this.frame = requestAnimationFrame(this.tick)
  }

  private readonly tick = (now: number): void => {
    const dt = Math.min(1 / 30, (now - this.last) / 1000)
    this.last = now
    this.step(dt)
    this.draw()

    const energy = this.balls.reduce((sum, ball) => sum + Math.abs(ball.vx) + Math.abs(ball.vy), 0)
    this.stillFrames = !this.agitating && energy < this.balls.length * this.size * 0.02 ? this.stillFrames + 1 : 0
    if (this.stillFrames > SLEEP_FRAMES || document.hidden) {
      this.running = false
      return
    }
    this.frame = requestAnimationFrame(this.tick)
  }

  private step(dt: number): void {
    const size = this.size
    const center = size / 2
    const gravity = size * 5

    for (const ball of this.balls) {
      ball.vy += gravity * dt
      if (this.agitating) {
        // A swirl around the centre plus random upward kicks, like a rotating paddle.
        const dx = ball.x - center
        const dy = ball.y - center
        const distance = Math.hypot(dx, dy) || 1
        ball.vx += (-dy / distance) * size * 9 * dt
        ball.vy += (dx / distance) * size * 9 * dt
        if (Math.random() < 0.1) ball.vy -= size * (1.4 + Math.random() * 1.6)
        if (Math.random() < 0.1) ball.vx += (Math.random() - 0.5) * size * 2.4
      }
      ball.vx *= 0.995
      ball.vy *= 0.995
      ball.x += ball.vx * dt
      ball.y += ball.vy * dt
      ball.angle += (ball.vx / Math.max(1, ball.radius)) * dt
    }

    // Two relaxation passes keep stacked capsules from sinking into each other.
    for (let pass = 0; pass < 2; pass += 1) {
      for (let i = 0; i < this.balls.length; i += 1) {
        const a = this.balls[i] as Ball
        for (let j = i + 1; j < this.balls.length; j += 1) {
          const b = this.balls[j] as Ball
          const dx = b.x - a.x
          const dy = b.y - a.y
          const distance = Math.hypot(dx, dy) || 0.001
          const overlap = a.radius + b.radius - distance
          if (overlap <= 0) continue
          const nx = dx / distance
          const ny = dy / distance
          a.x -= (nx * overlap) / 2
          a.y -= (ny * overlap) / 2
          b.x += (nx * overlap) / 2
          b.y += (ny * overlap) / 2
          const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
          if (approach <= 0) continue
          const impulse = ((1 + RESTITUTION) * approach) / 2
          a.vx -= impulse * nx
          a.vy -= impulse * ny
          b.vx += impulse * nx
          b.vy += impulse * ny
        }
      }

      for (const ball of this.balls) {
        const dx = ball.x - center
        const dy = ball.y - center
        const distance = Math.hypot(dx, dy) || 0.001
        const limit = center - ball.radius - 2
        if (distance <= limit) continue
        const nx = dx / distance
        const ny = dy / distance
        ball.x = center + nx * limit
        ball.y = center + ny * limit
        const outward = ball.vx * nx + ball.vy * ny
        if (outward > 0) {
          ball.vx -= (1 + RESTITUTION) * outward * nx
          ball.vy -= (1 + RESTITUTION) * outward * ny
          // Rolling friction along the glass.
          ball.vx *= 0.97
          ball.vy *= 0.97
        }
      }
    }
  }

  private draw(): void {
    const ctx = this.ctx
    if (!ctx) return
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.size, this.size)

    for (const ball of this.balls) {
      const { x, y, radius } = ball
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(ball.angle)
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI)
      ctx.fillStyle = '#E7EBFA'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(0, 0, radius, Math.PI, Math.PI * 2)
      ctx.fillStyle = ball.color
      ctx.fill()
      ctx.fillStyle = 'rgba(11, 16, 32, 0.4)'
      ctx.fillRect(-radius, -radius * 0.07, radius * 2, radius * 0.14)
      ctx.restore()

      ctx.beginPath()
      ctx.arc(x - radius * 0.34, y - radius * 0.4, radius * 0.2, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.lineWidth = 1.5
      ctx.strokeStyle = 'rgba(11, 16, 32, 0.55)'
      ctx.stroke()
    }
  }
}
