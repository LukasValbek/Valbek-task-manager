// Supabase konfigurace
// Nahraďte hodnotami z Supabase Dashboard > Settings > API

const SUPABASE_URL  = 'https://sgwmivknvevoqkuarwgi.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnd21pdmtudmV2b3FrdWFyd2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NzExNzcsImV4cCI6MjA5MzU0NzE3N30.WZM6jZtHyrdknRP8qMCBM5NwNvBO_yEVxdriNcmQJ_g'

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:   true,
    autoRefreshToken: true,
    storageKey:       'tm-session',
  },
  global: {
    headers: { apikey: SUPABASE_ANON }
  }
})
