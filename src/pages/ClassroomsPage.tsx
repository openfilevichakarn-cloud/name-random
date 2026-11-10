import { PageHeader } from '@/components/common/PageHeader'
import { PhaseNotice } from '@/components/common/PhaseNotice'

export default function ClassroomsPage() {
  return (
    <>
      <PageHeader eyebrow="Student Management" title="ห้องเรียน" description="จัดการห้องเรียนและรายชื่อนักเรียน" />
      <PhaseNotice phase={2}>ระบบจัดการห้องเรียน นักเรียน และการนำเข้า/ส่งออก Excel</PhaseNotice>
    </>
  )
}
