import { createClient } from '@supabase/supabase-js'

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  if (typeof window !== 'undefined' && (!url || !key)) {
    console.error(
      '[Mirai] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が空です。.env.local を確認してください。'
    )
  }
  return createClient(url, key)
}

export const supabase = getSupabase()