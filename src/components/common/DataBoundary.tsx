import { RotateCcw, TriangleAlert } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { useDataStore } from '@/stores/dataStore'

import { EmptyState } from './EmptyState'
import { GlassCard } from './GlassCard'
import { PageLoader } from './PageLoader'

interface DataBoundaryProps {
  children: ReactNode
}

/**
 * Loads classrooms and students, and renders its children only once they are available.
 * Shows a spinner while loading and a retry screen when loading fails.
 */
export function DataBoundary({ children }: DataBoundaryProps) {
  const status = useDataStore((state) => state.status)
  const error = useDataStore((state) => state.error)
  const load = useDataStore((state) => state.load)
  const reload = useDataStore((state) => state.reload)

  useEffect(() => {
    void load()
  }, [load])

  if (status === 'error') {
    return (
      <GlassCard role="alert">
        <EmptyState icon={TriangleAlert} title="โหลดข้อมูลไม่สำเร็จ" description={error}>
          <Button onClick={() => void reload()}>
            <RotateCcw aria-hidden />
            ลองอีกครั้ง
          </Button>
        </EmptyState>
      </GlassCard>
    )
  }

  if (status !== 'ready') return <PageLoader label="กำลังโหลดข้อมูล…" />

  return children
}
