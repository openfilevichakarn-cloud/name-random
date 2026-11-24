import { Bird, Car, Cherry, Egg, FerrisWheel, GalleryHorizontalEnd, Sailboat, Timer, Users, type LucideIcon } from 'lucide-react'

import type { DrawType, RandomMode, ResultMode } from '@/data/types'

export interface ModeMeta {
  /** Thai name used in the UI. */
  label: string
  /** English product name of the mode. */
  english: string
  description: string
  icon: LucideIcon
  /** Label of the main button that starts a draw in this mode. */
  action: string
}

export const MODE_META: Record<RandomMode, ModeMeta> = {
  wheel: {
    label: 'วงล้อ',
    english: 'Lucky Wheel',
    description: 'หมุนวงล้อ ลุ้นว่าลูกศรจะหยุดที่ใคร',
    icon: FerrisWheel,
    action: 'หมุนเลย!',
  },
  slot: {
    label: 'สล็อต',
    english: 'Mystery Slot',
    description: 'สามช่องหมุนพร้อมกันแล้วหยุดทีละช่อง',
    icon: Cherry,
    action: 'สุ่มเลย!',
  },
  card: {
    label: 'การ์ด',
    english: 'Mystery Card',
    description: 'คว่ำการ์ดแล้วให้นักเรียนเลือกเปิดเอง',
    icon: GalleryHorizontalEnd,
    action: 'แจกการ์ด!',
  },
  countdown: {
    label: 'นับถอยหลัง',
    english: 'Countdown',
    description: 'นับถอยหลังพร้อมกันทั้งห้องก่อนเปิดเผยชื่อ',
    icon: Timer,
    action: 'เริ่มนับ!',
  },
  gacha: {
    label: 'กาชา',
    english: 'Gacha',
    description: 'หมุนตู้กาชาแล้วเปิดแคปซูลลุ้นชื่อ',
    icon: Egg,
    action: 'หมุนกาชา!',
  },
  kart: {
    label: 'โกคาร์ท',
    english: 'Go-Kart Race',
    description: 'รถโกคาร์ทของทุกคนแข่งกันเข้าเส้นชัย',
    icon: Car,
    action: 'ออกตัว!',
  },
  duck: {
    label: 'เป็ดว่ายน้ำ',
    english: 'Duck Race',
    description: 'เป็ดน้อยว่ายน้ำแข่งกัน ตัวไหนถึงทุ่นก่อนชนะ',
    icon: Bird,
    action: 'ปล่อยเป็ด!',
  },
  boat: {
    label: 'เรือหางยาว',
    english: 'Long-tail Boat Race',
    description: 'แข่งเรือหางยาวแบบไทยกลางลำน้ำ',
    icon: Sailboat,
    action: 'ติดเครื่อง!',
  },
}

/** Display info for anything that can appear in the history, including team draws. */
export const RESULT_MODE_META: Record<ResultMode, { label: string; english: string; icon: LucideIcon }> = {
  ...MODE_META,
  team: { label: 'แบ่งทีม', english: 'Team Random', icon: Users },
}

export const DRAW_TYPE_LABELS: Record<DrawType, string> = {
  single: 'ทีละคน',
  multiple: 'หลายคน',
  team: 'แบ่งทีม',
}
