import { RotateCcw, TriangleAlert } from 'lucide-react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

import { Backdrop } from '@/components/layout/Backdrop'
import { Button } from '@/components/ui/button'

/** Shown when a route crashes while rendering or a lazy chunk fails to load. */
export function RouteError() {
  const error = useRouteError()
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'ไม่ทราบสาเหตุ'

  if (import.meta.env.DEV) console.error(error)

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <Backdrop />
      <div className="glass-strong w-full max-w-md rounded-3xl p-8 text-center" role="alert">
        <TriangleAlert className="mx-auto size-12 text-neon-gold" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold">เกิดข้อผิดพลาด</h1>
        <p className="mt-2 text-muted-foreground">
          หน้านี้ทำงานผิดพลาด ข้อมูลของคุณยังอยู่ครบ ลองโหลดใหม่อีกครั้ง
        </p>
        <p className="mt-3 rounded-xl bg-ink/60 px-3 py-2 font-mono text-xs break-words text-muted-foreground">
          {detail}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={() => window.location.reload()}>
            <RotateCcw aria-hidden />
            โหลดใหม่
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/">กลับหน้าหลัก</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
