import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { GlassCard } from '@/components/common/GlassCard'
import { LogoMark } from '@/components/layout/Logo'

interface AuthLayoutProps {
  title: string
  description?: ReactNode
  children: ReactNode
  /** Small print under the card. */
  footer?: ReactNode
}

/** Centered card used by the sign-in, onboarding and password pages. */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 py-4 sm:py-10">
      <Link to="/" aria-label="กลับหน้าหลัก" className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <LogoMark className="size-14" />
      </Link>
      <div className="text-center">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 text-muted-foreground">{description}</p> : null}
      </div>
      <GlassCard highlighted className="w-full">
        {children}
      </GlassCard>
      {footer ? <div className="text-center text-sm text-muted-foreground">{footer}</div> : null}
    </div>
  )
}
