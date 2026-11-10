import type { CSSProperties } from 'react'

import type { ClassroomColor } from '@/data/types'

export const CLASSROOM_COLOR_META: Record<ClassroomColor, { label: string; hex: string }> = {
  violet: { label: 'ม่วง', hex: '#8B5CF6' },
  cyan: { label: 'ฟ้า', hex: '#22D3EE' },
  pink: { label: 'ชมพู', hex: '#EC4899' },
  lime: { label: 'เขียว', hex: '#A3E635' },
  gold: { label: 'ทอง', hex: '#FBBF24' },
}

/**
 * Expose a classroom colour as the `--tone` custom property, so one set of Tailwind classes
 * (`text-(--tone)`, `bg-(--tone)/15`, …) can style every colour.
 */
export function toneStyle(color: ClassroomColor): CSSProperties {
  return { '--tone': CLASSROOM_COLOR_META[color].hex } as CSSProperties
}

/** Current Thai academic year (Buddhist era). The school year starts in May. */
export function currentAcademicYear(now: Date = new Date()): string {
  const year = now.getFullYear() + 543
  return String(now.getMonth() < 4 ? year - 1 : year)
}
