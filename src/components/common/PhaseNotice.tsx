import { Hammer } from 'lucide-react'

import { EmptyState } from './EmptyState'
import { GlassCard } from './GlassCard'

interface PhaseNoticeProps {
  phase: number
  children: string
}

/** Honest placeholder for a module that a later roadmap phase delivers. Contains no controls. */
export function PhaseNotice({ phase, children }: PhaseNoticeProps) {
  return (
    <GlassCard>
      <EmptyState icon={Hammer} title={`กำลังพัฒนาใน Phase ${phase}`} description={children} />
    </GlassCard>
  )
}
