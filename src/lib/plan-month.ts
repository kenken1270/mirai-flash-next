import type { PlanRow } from './student'

/** `plans.task_type` の月サマリー行 */
export const MONTH_SUMMARY = 'month_summary'

/**
 * 学習タスク（レッスン等）がカレンダー上のその月に属するか。
 * month_summary 行は常に false。
 */
export function planRowBelongsToMonth(p: PlanRow, month: string): boolean {
  if (p.task_type === MONTH_SUMMARY) return false
  if (p.month_plan && p.month_plan === month) return true
  if (p.task_date && p.task_date.slice(0, 7) === month) return true
  return false
}
