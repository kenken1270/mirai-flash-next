/** video_themes（動画制作ラボ）の行型 — Supabase と揃える */
export type VideoThemeRow = {
  id: string
  title: string | null
  hook: string | null
  category: string | null
  idea_status: string | null
  selected_idea: string | null
  theme_keyword: string | null
  source: string | null
  tags: unknown
}
