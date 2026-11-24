import type { DriveStatus } from '@/stores/driveStore'

export const DRIVE_STATUS_LABELS: Record<DriveStatus, string> = {
  off: 'ยังไม่ได้เชื่อมต่อ',
  'needs-auth': 'ต้องเชื่อมต่ออีกครั้ง',
  connecting: 'กำลังเชื่อมต่อ…',
  syncing: 'กำลังซิงก์…',
  pending: 'รอบันทึก…',
  saved: 'บันทึกแล้ว',
  conflict: 'ข้อมูลไม่ตรงกัน — รอให้เลือก',
  error: 'ซิงก์ไม่สำเร็จ',
}

/** Statuses during which another click would only start a second run. */
export const DRIVE_BUSY: readonly DriveStatus[] = ['connecting', 'syncing']
