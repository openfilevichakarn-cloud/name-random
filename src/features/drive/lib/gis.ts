import { DRIVE_SCOPE, GOOGLE_CLIENT_ID } from './config'

/** The part of Google Identity Services (accounts.google.com/gsi/client) this app uses. */
interface TokenResponse {
  access_token?: string
  expires_in?: number | string
  scope?: string
  error?: string
  error_description?: string
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string; login_hint?: string }): void
}

interface GoogleAccounts {
  oauth2: {
    initTokenClient(config: {
      client_id: string
      scope: string
      callback: (response: TokenResponse) => void
      error_callback?: (error: { type?: string; message?: string }) => void
    }): TokenClient
    revoke(token: string, done?: () => void): void
    hasGrantedAllScopes?(response: TokenResponse, ...scopes: string[]): boolean
  }
}

declare global {
  interface Window {
    google?: { accounts?: GoogleAccounts }
  }
}

const SCRIPT_URL = 'https://accounts.google.com/gsi/client'

export class GoogleAuthError extends Error {
  /** `popup_closed` / `access_denied` are the teacher's choice, not failures. */
  readonly reason: string

  constructor(reason: string, message: string) {
    super(message)
    this.name = 'GoogleAuthError'
    this.reason = reason
  }
}

let loading: Promise<GoogleAccounts> | null = null

/** Load the Google Identity Services script once, on first use. */
export function loadGoogleIdentity(): Promise<GoogleAccounts> {
  loading ??= new Promise<GoogleAccounts>((resolve, reject) => {
    const ready = () => {
      const accounts = window.google?.accounts
      if (accounts?.oauth2) resolve(accounts)
      else reject(new GoogleAuthError('unavailable', 'โหลดระบบเข้าสู่ระบบของ Google ไม่สำเร็จ'))
    }
    if (window.google?.accounts?.oauth2) {
      ready()
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = ready
    script.onerror = () =>
      reject(new GoogleAuthError('unavailable', 'เชื่อมต่อ Google ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง'))
    document.head.append(script)
  }).catch((error: unknown) => {
    loading = null
    throw error
  })
  return loading
}

export interface AccessToken {
  token: string
  /** Epoch ms. */
  expiresAt: number
}

/**
 * Ask Google for an access token. Opens Google's popup, so it must run from a click.
 * `hint` (an e-mail) skips the account chooser when the teacher already agreed before.
 */
export async function requestAccessToken(hint?: string): Promise<AccessToken> {
  const accounts = await loadGoogleIdentity()
  return new Promise<AccessToken>((resolve, reject) => {
    const client = accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new GoogleAuthError(response.error ?? 'unknown', response.error_description ?? 'Google ไม่อนุญาตการเข้าถึง'))
          return
        }
        const granted = response.scope?.split(' ').includes(DRIVE_SCOPE) ?? true
        if (!granted) {
          reject(new GoogleAuthError('access_denied', 'ต้องอนุญาตให้แอปเข้าถึงไฟล์ใน Google Drive จึงจะบันทึกข้อมูลได้'))
          return
        }
        const seconds = Number(response.expires_in ?? 3600)
        resolve({ token: response.access_token, expiresAt: Date.now() + Math.max(60, seconds - 60) * 1000 })
      },
      error_callback: (error) =>
        reject(
          new GoogleAuthError(
            error.type ?? 'unknown',
            error.type === 'popup_closed' ? 'ปิดหน้าต่าง Google ก่อนเข้าสู่ระบบเสร็จ' : 'เปิดหน้าต่างเข้าสู่ระบบของ Google ไม่ได้ (เบราว์เซอร์อาจบล็อกป๊อปอัป)',
          ),
        ),
    })
    client.requestAccessToken(hint ? { prompt: '', login_hint: hint } : { prompt: '' })
  })
}

/** Withdraw the app's access (Disconnect). Never throws. */
export async function revokeAccessToken(token: string): Promise<void> {
  try {
    const accounts = await loadGoogleIdentity()
    await new Promise<void>((resolve) => accounts.oauth2.revoke(token, resolve))
  } catch {
    // Already gone or offline: the token expires on its own within the hour.
  }
}
