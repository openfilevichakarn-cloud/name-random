import type { Page, Route } from '@playwright/test'

/**
 * In-memory stand-in for a Supabase project (Auth + the PostgREST Data API), served through
 * Playwright request interception. It implements just enough of both APIs for the app's cloud
 * mode, plus the access rules that matter to these tests (a user only sees their own rows).
 * The real Row Level Security is tested against Postgres in supabase/tests.
 */

export const SUPABASE_URL = 'http://localhost:54321'

type Row = Record<string, unknown>

interface Reply {
  status?: number
  body?: unknown
  headers?: Record<string, string>
}

interface Account {
  id: string
  email: string
  password: string
  displayName: string
  confirmed: boolean
}

interface FakeOptions {
  /** New sign-ups must confirm their e-mail before they get a session. */
  confirmEmails?: boolean
}

const TABLES = [
  'schools',
  'users',
  'classrooms',
  'students',
  'random_sessions',
  'random_results',
  'random_settings',
  'sound_settings',
] as const
type TableName = (typeof TABLES)[number]

/** Column that ties a row to its owner, for the "own rows only" rule. */
const OWNER_COLUMN: Partial<Record<TableName, string>> = {
  classrooms: 'owner_id',
  random_sessions: 'user_id',
  random_results: 'user_id',
  random_settings: 'user_id',
  sound_settings: 'user_id',
}

