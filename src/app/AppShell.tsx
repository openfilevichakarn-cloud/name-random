import { motion } from 'framer-motion'
import { lazy, Suspense } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router'

import { PageLoader } from '@/components/common/PageLoader'
import { Backdrop } from '@/components/layout/Backdrop'
import { Dock } from '@/components/layout/Dock'
import { SoundToggle } from '@/components/layout/SoundToggle'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { isSupabaseConfigured } from '@/data/supabase/client'
import { useUiSounds } from '@/hooks/useUiSounds'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/uiStore'

const AccountMenu = lazy(() =>
  import('@/features/auth/components/AccountMenu').then((module) => ({ default: module.AccountMenu })),
)

/** Root layout: background, navigation, routed page and global overlays. */
export function AppShell() {
  const immersive = useUiStore((state) => state.immersive)
  const location = useLocation()
  useUiSounds()

  return (
    <TooltipProvider delayDuration={350}>
      <Backdrop />
      <a
        href="#main"
        className="sr-only z-[100] rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        ข้ามไปยังเนื้อหาหลัก
      </a>
      {immersive ? null : (
        <Dock
          actions={
            <>
              <SoundToggle />
              {isSupabaseConfigured ? (
                <Suspense fallback={null}>
                  <AccountMenu />
                </Suspense>
              ) : null}
            </>
          }
        />
      )}
      <main
        id="main"
        tabIndex={-1}
        className={cn(
          'mx-auto w-full outline-none',
          immersive ? 'min-h-dvh' : 'max-w-[1600px] px-4 pt-22 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12 lg:pl-34',
        )}
      >
        <Suspense fallback={<PageLoader />}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </Suspense>
      </main>
      <Toaster />
      <ScrollRestoration />
    </TooltipProvider>
  )
}
