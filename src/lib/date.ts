const LOCALE = 'th-TH'

const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const dateFormat = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
const timeFormat = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' })
const weekdayFormat = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' })
const relativeFormat = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })

function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value)
}

/** e.g. "10 พ.ย. 2569 13:45" (Thai Buddhist calendar). */
export function formatDateTime(value: string | number | Date): string {
  return dateTimeFormat.format(toDate(value))
}

export function formatDate(value: string | number | Date): string {
  return dateFormat.format(toDate(value))
}

export function formatTime(value: string | number | Date): string {
  return timeFormat.format(toDate(value))
}

export function formatWeekday(value: string | number | Date): string {
  return weekdayFormat.format(toDate(value))
}

/** e.g. "5 นาทีที่ผ่านมา", "เมื่อวาน". Falls back to the date after a week. */
export function formatRelative(value: string | number | Date, now: Date = new Date()): string {
  const date = toDate(value)
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return 'เมื่อสักครู่'
  if (abs < 3600) return relativeFormat.format(Math.round(seconds / 60), 'minute')
  if (abs < 86_400) return relativeFormat.format(Math.round(seconds / 3600), 'hour')
  if (abs < 7 * 86_400) return relativeFormat.format(Math.round(seconds / 86_400), 'day')
  return formatDate(date)
}

/** Local midnight at the start of the given day. */
export function startOfDay(value: Date = new Date()): Date {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

export function addDays(value: Date, days: number): Date {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return date
}

/** `YYYY-MM-DD` in local time — the value format of <input type="date"> and a stable per-day key. */
export function toDateKey(value: string | number | Date): string {
  const date = toDate(value)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Parse a `YYYY-MM-DD` key as local midnight. Returns null for anything else. */
export function fromDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

/** Timestamp safe for file names, e.g. "2026-11-10_1345". */
export function fileTimestamp(now: Date = new Date()): string {
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${toDateKey(now)}_${hours}${minutes}`
}
