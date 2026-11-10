import { downloadBlob } from './download'

export type SpreadsheetFormat = 'xlsx' | 'csv'
export type Cell = string | number

export const SPREADSHEET_LIMITS = {
  /** Largest file accepted for import. */
  fileBytes: 5 * 1024 * 1024,
  /** Rows read from a sheet; anything beyond is ignored. */
  rows: 2000,
} as const

export const SPREADSHEET_ACCEPT = '.xlsx,.xls,.csv,.tsv,.txt'

/** User-facing import/export failure. */
export class SpreadsheetError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SpreadsheetError'
  }
}

/** SheetJS is ~400 kB, so it is only fetched when the user actually imports or exports. */
function loadSheetJs() {
  return import('xlsx')
}

/**
 * Decode a text file. Teachers' CSV files are either UTF-8 (modern Excel, Google Sheets)
 * or Windows-874/TIS-620 (older Thai Excel): try strict UTF-8 first and fall back.
 */
export function decodeText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-874').decode(bytes)
  }
}

function isTextFile(file: File): boolean {
  return /\.(csv|tsv|txt)$/i.test(file.name) || file.type.startsWith('text/')
}

/** Read the first sheet of a spreadsheet (or a CSV/TSV file) as rows of display strings. */
export async function readTable(file: File): Promise<string[][]> {
  if (file.size === 0) throw new SpreadsheetError('ไฟล์ว่างเปล่า')
  if (file.size > SPREADSHEET_LIMITS.fileBytes) {
    throw new SpreadsheetError('ไฟล์ใหญ่เกินไป (สูงสุด 5 MB)')
  }

  try {
    const XLSX = await loadSheetJs()
    const buffer = await file.arrayBuffer()
    const workbook = isTextFile(file)
      ? // `raw` keeps every cell as text, so codes such as "00123" keep their leading zeros.
        XLSX.read(decodeText(buffer), { type: 'string', raw: true })
      : XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = sheetName ? workbook.Sheets[sheetName] : undefined
    if (!sheet) throw new SpreadsheetError('ไม่พบแผ่นงานในไฟล์')
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false, // formatted text, exactly as the teacher sees it in Excel
      defval: '',
      blankrows: false,
    })
    return rows
      .slice(0, SPREADSHEET_LIMITS.rows)
      .map((row) => row.map((cell) => (cell === null || cell === undefined ? '' : String(cell))))
  } catch (error) {
    if (error instanceof SpreadsheetError) throw error
    throw new SpreadsheetError('อ่านไฟล์ไม่ได้ กรุณาตรวจสอบว่าเป็นไฟล์ Excel หรือ CSV ที่ถูกต้อง', { cause: error })
  }
}

/**
 * Neutralise spreadsheet formula injection: a text cell starting with = + - @ would be
 * evaluated as a formula when a CSV is opened in Excel.
 */
export function escapeFormula(value: Cell): Cell {
  if (typeof value !== 'string') return value
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

interface DownloadTableOptions {
  filename: string
  format: SpreadsheetFormat
  sheetName?: string
  /** Column widths in characters. */
  widths?: readonly number[]
}

/** Build a spreadsheet from rows and download it. */
export async function downloadTable(rows: readonly (readonly Cell[])[], options: DownloadTableOptions): Promise<void> {
  const { filename, format, sheetName = 'Sheet1', widths } = options
  try {
    const XLSX = await loadSheetJs()
    if (format === 'csv') {
      const sheet = XLSX.utils.aoa_to_sheet(rows.map((row) => row.map(escapeFormula)))
      const csv = XLSX.utils.sheet_to_csv(sheet)
      // The BOM makes Excel read the file as UTF-8, otherwise Thai text turns into mojibake.
      downloadBlob(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`)
      return
    }
    const sheet = XLSX.utils.aoa_to_sheet(rows.map((row) => [...row]))
    if (widths) sheet['!cols'] = widths.map((wch) => ({ wch }))
    const workbook = XLSX.utils.book_new()
    // Excel limits sheet names to 31 characters and forbids : \ / ? * [ ]
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Sheet1')
    const data = XLSX.write(workbook, { type: 'array', bookType: 'xlsx', compression: true }) as ArrayBuffer
    downloadBlob(
      new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `${filename}.xlsx`,
    )
  } catch (error) {
    throw new SpreadsheetError('สร้างไฟล์ไม่สำเร็จ กรุณาลองใหม่', { cause: error })
  }
}
