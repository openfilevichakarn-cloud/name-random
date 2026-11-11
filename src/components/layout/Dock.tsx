import { motion } from 'framer-motion'
import { Dices, GraduationCap, History, LayoutDashboard, Settings, Trophy, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'

import { cn } from '@/lib/utils'

import { Logo, LogoMark } from './Logo'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  /** The studio is the product's centrepiece and gets a highlighted button. */
  featured?: boolean
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'หน้าหลัก', icon: LayoutDashboard, end: true },
  { to: '/classrooms', label: 'ห้องเรียน', icon: GraduationCap },
  { to: '/studio', label: 'สตูดิโอ', icon: Dices, featured: true },
  { to: '/ranking', label: 'อันดับ', icon: Trophy },
  { to: '/history', label: 'ประวัติ', icon: History },
  { to: '/settings', label: 'ตั้งค่า', icon: Settings },
]

interface DockLinkProps {
  item: NavItem
  orientation: 'vertical' | 'horizontal'
}

function DockLink({ item, orientation }: DockLinkProps) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'group relative flex flex-col items-center justify-center gap-1 rounded-2xl text-muted-foreground outline-none',
          'transition-colors duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
          orientation === 'vertical' ? 'h-[4.25rem] w-[4.25rem]' : 'h-15 min-w-0 flex-1',
          isActive && 'text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            <motion.span
              layoutId={`dock-active-${orientation}`}
              className="absolute inset-0 rounded-2xl bg-primary/20 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_60%,transparent),0_0_24px_-4px_color-mix(in_oklab,var(--primary)_70%,transparent)]"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          ) : null}
          <span
            className={cn(
              'relative flex size-8 items-center justify-center rounded-xl',
              item.featured &&
                'bg-[linear-gradient(135deg,var(--neon-violet),var(--neon-pink))] text-white shadow-glow-pink',
            )}
          >
            <Icon className={item.featured ? 'size-5' : 'size-[1.35rem]'} aria-hidden />
          </span>
          <span className="relative text-[0.6875rem] font-medium leading-none">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

interface DockProps {
  /** Extra controls shown at the end of the dock (sound toggle, account menu). */
  actions?: ReactNode
}

/**
 * Primary navigation. A floating rail on large screens, a top bar plus bottom tab bar on touch layouts.
 */
export function Dock({ actions }: DockProps) {
  return (
    <>
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-28 flex-col items-center justify-between py-6 lg:flex">
        <Link
          to="/"
          aria-label="NEXT-GEN STUDENT RANDOMIZER — กลับหน้าหลัก"
          className="rounded-2xl outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogoMark className="size-12" />
        </Link>
        <nav aria-label="เมนูหลัก" className="glass glass-blur flex flex-col gap-1.5 rounded-[1.75rem] p-2">
          {NAV_ITEMS.map((item) => (
            <DockLink key={item.to} item={item} orientation="vertical" />
          ))}
        </nav>
        <div className="flex min-h-12 flex-col items-center gap-2">{actions}</div>
      </aside>

      {/* Touch layouts: top bar */}
      <header className="glass glass-blur fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between rounded-none border-x-0 border-t-0 px-4 lg:hidden">
        <Link to="/" className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo className="[&_svg]:size-9" />
        </Link>
        <div className="flex items-center gap-1.5">{actions}</div>
      </header>

      {/* Touch layouts: bottom tab bar */}
      <nav
        aria-label="เมนูหลัก"
        className="safe-bottom glass glass-blur fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-1 rounded-none rounded-t-3xl border-x-0 border-b-0 px-2 pt-1.5 lg:hidden"
      >
        {NAV_ITEMS.map((item) => (
          <DockLink key={item.to} item={item} orientation="horizontal" />
        ))}
      </nav>
    </>
  )
}
