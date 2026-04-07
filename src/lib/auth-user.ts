import type { Session } from '@supabase/supabase-js'

/**
 * Supabase Auth のメールから、アプリ内の `users.username` / `plans.username` /
 * `review_logs.username` 等と一致させるためのユーザーID（@ より前のローカル部）を返す。
 * `user@mirai-juku.internal` も `user@example.com` も同じルールで扱う。
 */
export function usernameFromEmail(email: string | null | undefined): string {
  if (!email) return ''
  const at = email.indexOf('@')
  if (at === -1) return email.trim()
  return email.slice(0, at).trim()
}

export function getUsernameFromSession(session: Session | null | undefined): string {
  return usernameFromEmail(session?.user?.email)
}
