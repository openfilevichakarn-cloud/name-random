import type { Page, Route } from '@playwright/test'

const TOKEN = 'fake-drive-token'

/** Stand-in for accounts.google.com/gsi/client: grants a token as soon as it is asked for one. */
const IDENTITY_SCRIPT = `
window.google = { accounts: { oauth2: {
  initTokenClient(config) {
    return { requestAccessToken() {
      window.__fakeGoogleTokenRequests = (window.__fakeGoogleTokenRequests || 0) + 1
      setTimeout(() => config.callback({ access_token: '${TOKEN}', expires_in: 3599, scope: config.scope, token_type: 'Bearer' }), 30)
    } }
  },
  revoke(token, done) { if (done) setTimeout(done, 0) },
} } }
`

interface StoredFile {
  id: string
  name: string
  content: string
  version: number
  modifiedTime: string
}

/** In-memory Google Drive shared by every page it is installed on (one "teacher account"). */
export class FakeGoogleDrive {
  readonly files = new Map<string, StoredFile>()
  readonly email: string
  private next = 1

  constructor(email = 'kru@school.test') {
    this.email = email
  }

  async install(page: Page): Promise<void> {
    await page.route('https://accounts.google.com/gsi/client', (route) =>
      route.fulfill({ contentType: 'text/javascript', body: IDENTITY_SCRIPT }),
    )
    await page.route('https://www.googleapis.com/**', (route) => this.handle(route))
  }

  /** Content of the only data file, parsed. */
  data(): { data: { classrooms: { name: string }[]; students: { firstName: string }[] } } | null {
    const file = [...this.files.values()][0]
    return file && file.content ? JSON.parse(file.content) : null
  }

  private meta(file: StoredFile) {
    return {
      id: file.id,
      name: file.name,
      version: String(file.version),
      modifiedTime: file.modifiedTime,
      webViewLink: `https://drive.google.com/file/d/${file.id}/view`,
    }
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request()
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
    }
    const reply = (status: number, body: unknown) =>
      route.fulfill({
        status,
        headers: cors,
        contentType: typeof body === 'string' ? 'text/plain' : 'application/json',
        body: typeof body === 'string' ? body : JSON.stringify(body),
      })
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (request.headers().authorization !== `Bearer ${TOKEN}`) return reply(401, { error: { code: 401 } })

    const url = new URL(request.url())
    const path = url.pathname
    if (path === '/drive/v3/about') return reply(200, { user: { emailAddress: this.email } })

    if (path === '/drive/v3/files' && request.method() === 'GET') {
      const match = /^name = '(.*)' and trashed = false$/.exec(url.searchParams.get('q') ?? '')
      const name = match?.[1]?.replace(/\\'/g, "'").replace(/\\\\/g, '\\')
      const files = [...this.files.values()]
        .filter((file) => file.name === name)
        .sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime))
      return reply(200, { files: files.slice(0, 1).map((file) => this.meta(file)) })
    }

    if (path === '/drive/v3/files' && request.method() === 'POST') {
      const body = JSON.parse(request.postData() ?? '{}') as { name: string }
      const file: StoredFile = { id: `file-${this.next++}`, name: body.name, content: '', version: 1, modifiedTime: new Date().toISOString() }
      this.files.set(file.id, file)
      return reply(200, { id: file.id })
    }

    const id = /\/files\/([^/?]+)$/.exec(path)?.[1]
    const file = id ? this.files.get(decodeURIComponent(id)) : undefined
    if (!file) return reply(404, { error: { code: 404 } })

    if (request.method() === 'PATCH' && path.startsWith('/upload/')) {
      file.content = request.postData() ?? ''
      file.version += 1
      file.modifiedTime = new Date().toISOString()
      return reply(200, this.meta(file))
    }
    if (request.method() === 'GET') {
      return url.searchParams.get('alt') === 'media' ? reply(200, file.content) : reply(200, this.meta(file))
    }
    return reply(405, { error: { code: 405 } })
  }
}
