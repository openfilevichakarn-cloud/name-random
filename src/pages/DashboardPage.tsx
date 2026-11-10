import { ArrowRight, Dices, GraduationCap, Settings, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'

import { GlassCard } from '@/components/common/GlassCard'
import { Button } from '@/components/ui/button'

interface Step {
  to: string
  icon: LucideIcon
  title: string
  description: string
  tone: string
}

const STEPS: readonly Step[] = [
  {
    to: '/classrooms',
    icon: GraduationCap,
    title: 'เพิ่มห้องเรียน',
    description: 'สร้างห้องและเพิ่มรายชื่อนักเรียน หรือนำเข้าจาก Excel',
    tone: 'text-neon-cyan',
  },
  {
    to: '/studio',
    icon: Dices,
    title: 'เปิดสตูดิโอสุ่ม',
    description: 'เลือกโหมดเกมแล้วกดสุ่ม พร้อมเอฟเฟกต์และเสียง',
    tone: 'text-neon-pink',
  },
  {
    to: '/settings',
    icon: Settings,
    title: 'ปรับแต่งระบบ',
    description: 'ธีมสี ระดับแอนิเมชัน และการแสดงผลบนจอใหญ่',
    tone: 'text-neon-gold',
  },
]

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <GlassCard highlighted className="relative overflow-hidden p-7 sm:p-10">
        <div
          aria-hidden
          className="absolute -top-24 -right-16 size-72 rounded-full bg-neon-pink/25 blur-3xl anim-low:hidden"
        />
        <p className="hud-label text-neon-cyan">Next-Gen Student Randomizer</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-extrabold sm:text-5xl">
          สุ่มชื่อให้สนุกเหมือน<span className="text-gradient">เล่นเกม</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          วงล้อ สล็อต การ์ดปริศนา นับถอยหลัง และกาชา — เปลี่ยนการเรียกชื่อให้เป็นช่วงเวลาที่ทั้งห้องรอคอย
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button variant="neon" size="lg" asChild>
            <Link to="/studio">
              <Dices aria-hidden />
              เข้าสตูดิโอ
            </Link>
          </Button>
          <Button variant="secondary" size="lg" asChild>
            <Link to="/classrooms">จัดการห้องเรียน</Link>
          </Button>
        </div>
      </GlassCard>

      <section aria-labelledby="getting-started">
        <h2 id="getting-started" className="mb-3 text-xl font-bold">
          เริ่มต้นใช้งาน
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.to}>
              <Link
                to={step.to}
                className="group block h-full rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <GlassCard interactive className="flex h-full flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <step.icon className={`size-8 ${step.tone}`} aria-hidden />
                    <span className="tabular text-3xl font-extrabold text-foreground/15">0{index + 1}</span>
                  </div>
                  <h3 className="text-lg font-bold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-neon-cyan">
                    ไปที่หน้านี้
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                </GlassCard>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
