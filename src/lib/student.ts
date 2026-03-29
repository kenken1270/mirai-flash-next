import { supabase } from '@/lib/supabase'

// ─────────────────────────────
// フラッシュカード v3
// ─────────────────────────────
export type FlashCardSet = {
  id: number
  set_name: string
  category: string
  grade: string
  subject: string
  tts_lang: string
  card_type: string
  lang1_label: string
  lang2_label: string
  lang3_label: string
  lang1_tts_lang: string
  lang2_tts_lang: string
  lang3_tts_lang: string | null
}

export type FlashCardV3 = {
  id: number
  set_id: number
  item_no: number
  lang1: string
  lang1_sub: string | null
  lang2: string
  lang2_sub: string | null
  lang3: string | null
  lang3_sub: string | null
  tts_lang1: string | null
  tts_lang2: string | null
  tts_lang3: string | null
  hint: string | null
  image_url: string | null
  tags: string[] | null
  page_range: string | null
  difficulty: number
}

export async function loadFlashCardSet(setId: number): Promise<FlashCardSet | null> {
  const { data, error } = await supabase
    .from('flashcard_sets')
    .select('*')
    .eq('id', setId)
    .limit(1)
  if (error) { console.error('loadFlashCardSet error:', error); return null }
  return data?.[0] ?? null
}

export async function loadFlashCardsV3(setId: number): Promise<FlashCardV3[]> {
  const { data, error } = await supabase
    .from('flashcards_v3')
    .select('*')
    .eq('set_id', setId)
    .order('item_no')
  if (error) { console.error('loadFlashCardsV3 error:', error); return [] }
  return data ?? []
}
