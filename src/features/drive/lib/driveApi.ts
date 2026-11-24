const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const FILE_FIELDS = 'id,name,version,modifiedTime,webViewLink'

export interface DriveFile {
  id: string
  name: string
  /** Increases with every change to the file. */
  version: string
  modifiedTime: string
  webViewLink: string | null
}

export type DriveErrorCode = 'unauthorized' | 'not-found' | 'forbidden' | 'quota' | 'network' | 'unknown'

/** A Drive API failure with a message that can be shown to the teacher. */
export class DriveError extends Error {
  readonly code: DriveErrorCode

  constructor(code: DriveErrorCode, message: string) {
    super(message)
    this.name = 'DriveError'
    this.code = code
  }
}

function toFile(value: Record<string, unknown>): DriveFile {
  return {
    id: String(value.id),
    name: String(value.name ?? ''),
    version: String(value.version ?? ''),
    modifiedTime: String(value.modifiedTime ?? ''),
    webViewLink: typeof value.webViewLink === 'string' ? value.webViewLink : null,
  }
}

/** Minimal Google Drive v3 client for one JSON data file. */
export class DriveClient {
  private readonly token: string
  private readonly fetcher: typeof fetch

  constructor(token: string, fetcher: typeof fetch = (...args) => fetch(...args)) {
    this.token = token
    this.fetcher = fetcher
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    let response: Response
    try {
      response = await this.fetcher(url, {
        ...init,
        headers: { Authorization: `Bearer ${this.token}`, ...init.headers },
      })
    } catch {
      throw new DriveError('network', 'เชื่อมต่อ Google Drive ไม่ได้ ตรวจสอบอินเทอร์เน็ต')
    }
    if (response.ok) return response
    if (response.status === 401) throw new DriveError('unauthorized', 'การเชื่อมต่อ Google Drive หมดอายุ กรุณาเชื่อมต่อใหม่')
    if (response.status === 404) throw new DriveError('not-found', 'ไม่พบไฟล์ข้อมูลใน Google Drive')
    if (response.status === 403 || response.status === 429) {
      const body = await response.text()
      if (/storageQuotaExceeded/.test(body)) throw new DriveError('quota', 'พื้นที่ Google Drive เต็ม')
      if (/rateLimit|userRateLimit/i.test(body) || response.status === 429) {
        throw new DriveError('quota', 'Google Drive ถูกเรียกใช้บ่อยเกินไป รอสักครู่แล้วลองใหม่')
      }
      throw new DriveError('forbidden', 'Google Drive ไม่อนุญาตให้เข้าถึงไฟล์นี้')
    }
    throw new DriveError('unknown', `Google Drive ตอบกลับผิดพลาด (${response.status})`)
  }

  private async json(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
    return (await (await this.request(url, init)).json()) as Record<string, unknown>
  }

  /** E-mail of the signed-in Google account. */
  async accountEmail(): Promise<string> {
    const about = await this.json(`${API}/about?fields=user(emailAddress)`)
    const user = about.user as { emailAddress?: string } | undefined
    return user?.emailAddress ?? ''
  }

  /** The app's data file, if this app created one in this Drive before (newest first). */
  async findFile(name: string): Promise<DriveFile | null> {
    const query = `name = '${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' and trashed = false`
    const params = new URLSearchParams({ q: query, orderBy: 'modifiedTime desc', pageSize: '1', fields: `files(${FILE_FIELDS})`, spaces: 'drive' })
    const result = await this.json(`${API}/files?${params}`)
    const files = Array.isArray(result.files) ? (result.files as Record<string, unknown>[]) : []
    return files[0] ? toFile(files[0]) : null
  }

  async getFile(id: string): Promise<DriveFile> {
    return toFile(await this.json(`${API}/files/${encodeURIComponent(id)}?fields=${FILE_FIELDS}`))
  }

  async download(id: string): Promise<string> {
    return (await this.request(`${API}/files/${encodeURIComponent(id)}?alt=media`)).text()
  }

  async create(name: string, content: string): Promise<DriveFile> {
    const created = await this.json(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/json', description: 'ข้อมูลห้องเรียนของ NEXT-GEN Student Randomizer' }),
    })
    return this.update(String(created.id), content)
  }

  async update(id: string, content: string): Promise<DriveFile> {
    return toFile(
      await this.json(`${UPLOAD}/files/${encodeURIComponent(id)}?uploadType=media&fields=${FILE_FIELDS}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: content,
      }),
    )
  }
}
