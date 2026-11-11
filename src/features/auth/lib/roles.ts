import type { UserRole } from '@/data/types'

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'เจ้าของโรงเรียน',
  admin: 'ผู้ดูแล',
  teacher: 'ครู',
}
