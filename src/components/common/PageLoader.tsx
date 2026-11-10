import { LoaderCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

interface PageLoaderProps {
  label?: string
  className?: string
}

/** Centered spinner for route-level and data loading states. */
export function PageLoader({ label = 'กำลังโหลด…', className }: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex min-h-[50dvh] flex-col items-center justify-center gap-3 text-muted-foreground', className)}
    >
      <LoaderCircle className="size-9 animate-spin text-neon-cyan" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  )
}
