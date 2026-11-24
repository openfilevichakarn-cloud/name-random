/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://xyzcompany.supabase.co. Leave unset for local-only mode. */
  readonly VITE_SUPABASE_URL?: string
  /** Publishable (client-side) key: `sb_publishable_…`, or a legacy anon key. Never the secret/service key. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Google OAuth client id (Web application) for Google Drive sync. Leave unset to hide the feature. */
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
