import type { SupabaseClient } from '@supabase/supabase-js'

export const GOAL_PACING_EVENT_TYPE = 'goal_pacing'

export type PaceLevel = 'light' | 'standard' | 'challenge'

export const PACE_LABELS: Record<PaceLevel, { label: string; desc: string; mult: number }> = {
  light: { label: 'ライト', desc: 'ゆるめ（1日の量↓）', mult: 0.7 },
  standard: { label: '標準', desc: '平均的', mult: 1 },
  challenge: { label: 'チャレンジ', desc: '多め（1日の量↑）', mult: 1.3 },
}

export type Requirement =
  | { kind: 'flashcard_books'; bookIds: number[] | null; label: string }
  | { kind: 'learning_pages'; materialName: string; label: string }

export type GoalTemplate = {
  id: string
  title: string
  description: string
  /** 大目標欄に差し込む文例（ユーザーが編集可） */
  bigPlanExample: string
  requirements: Requirement[]
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    id: 'vocab_all',
    title: '単語カード（アプリの全語を数える）',
    description: '登録されている単語カードの総数を目安に、日・月の量を出します。',
    bigPlanExample: '教材の単語を確実に覚え、テスト・作文で使えるようにする。',
    requirements: [{ kind: 'flashcard_books', bookIds: null, label: '単語カード（全書籍）' }],
  },
  {
    id: 'vocab_book',
    title: '単語カード（アプリの1冊だけ）',
    description: '単語帳の1冊だけを対象に、量の目安を出します。',
    bigPlanExample: 'この一冊の単語を期間内にマスターする。',
    requirements: [],
  },
  {
    id: 'textbook_pages',
    title: '教材のページ数（アプリに登録したページ）',
    description: '指定した教材のページ数を「量」として、月・日に分けます。',
    bigPlanExample: '教科書の範囲を学期内に終える。',
    requirements: [],
  },
]

export type BigPlanHorizonUnit = 'days' | 'months' | 'years'

/** 大目標ブロック用：ゴールまでの期間（月計画の「対象月」とは別） */
export type BigPlanHorizon = { unit: BigPlanHorizonUnit; value: number }

export type GoalPacingPayload = {
  templateId: string
  /** textbook_pages 用。空なら未指定 */
  materialName?: string
  /** vocab_book 用 */
  bookId?: number
  pace: PaceLevel
  monthsRemaining: number
  studyDaysPerWeek: number
  updatedAt: string
  /** 大目標：いつまでに何を（全体の〆切イメージ） */
  bigPlanHorizon?: BigPlanHorizon
  /** @deprecated 旧UI。教材と自由文は同時に保存可能 */
  bigPlanFocusKind?: 'material' | 'free'
  /** @deprecated 複数は bigPlanFocusMaterials を使用。読込時の後方互換用 */
  bigPlanFocusMaterial?: string
  /** 大目標で選ぶ教材（複数可） */
  bigPlanFocusMaterials?: string[]
  /** 未登録の教材・過去問などを自由記述（教材と同時可） */
  bigPlanFocusFree?: string
}

export type FetchTemplateOptions = {
  bookId?: number
}

export type CountLine = { label: string; units: number; unitLabel: string }

const IN_CHUNK = 120

async function countFlashcardsInSetIds(client: SupabaseClient, setIds: number[]): Promise<number> {
  if (setIds.length === 0) return 0
  let total = 0
  for (let i = 0; i < setIds.length; i += IN_CHUNK) {
    const chunk = setIds.slice(i, i + IN_CHUNK)
    const { count, error } = await client
      .from('flashcards_v3')
      .select('id', { count: 'exact', head: true })
      .in('set_id', chunk)
    if (error) return 0
    total += count ?? 0
  }
  return total
}

/**
 * 全書籍は「件数だけ」取得（全 set_id を IN に載せない — URL 肥大で失敗・固まりの原因になる）
 */
async function countFlashcardsForBooks(client: SupabaseClient, bookIds: number[] | null): Promise<number> {
  if (!bookIds?.length) {
    const { count, error } = await client
      .from('flashcards_v3')
      .select('id', { count: 'exact', head: true })
    if (error) return 0
    return count ?? 0
  }
  const { data: sets, error: e1 } = await client.from('flashcard_sets').select('id').in('book_id', bookIds)
  if (e1 || !sets?.length) return 0
  const ids = sets.map(s => s.id)
  return countFlashcardsInSetIds(client, ids)
}

