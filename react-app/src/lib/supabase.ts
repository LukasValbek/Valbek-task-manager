import { createClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string
const url    = rawUrl ? new URL(rawUrl).origin : rawUrl
const anon   = import.meta.env.VITE_SUPABASE_ANON as string

export const supabase = createClient(url, anon, {
  auth: {
    persistSession:   true,
    autoRefreshToken: true,
    storageKey:       'tm-session',
  },
})
