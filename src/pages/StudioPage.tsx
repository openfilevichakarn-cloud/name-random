import { PageHeader } from '@/components/common/PageHeader'
import { PhaseNotice } from '@/components/common/PhaseNotice'

export default function StudioPage() {
  return (
    <>
      <PageHeader eyebrow="Randomizer Studio" title="สตูดิโอสุ่ม" description="เวทีสุ่มชื่อ 5 โหมด" />
      <PhaseNotice phase={3}>Lucky Wheel, Mystery Slot, Mystery Card, Countdown และ Gacha</PhaseNotice>
    </>
  )
}
