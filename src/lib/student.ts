import { supabase } from './supabase'

export type UserRow = {
  exp?: number
  id: number
  username: string
  current_points: number
  last_login_date: string
  streak: number
  last_visit_date: string
  recent_login_dates: string
  nickname: string
  lang: string
  grade_num: number
  current_status: string
  status_updated_at: string
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
  see_score?: number
  see_comment?: string
  teacher_stamp?: boolean
  stamp_at?: string
}

export type EventRow = {
  id: number
  username: string
  event_name: string
  event_date: string
  event_type: string
  note: string
}

// ===========================
// ユーザー関数
// ===========================
export async function loadAllUsers(): Promise<UserRow[]> {
  const { data } = await supabase.from('users').select('*')
  return data ?? []
}

export async function loadUser(username: string): Promise<UserRow | null> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single()
  return data ?? null
}

export async function saveUserFields(username: string, fields: Partial<UserRow>): Promise<void> {
  await supabase.from('users').update(fields).eq('username', username)
}

// ===========================
// ニュース関数
// ===========================
export async function loadNews(): Promise<NewsRow[]> {
  const { data } = await supabase
    .from('news')
    .select('*')
    .order('created_date', { ascending: false })
  return data ?? []
}

export async function insertNews(row: Omit<NewsRow, 'id'>): Promise<void> {
  await supabase.from('news').insert(row)
}

export async function deleteNews(id: number): Promise<void> {
  await supabase.from('news').delete().eq('id', id)
}

// ===========================
// プラン関数
// ===========================
export async function loadPlans(username: string): Promise<PlanRow[]> {
  const { data } = await supabase
    .from('plans')
    .select('*')
    .eq('username', username)
    .order('id')
  return data ?? []
}

export async function updatePlan(id: number, fields: Partial<PlanRow>): Promise<void> {
  await supabase.from('plans').update(fields).eq('id', id)
}

export async function insertPlan(row: Omit<PlanRow, 'id'>): Promise<void> {
  await supabase.from('plans').insert(row)
}

export async function deletePlan(id: number): Promise<void> {
  await supabase.from('plans').delete().eq('id', id)
}

export async function loadAllPlans(): Promise<PlanRow[]> {
  const { data } = await supabase.from('plans').select('*').order('id')
  return data ?? []
}

// ===========================
// イベント関数
// ===========================
export async function loadEvents(username: string): Promise<EventRow[]> {
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('username', username)
    .order('event_date')
  return data ?? []
}

export async function insertEvent(row: Omit<EventRow, 'id'>): Promise<void> {
  await supabase.from('events').insert(row)
}

export async function deleteEvent(id: number): Promise<void> {
  await supabase.from('events').delete().eq('id', id)
}

// ===========================
// ユーティリティ
// ===========================
export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}