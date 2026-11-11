import type { Plugin } from 'vite'

/**
 * Content-Security-Policy for the production build, as a <meta> tag so it travels with the files to
 * any static host. The Supabase origin comes from the build's environment, so `connect-src` allows
 * exactly the project the build talks to — nothing else.
 *
 * - `style-src 'unsafe-inline'`: Framer Motion and Sonner insert <style> elements at runtime.
 * - `blob:` in `connect-src`/`media-src`: sound effects are synthesised into WAV blobs and loaded from there.
 * - `frame-ancestors` cannot be set from a <meta> tag; the hosting headers (vercel.json, public/_headers) set it.
 */
export function buildContentSecurityPolicy(supabaseUrl: string | undefined): string {
  const connect = ["'self'", 'blob:', 'data:']
  if (supabaseUrl) {
    const origin = new URL(supabaseUrl).origin
    connect.push(origin, origin.replace(/^http/, 'ws'))
  }
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connect.join(' ')}`,
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

/** Adds the policy to index.html at build time. The dev server is left alone (it needs inline scripts for HMR). */
export function contentSecurityPolicy(supabaseUrl: string | undefined): Plugin {
  const policy = buildContentSecurityPolicy(supabaseUrl)
  return {
    name: 'ngsr:content-security-policy',
    apply: 'build',
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }]
    },
  }
}
