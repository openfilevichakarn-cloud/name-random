import { describe, expect, it } from 'vitest'

import { DriveClient, DriveError } from './driveApi'

interface Call {
  url: URL
  method: string
  body: string | null
  auth: string | null
}

function fake(reply: (call: Call) => Response) {
  const calls: Call[] = []
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = {
      url: new URL(String(input)),
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body : null,
      auth: new Headers(init?.headers).get('authorization'),
    }
    calls.push(call)
    return reply(call)
  }) as typeof fetch
  return { calls, client: new DriveClient('token-1', fetcher) }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const FILE = { id: 'f1', name: 'data.json', version: '7', modifiedTime: '2026-11-20T03:00:00.000Z', webViewLink: 'https://drive/f1' }

describe('DriveClient', () => {
  it('finds the newest data file by exact name, escaping quotes', async () => {
    const { calls, client } = fake(() => json({ files: [FILE] }))
    expect(await client.findFile("ครู's data.json")).toEqual(FILE)
    const query = calls[0]?.url.searchParams.get('q')
    expect(query).toBe("name = 'ครู\\'s data.json' and trashed = false")
    expect(calls[0]?.auth).toBe('Bearer token-1')
  })

  it('returns null when there is no file', async () => {
    const { client } = fake(() => json({ files: [] }))
    expect(await client.findFile('x')).toBeNull()
  })

  it('creates the file, then uploads its content', async () => {
    const { calls, client } = fake((call) => (call.method === 'POST' ? json({ id: 'f1' }) : json(FILE)))
    expect(await client.create('data.json', '{"a":1}')).toEqual(FILE)
    expect(calls.map((call) => `${call.method} ${call.url.pathname}`)).toEqual([
      'POST /drive/v3/files',
      'PATCH /upload/drive/v3/files/f1',
    ])
    expect(JSON.parse(calls[0]?.body ?? '{}')).toMatchObject({ name: 'data.json', mimeType: 'application/json' })
    expect(calls[1]?.body).toBe('{"a":1}')
    expect(calls[1]?.url.searchParams.get('uploadType')).toBe('media')
  })

  it('maps failures to messages a teacher can act on', async () => {
    const statuses: [number, string, string][] = [
      [401, '', 'unauthorized'],
      [404, '', 'not-found'],
      [403, '{"error":{"errors":[{"reason":"storageQuotaExceeded"}]}}', 'quota'],
      [403, '{"error":{"errors":[{"reason":"insufficientPermissions"}]}}', 'forbidden'],
      [500, '', 'unknown'],
    ]
    for (const [status, body, code] of statuses) {
      const { client } = fake(() => new Response(body, { status }))
      await expect(client.getFile('f1')).rejects.toMatchObject({ code })
    }
    const offline = new DriveClient('t', (() => Promise.reject(new TypeError('offline'))) as typeof fetch)
    await expect(offline.download('f1')).rejects.toBeInstanceOf(DriveError)
  })

  it('reads the account e-mail', async () => {
    const { client } = fake(() => json({ user: { emailAddress: 'kru@school.test' } }))
    expect(await client.accountEmail()).toBe('kru@school.test')
  })
})
