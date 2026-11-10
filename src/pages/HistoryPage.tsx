import { PageHeader } from '@/components/common/PageHeader'
import { PhaseNotice } from '@/components/common/PhaseNotice'

export default function HistoryPage() {
  return (
    <>
      <PageHeader eyebrow="Random History" title="ประวัติการสุ่ม" description="ผลการสุ่มย้อนหลังทุกครั้งและทุกรอบ" />
      <PhaseNotice phase={3}>ตารางประวัติ ตัวกรอง และการส่งออกรายงาน</PhaseNotice>
    </>
  )
}
