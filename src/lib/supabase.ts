import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const requirePublicEnv = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`Falta la variable pública ${name}`)
  return value
}

const supabaseUrl = requirePublicEnv(import.meta.env.VITE_SUPABASE_URL, 'VITE_SUPABASE_URL')
const supabasePublishableKey = requirePublicEnv(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, 'VITE_SUPABASE_PUBLISHABLE_KEY')

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: window.sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
