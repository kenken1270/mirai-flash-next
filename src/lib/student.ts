import { supabase } from './supabase'

export type UserRow = {
  id: number
  username: string
  current_points: number
  last_login_date: string
  streak: number
  last_visit_date: string
  recent_login_dates: string
  nickname: string
  lang: string
}

export type NewsRow = {
  id: number
  message: string
  created_date: string
  target_user: string
}

export type PlanRow = {
  id: number
  username: string
  big_plan: string
  mid_plan: string
  task_name: string
  task_date: string
  is_done: number
  video_url: string
  material_id: string
  page_range: string
  deadline: string
  month_plan: string
  task_type: string
  planned_minutes?: number
  actual_minutes?: number
}

export type EventRow = {
  id: number
  username: string
  event_name: string
  event_date: string
  event_type: string
  note: string
}

// ─────────────────────────────
// ユーザー
// ─────────────────────────────
export async function loadAllUsers(): Promise<UserRow[]> {
  const { data } = await supabase.from('users').select('*')
  return data ?? []
}

export async function loadUser(username: string): Promise<UserRow | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .limit(1)
  if (error) {
    console.error('loadUser error:', error)
    return null
  }
  return (data && data.length > 0) ? data[0] : null
}

export async function saveUserFields(username: string, fields: Partial<UserRow>) {
  const { error } = await supabase
    .from('users')
    .update(fields)
    .eq('username', username)
  if (error) console.error('saveUserFields error:', error)
}

// ─────────────────────────────
// お知らせ
// ─────────────────────────────
export async function loadNews(): Promise<NewsRow[]> {
  const { data } = await supabase
    .from('news')
    .select('*')
    .order('created_date', { ascending: false })
  return data ?? []
}

export async function insertNews(message: string, createdDate: string, targetUser: string) {
  await supabase.from('news').insert({
    message,
    created_date: createdDate,
    target_user: targetUser,
  })
}

export async function deleteNews(id: number) {
  await supabase.from('news').delete().eq('id', id)
}

// ─────────────────────────────
// 計画
// ─────────────────────────────
export async function loadPlans(): Promise<PlanRow[]> {
  const { data } = await supabase.from('plans').select('*')
  return data ?? []
}

export async function updatePlan(id: number, fields: Partial<PlanRow>) {
  await supabase.from('plans').update(fields).eq('id', id)
}

export async function insertPlan(row: Omit<PlanRow, 'id'>) {
  await supabase.from('plans').insert(row)
}

export async function deletePlan(id: number) {
  await supabase.from('plans').delete().eq('id', id)
}

// ─────────────────────────────
// イベント
// ─────────────────────────────
export async function loadEvents(username: string): Promise<EventRow[]> {
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('username', username)
    .order('event_date')
  return data ?? []
}

export async function insertEvent(row: Omit<EventRow, 'id'>) {
  await supabase.from('events').insert(row)
}

export async function deleteEvent(id: number) {
  await supabase.from('events').delete().eq('id', id)
}

// ─────────────────────────────
// 日付ユーティリティ
// ─────────────────────────────
export function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}
export async function loadAllPlans(): Promise<PlanRow[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('id', { ascending: true })
  if (error || !data) return []
  return data as PlanRow[]
}