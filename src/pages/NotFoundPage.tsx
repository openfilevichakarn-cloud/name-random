import { Compass } from 'lucide-react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/common/EmptyState'
import { GlassCard } from '@/components/common/GlassCard'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <GlassCard className="mx-auto max-w-xl">
      <EmptyState icon={Compass} title="ไม่พบหน้านี้" description="ลิงก์อาจไม่ถูกต้อง หรือหน้านี้ถูกย้ายไปแล้ว">
        <Button asChild>
          <Link to="/">กลับหน้าหลัก</Link>
        </Button>
      </EmptyState>
    </GlassCard>
  )
}
