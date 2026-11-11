import { describeError } from '@/data/repository'
import { toRepositoryError } from '@/data/supabase/mappers'

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  email_not_confirmed: 'กรุณายืนยันอีเมลก่อน โดยกดลิงก์ในอีเมลที่ระบบส่งให้',
  user_already_exists: 'อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทน',
  email_exists: 'อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทน',
  weak_password: 'รหัสผ่านสั้นหรือคาดเดาง่ายเกินไป',
  same_password: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม',
  email_address_invalid: 'รูปแบบอีเมลไม่ถูกต้อง',
  email_address_not_authorized: 'ระบบยังส่งอีเมลไปยังที่อยู่นี้ไม่ได้ กรุณาติดต่อผู้ดูแลระบบ',
  signup_disabled: 'ระบบปิดรับสมัครสมาชิกใหม่',
  over_email_send_rate_limit: 'ส่งอีเมลบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
  over_request_rate_limit: 'ทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
  otp_expired: 'ลิงก์หมดอายุแล้ว กรุณาขอลิงก์ใหม่',
  session_not_found: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง',
  session_expired: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง',
}

interface AuthErrorLike {
  name?: string
  code?: string
  message?: string
  status?: number
}

/** A Thai, user-facing message for anything thrown by supabase-js auth or the account functions. */
export function describeAuthError(error: unknown, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'): string {
  const value = (typeof error === 'object' && error !== null ? error : {}) as AuthErrorLike
  if (value.code && AUTH_MESSAGES[value.code]) return AUTH_MESSAGES[value.code] as string
  if (value.name === 'AuthRetryableFetchError' || value.name === 'AuthNetworkError') {
    return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'
  }
  // Older Auth servers report invalid credentials without a code.
  if (value.message === 'Invalid login credentials') return AUTH_MESSAGES.invalid_credentials as string
  if (value.name?.startsWith('Auth')) return value.message ? `${fallback} (${value.message})` : fallback
  return describeError(toRepositoryError(error, fallback), fallback)
}
