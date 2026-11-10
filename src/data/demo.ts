import { randomBotAvatar } from '@/features/students/lib/avatar'

import type { ClassroomInput, ID, StudentInput } from './types'

/**
 * Sample data for trying the app out. These are invented names, not real students.
 * The classroom is flagged `isDemo` and the UI labels it "ข้อมูลตัวอย่าง" everywhere it appears.
 */
export const DEMO_CLASSROOM: ClassroomInput = {
  name: 'ห้องตัวอย่าง ป.5/1',
  gradeLevel: 'ประถมศึกษาปีที่ 5',
  academicYear: '',
  color: 'cyan',
  isDemo: true,
}

const DEMO_STUDENTS: readonly (readonly [firstName: string, lastName: string, nickname: string])[] = [
  ['กานต์', 'ใจดี', 'กานต์'],
  ['ขวัญข้าว', 'รักเรียน', 'ข้าว'],
  ['คิริน', 'มีสุข', 'คิน'],
  ['จอมทัพ', 'แสนดี', 'ทัพ'],
  ['ชมพู่', 'สดใส', 'พู่'],
  ['ต้นกล้า', 'ตั้งใจ', 'กล้า'],
  ['ทะเล', 'ฟ้าใส', 'เล'],
  ['ธาม', 'เก่งกล้า', 'ธาม'],
  ['นาวา', 'พากเพียร', 'นาวา'],
  ['น้ำใส', 'ร่มเย็น', 'น้ำ'],
  ['ปลื้ม', 'ยิ้มแย้ม', 'ปลื้ม'],
  ['ปัณณ์', 'ใฝ่รู้', 'ปัณณ์'],
  ['พอใจ', 'สุขสันต์', 'พอ'],
  ['ภูผา', 'มั่นคง', 'ภู'],
  ['มะลิ', 'หอมไกล', 'มะลิ'],
  ['มีนา', 'อ่อนหวาน', 'มีน'],
  ['ลูกหว้า', 'เบิกบาน', 'หว้า'],
  ['วายุ', 'ว่องไว', 'ยุ'],
  ['สกาย', 'สูงส่ง', 'สกาย'],
  ['ใบบัว', 'งามตา', 'บัว'],
  ['อุ่นใจ', 'อารีย์', 'อุ่น'],
  ['ไอดิน', 'กลิ่นฝน', 'ดิน'],
  ['เอิร์ธ', 'รอบรู้', 'เอิร์ธ'],
  ['ฮานะ', 'ดวงดี', 'ฮานะ'],
]

export function createDemoStudents(classroomId: ID): StudentInput[] {
  return DEMO_STUDENTS.map(([firstName, lastName, nickname], index) => ({
    classroomId,
    studentCode: '',
    number: index + 1,
    firstName,
    lastName,
    nickname,
    avatar: randomBotAvatar(),
  }))
}