async function countLearningPages(client: SupabaseClient, materialName: string): Promise<number> {
  if (!materialName.trim()) return 0
  const { data, error } = await client
    .from('learning_resources')
    .select('page_no, resource_type, material_total_pages')
    .eq('material_name', materialName)
  if (error || !data?.length) return 0

  const fromMeta = data
    .map(d => d.material_total_pages)
    .filter((n): n is number => typeof n === 'number' && n > 0)
  if (fromMeta.length > 0) return Math.max(...fromMeta)

  const pageRows = data.filter(d => d.resource_type === 'page')
  const pages = new Set(pageRows.map(d => d.page_no).filter(Boolean))
  return pages.size
}

/** テンプレートごとに「量」の内訳を集計 */
export async function fetchTemplateCounts(
  client: SupabaseClient,
  templateId: string,
  materialNameForTextbook: string,
  options?: FetchTemplateOptions
): Promise<{ lines: CountLine[]; totalUnits: number }> {
  const tmpl = GOAL_TEMPLATES.find(t => t.id === templateId)
  const lines: CountLine[] = []
  if (!tmpl) return { lines, totalUnits: 0 }

  if (templateId === 'vocab_book') {
    const bid = options?.bookId
    if (!bid) {
      return {
        lines: [{ label: '（書籍を選んでください）', units: 0, unitLabel: '語' }],
        totalUnits: 0,
      }
    }
    const { data: book } = await client.from('flashcard_books').select('id, title').eq('id', bid).maybeSingle()
    const label = book?.title ? `単語カード（${book.title}）` : `単語カード（ID:${bid}）`
    const n = await countFlashcardsForBooks(client, [bid])
    lines.push({ label, units: n, unitLabel: '語' })
    return { lines, totalUnits: n }
  }

  if (templateId === 'textbook_pages') {
    const pages = await countLearningPages(client, materialNameForTextbook)
    lines.push({
      label: materialNameForTextbook || '（教材未指定）',
      units: pages,
      unitLabel: 'ページ',
    })
    return { lines, totalUnits: pages }
  }

  for (const req of tmpl.requirements) {
    if (req.kind === 'flashcard_books') {
      const n = await countFlashcardsForBooks(client, req.bookIds)
      lines.push({ label: req.label, units: n, unitLabel: '語' })
    } else if (req.kind === 'learning_pages') {
      const n = await countLearningPages(client, req.materialName)
      lines.push({ label: req.label, units: n, unitLabel: 'ページ' })
    }
  }
  const totalUnits = lines.reduce((s, l) => s + l.units, 0)
  return { lines, totalUnits }
}

export type PacingResult = {
  pace: PaceLevel
  mult: number
  monthsRemaining: number
  studyDaysPerWeek: number
  /** 1か月あたりの学習日数（ざっくり4週） */
  studyDaysPerMonth: number
  /** 期間内の学習日の合計 */
  totalStudyDays: number
  dailyUnits: number
  monthlyUnits: number
}

const WEEKS_PER_MONTH = 4

/**
 * 残り月数・週◯日学習を前提に、1日・1月の目安量を算出。
 * ペース係数は「標準に対する1日あたりの倍率」（ライト=少なめ、チャレンジ=多め）。
 */
export function computePacing(totalUnits: number, monthsRemaining: number, studyDaysPerWeek: number, pace: PaceLevel): PacingResult {
  const mult = PACE_LABELS[pace].mult
  const m = Math.max(1, monthsRemaining)
  const dWeek = Math.min(7, Math.max(1, studyDaysPerWeek))
  const studyDaysPerMonth = dWeek * WEEKS_PER_MONTH
  const totalStudyDays = Math.max(1, m * studyDaysPerMonth)
  const basePerDay = totalUnits / totalStudyDays
  const dailyUnits = basePerDay * mult
  const monthlyUnits = dailyUnits * studyDaysPerMonth
  return {
    pace,
    mult,
    monthsRemaining: m,
    studyDaysPerWeek: dWeek,
    studyDaysPerMonth,
    totalStudyDays,
    dailyUnits,
    monthlyUnits,
  }
}

/** 月の到達目標テキスト（下書き） */
export function buildMonthSummaryDraft(templateTitle: string, lines: CountLine[], p: PacingResult): string {
  const paceName = PACE_LABELS[p.pace].label
  const head = `【目安・${paceName}】残り${p.monthsRemaining}か月・週${p.studyDaysPerWeek}日`
  const u = lines.reduce((s, x) => s + x.units, 0)
  const body =
    lines.length && u > 0
      ? lines
          .map(l => {
            const share = l.units / u
            const perDay = Math.max(1, Math.ceil(p.dailyUnits * share))
            return `・${l.label}（全${l.units}${l.unitLabel}）→ 約${perDay}${l.unitLabel}/日`
          })
          .join('\n')
      : '・データがまだありません。教材・単語が登録されると目安が出ます。'
  return [head, `テーマ：${templateTitle}`, body, '（※自動目安。調整してOK）'].join('\n')
}
