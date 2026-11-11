import { describe, expect, it } from 'vitest'

import { buildContentSecurityPolicy } from './csp.ts'

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split(';').map((part) => {
      const [name = '', ...values] = part.trim().split(/\s+/)
      return [name, values]
    }),
  )
}

describe('buildContentSecurityPolicy', () => {
  it('only allows the configured Supabase project besides the app itself', () => {
    const policy = directives(buildContentSecurityPolicy('https://abcd.supabase.co/'))
    expect(policy.get('connect-src')).toEqual(["'self'", 'blob:', 'data:', 'https://abcd.supabase.co', 'wss://abcd.supabase.co'])
    expect(policy.get('script-src')).toEqual(["'self'"])
    expect(policy.get('object-src')).toEqual(["'none'"])
  })

  it('works without Supabase (local mode)', () => {
    const policy = directives(buildContentSecurityPolicy(undefined))
    expect(policy.get('connect-src')).toEqual(["'self'", 'blob:', 'data:'])
  })

  it('maps http to ws for a local Supabase', () => {
    expect(directives(buildContentSecurityPolicy('http://localhost:54321')).get('connect-src')).toContain('ws://localhost:54321')
  })
})