let counter = 0
function uuid(): string {
  counter += 1
  const hex = (Date.now().toString(16) + counter.toString(16).padStart(8, '0')).padStart(32, '0').slice(-32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`
}

function base64url(value: string): string {
  return Buffer.from(value).toString('base64url')
}

function jwtFor(account: Account): string {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64url(
    JSON.stringify({ sub: account.id, email: account.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 }),
  )
  return `${header}.${payload}.${base64url('signature')}`
}

function authUser(account: Account) {
  return {
    id: account.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: account.email,
    email_confirmed_at: account.confirmed ? new Date().toISOString() : null,
    user_metadata: { display_name: account.displayName },
    app_metadata: { provider: 'email' },
    created_at: new Date().toISOString(),
  }
}

function sessionFor(account: Account) {
  return {
    access_token: jwtFor(account),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `refresh-${account.id}`,
    user: authUser(account),
  }
}

function authError(status: number, code: string, message: string): Reply {
  return { status, body: { code: status, error_code: code, msg: message } }
}

/** Parse one PostgREST filter value (`eq.x`, `in.(a,b)`, `is.null`, …) into a predicate. */
function filterFor(column: string, expression: string): (row: Row) => boolean {
  const dot = expression.indexOf('.')
  const operator = expression.slice(0, dot)
  const value = expression.slice(dot + 1)
  const cell = (row: Row) => row[column]
  switch (operator) {
    case 'eq':
      return (row) => String(cell(row)) === value
    case 'neq':
      return (row) => String(cell(row)) !== value
    case 'in': {
      const items = value.replace(/^\(|\)$/g, '').split(',').map((item) => item.replace(/^"|"$/g, ''))
      return (row) => items.includes(String(cell(row)))
    }
    case 'is':
      return (row) => (value === 'null' ? cell(row) === null || cell(row) === undefined : String(cell(row)) === value)
    case 'gte':
      return (row) => String(cell(row)) >= value
    case 'lt':
      return (row) => String(cell(row)) < value
    case 'ilike': {
      // LIKE pattern → regular expression: % and _ are wildcards, a backslash escapes the next character.
      let source = ''
      for (let i = 0; i < value.length; i += 1) {
        const char = value[i] as string
        if (char === '\\' && i + 1 < value.length) {
          i += 1
          source += (value[i] as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        } else if (char === '%') source += '.*'
        else if (char === '_') source += '.'
        else source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      }
      const regex = new RegExp(`^${source}$`, 'i')
      return (row) => regex.test(String(cell(row) ?? ''))
    }
    default:
      throw new Error(`fake supabase: unsupported filter ${operator}`)
  }
}

const RESERVED = new Set(['select', 'order', 'offset', 'limit', 'on_conflict', 'columns'])

export class FakeSupabase {
  readonly accounts: Account[] = []
  readonly tables: Record<TableName, Row[]> = Object.fromEntries(TABLES.map((name) => [name, []])) as unknown as Record<
    TableName,
    Row[]
  >
  /** Every Data API request, for assertions such as "the draw was written to the cloud". */
  readonly log: { method: string; path: string }[] = []
  private readonly options: FakeOptions

  constructor(options: FakeOptions = {}) {
    this.options = options
  }

  /** Create a confirmed account, optionally already member of a school. */
  addAccount(email: string, password: string, displayName: string, school?: { name: string; role?: string; joinCode?: string }) {
    const account: Account = { id: uuid(), email, password, displayName, confirmed: true }
    this.accounts.push(account)
    const profile: Row = { id: account.id, school_id: null, display_name: displayName, role: 'teacher', created_at: new Date().toISOString() }
    if (school) {
      const existing = this.tables.schools.find((row) => row.name === school.name)
      const schoolRow = existing ?? {
        id: uuid(),
        name: school.name,
        join_code: school.joinCode ?? 'ABCD2345',
        created_at: new Date().toISOString(),
      }
      if (!existing) this.tables.schools.push(schoolRow)
      profile.school_id = schoolRow.id
      profile.role = school.role ?? 'owner'
    }
    this.tables.users.push(profile)
    return account
  }

  async install(page: Page): Promise<void> {
    await page.route(`${SUPABASE_URL}/**`, (route) => this.handle(route))
  }

  private userFrom(route: Route): Account | null {
    const header = route.request().headers().authorization ?? ''
    const token = header.replace(/^Bearer /i, '')
    const payload = token.split('.')[1]
    if (!payload) return null
    try {
      const { sub } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string }
      return this.accounts.find((account) => account.id === sub) ?? null
    } catch {
      return null
    }
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: this.cors() })
      return
    }
    const body = request.postData() ? (JSON.parse(request.postData() as string) as unknown) : undefined
    const reply = url.pathname.startsWith('/auth/v1/')
      ? this.auth(url, method, body, route)
      : url.pathname.startsWith('/rest/v1/rpc/')
        ? this.rpc(url.pathname.slice('/rest/v1/rpc/'.length), body as Row, route)
        : this.rest(url, method, body, route)
    if (!url.pathname.startsWith('/auth/')) this.log.push({ method, path: `${url.pathname}${url.search}` })
    await route.fulfill({
      status: reply.status ?? 200,
      headers: { 'content-type': 'application/json', ...this.cors(), ...reply.headers },
      body: reply.body === undefined || reply.status === 204 || method === 'HEAD' ? '' : JSON.stringify(reply.body),
    })
  }

  private cors(): Record<string, string> {
    return {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS',
      'access-control-expose-headers': 'content-range',
    }
  }

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  private auth(url: URL, method: string, body: unknown, route: Route): Reply {
    const input = (body ?? {}) as { email?: string; password?: string; data?: { display_name?: string } }
    const path = url.pathname.slice('/auth/v1/'.length)

    if (path === 'signup' && method === 'POST') {
      if (this.accounts.some((account) => account.email === input.email)) {
        return authError(422, 'user_already_exists', 'User already registered')
      }
      if ((input.password ?? '').length < 6) return authError(422, 'weak_password', 'Password should be at least 6 characters')
      const account: Account = {
        id: uuid(),
        email: input.email ?? '',
        password: input.password ?? '',
        displayName: input.data?.display_name ?? '',
        confirmed: !this.options.confirmEmails,
      }
      this.accounts.push(account)
      this.tables.users.push({
        id: account.id,
        school_id: null,
        display_name: account.displayName,
        role: 'teacher',
        created_at: new Date().toISOString(),
      })
      return { body: account.confirmed ? sessionFor(account) : authUser(account) }
    }

    if (path === 'token' && url.searchParams.get('grant_type') === 'password') {
      const account = this.accounts.find((item) => item.email === input.email && item.password === input.password)
      if (!account) return authError(400, 'invalid_credentials', 'Invalid login credentials')
      if (!account.confirmed) return authError(400, 'email_not_confirmed', 'Email not confirmed')
      return { body: sessionFor(account) }
    }

    if (path === 'token' && url.searchParams.get('grant_type') === 'refresh_token') {
      const token = (body as { refresh_token?: string }).refresh_token ?? ''
      const account = this.accounts.find((item) => `refresh-${item.id}` === token)
      return account ? { body: sessionFor(account) } : authError(400, 'refresh_token_not_found', 'Invalid Refresh Token')
    }

    if (path === 'logout') return { status: 204 }
    if (path === 'recover') return { body: {} }

    if (path === 'user') {
      const account = this.userFrom(route)
      if (!account) return authError(401, 'no_authorization', 'Unauthorized')
      if (method === 'PUT' && input.password) account.password = input.password
      return { body: authUser(account) }
    }

    return authError(404, 'not_found', `fake supabase: unsupported auth endpoint ${path}`)
  }

  // ---------------------------------------------------------------------------
  // Data API
  // ---------------------------------------------------------------------------

  private profileOf(account: Account | null): Row | undefined {
    return account ? this.tables.users.find((row) => row.id === account.id) : undefined
  }

  /** Rows of `table` the signed-in user may see. */
  private visible(table: TableName, account: Account | null): Row[] {
    if (!account) return []
    const profile = this.profileOf(account)
    const ownerColumn = OWNER_COLUMN[table]
    if (ownerColumn) return this.tables[table].filter((row) => row[ownerColumn] === account.id)
    if (table === 'students') {
      const own = new Set(this.tables.classrooms.filter((row) => row.owner_id === account.id).map((row) => row.id))
      return this.tables.students.filter((row) => own.has(row.classroom_id))
    }
    if (table === 'users') {
      return this.tables.users.filter((row) => row.id === account.id || (row.school_id && row.school_id === profile?.school_id))
    }
    if (table === 'schools') return this.tables.schools.filter((row) => row.id === profile?.school_id)
    return []
  }

  private rest(url: URL, method: string, body: unknown, route: Route): Reply {
    const table = url.pathname.slice('/rest/v1/'.length) as TableName
    if (!TABLES.includes(table)) return { status: 404, body: { code: 'PGRST205', message: `unknown table ${table}` } }
    const account = this.userFrom(route)
    if (!account) return { status: 401, body: { code: '42501', message: 'permission denied' } }
    const headers = route.request().headers()
    const prefer = headers.prefer ?? ''
    const wantsObject = (headers.accept ?? '').includes('vnd.pgrst.object')

    const filters: ((row: Row) => boolean)[] = []
    for (const [key, value] of url.searchParams.entries()) {
      if (!RESERVED.has(key)) filters.push(filterFor(key, value))
    }
    const matches = (row: Row) => filters.every((filter) => filter(row))

    const project = (rows: Row[]) => {
      const select = url.searchParams.get('select') ?? '*'
      if (select === '*') return rows
      const columns = select.split(',')
      return rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])))
    }

    const respond = (rows: Row[], status = 200, total?: number): Reply => {
      const shaped = project(rows)
      const extra: Record<string, string> = {}
      if (total !== undefined) extra['content-range'] = `${rows.length ? `0-${rows.length - 1}` : '*'}/${total}`
      if (wantsObject) {
        if (shaped.length !== 1) {
          return { status: 406, body: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } }
        }
        return { status, body: shaped[0], headers: extra }
      }
      return { status, body: shaped, headers: extra }
    }

    if (method === 'GET' || method === 'HEAD') {
      let rows = this.visible(table, account).filter(matches)
      const order = url.searchParams.get('order')
      if (order) {
        const keys = order.split(',').map((part) => part.split('.') as [string, string])
        rows = [...rows].sort((a, b) => {
          for (const [column, direction] of keys) {
            const left = String(a[column] ?? '')
            const right = String(b[column] ?? '')
            const numeric = typeof a[column] === 'number' && typeof b[column] === 'number'
            const compared = numeric ? (a[column] as number) - (b[column] as number) : left.localeCompare(right)
            if (compared !== 0) return direction === 'desc' ? -compared : compared
          }
          return 0
        })
      }
      const total = rows.length
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const limit = url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : rows.length
      const page = rows.slice(offset, offset + limit)
      return respond(page, prefer.includes('count=exact') ? 206 : 200, prefer.includes('count=exact') ? total : undefined)
    }

    if (method === 'POST') {
      const items = (Array.isArray(body) ? body : [body]) as Row[]
      const conflict = url.searchParams.get('on_conflict')
      const written: Row[] = []
      for (const item of items) {
        const ownerColumn = OWNER_COLUMN[table]
        if (ownerColumn && item[ownerColumn] !== account.id) {
          return { status: 403, body: { code: '42501', message: 'new row violates row-level security policy' } }
        }
        const existing = conflict ? this.tables[table].find((row) => row[conflict] === item[conflict]) : undefined
        if (existing) {
          Object.assign(existing, item)
          written.push(existing)
          continue
        }
        if (table === 'students' && this.tables.students.some((row) => row.classroom_id === item.classroom_id && row.number === item.number)) {
          return {
            status: 409,
            body: { code: '23505', message: 'duplicate key value violates unique constraint "students_classroom_id_number_key"', details: 'Key (classroom_id, number) already exists.' },
          }
        }
        const now = new Date().toISOString()
        const row: Row = {
          id: uuid(),
          created_at: now,
          ...(['classrooms', 'students', 'random_settings', 'sound_settings'].includes(table) ? { updated_at: now } : {}),
          ...(table === 'random_sessions' ? { started_at: now, ended_at: null } : {}),
          ...(table === 'random_results' ? { points: 0 } : {}),
          ...item,
        }
        this.tables[table].push(row)
        written.push(row)
      }
      return prefer.includes('return=representation') ? respond(written, 201) : { status: 201 }
    }

    if (method === 'PATCH') {
      const rows = this.visible(table, account).filter(matches)
      for (const row of rows) Object.assign(row, body as Row)
      return prefer.includes('return=representation') ? respond(rows) : { status: 204 }
    }

    if (method === 'DELETE') {
      const rows = new Set(this.visible(table, account).filter(matches))
      this.tables[table] = this.tables[table].filter((row) => !rows.has(row))
      if (table === 'classrooms') {
        const removed = new Set([...rows].map((row) => row.id))
        this.tables.students = this.tables.students.filter((row) => !removed.has(row.classroom_id))
      }
      if (table === 'random_sessions') {
        const removed = new Set([...rows].map((row) => row.id))
        this.tables.random_results = this.tables.random_results.filter((row) => !removed.has(row.session_id))
      }
      return { status: 204 }
    }

    return { status: 405, body: { message: `fake supabase: unsupported method ${method}` } }
  }

  private rpc(name: string, args: Row, route: Route): Reply {
    const account = this.userFrom(route)
    const profile = this.profileOf(account)
    if (!account || !profile) return { status: 401, body: { code: '42501', message: 'not_authenticated' } }
    const fail = (message: string, code = 'P0001', status = 400): Reply => ({ status, body: { code, message, details: null, hint: null } })

    switch (name) {
      case 'create_school': {
        if (profile.school_id) return fail('already_in_school')
        const school = { id: uuid(), name: String(args.school_name), join_code: 'NEWC0DE9', created_at: new Date().toISOString() }
        this.tables.schools.push(school)
        Object.assign(profile, { school_id: school.id, role: 'owner', display_name: args.display_name || profile.display_name })
        return { body: [{ school_id: school.id, school_name_out: school.name, join_code: school.join_code, member_role: 'owner' }] }
      }
      case 'join_school': {
        if (profile.school_id) return fail('already_in_school')
        const code = String(args.join_code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
        const school = this.tables.schools.find((row) => row.join_code === code)
        if (!school) return fail('join_code_invalid')
        Object.assign(profile, { school_id: school.id, role: 'teacher', display_name: args.display_name || profile.display_name })
        return { body: [{ school_id: school.id, school_name_out: school.name, member_role: 'teacher' }] }
      }
      case 'get_join_code': {
        if (profile.role === 'teacher') return fail('not_admin', '42501', 403)
        return { body: this.tables.schools.find((row) => row.id === profile.school_id)?.join_code }
      }
      case 'replace_classroom_students': {
        const classroomId = String(args.target_classroom)
        this.tables.students = this.tables.students.filter((row) => row.classroom_id !== classroomId)
        const now = new Date().toISOString()
        const created = (args.new_students as Row[]).map((item) => ({
          id: uuid(),
          school_id: profile.school_id,
          classroom_id: classroomId,
          student_code: '',
          last_name: '',
          nickname: '',
          avatar: '',
          created_at: now,
          updated_at: now,
          ...item,
        }))
        this.tables.students.push(...created)
        return { body: created }
      }
      default:
        return fail(`fake supabase: unsupported rpc ${name}`, 'PGRST202', 404)
    }
  }
}
