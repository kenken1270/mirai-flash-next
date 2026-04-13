/**
 * ローマ字教材: Web Speech の英語エンジンでは発音がずれるため、
 * 表示がローマ字でも読み上げはかな（lang2）を ja-JP で行う判定。
 */

export const KANA_IN_TEXT = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff]/

/** 表面がローマ字入力っぽい（英単語教材と区別するため、かなを含まない） */
function looksLikeRomajiSurface(lang1: string): boolean {
  const s = (lang1 ?? '').trim()
  if (!s) return false
  if (KANA_IN_TEXT.test(s)) return false
  return /^[a-zA-Zāēīōūǎáàéèíìóòúùɯ\-・\s']+$/i.test(s)
}

/** 書籍／セットのラベルから「ローマ字↔かな」教材か推定（NFKC で正規化） */
export function labelIsRomajiKanaCourse(lang1Label: string, lang2Label?: string): boolean {
  const a = (lang1Label ?? '').normalize('NFKC')
  const b = (lang2Label ?? '').normalize('NFKC')
  if (a.includes('ローマ字')) return true
  if (b.includes('かな') || b.includes('カナ')) {
    if (a.includes('ローマ') || /romaji/i.test(a)) return true
  }
  return false
}

/**
 * ラベルが取れない／ずれている場合でも、カードの分類（lang3）でかな教材と分かるならかなで読む。
 * 例: lang3「ひらがな・清音」、lang1「n」、lang2「ん」
 */
function cardLooksLikeKanaCourseRow(card: { lang1: string; lang2: string; lang3?: string }): boolean {
  const cat = (card.lang3 ?? '').normalize('NFKC')
  if (!cat) return false
  if (!(cat.includes('ひらがな') || cat.includes('カタカナ') || cat.includes('単語'))) return false
  if (!looksLikeRomajiSurface(card.lang1)) return false
  return KANA_IN_TEXT.test(card.lang2)
}

export function shouldReadKanaInsteadOfRomaji(
  lang1Label: string,
  lang2Label: string | undefined,
  card: { lang1: string; lang2: string; lang3?: string }
): boolean {
  if (!card.lang2?.trim()) return false
  if (!KANA_IN_TEXT.test(card.lang2)) return false
  if (labelIsRomajiKanaCourse(lang1Label, lang2Label)) return true
  if (cardLooksLikeKanaCourseRow(card)) return true
  return false
}

export function ttsLangForLang1Label(lang1Label: string): string {
  const L = lang1Label ?? ''
  if (L.includes('英語') || L.includes('英')) return 'en-US'
  if (L.includes('中国語') || L.includes('中')) return 'zh-CN'
  if (L.includes('日本語') || L.includes('日')) return 'ja-JP'
  return 'en-US'
}

/** 学習画面: ユーザーが選ぶ読み上げモード（localStorage `mirai.flash.studyTtsReadMode`） */
export type TtsReadMode = 'auto' | 'kana' | 'literal'

export const STUDY_TTS_MODE_STORAGE_KEY = 'mirai.flash.studyTtsReadMode'

export function readTtsReadModeFromStorage(): TtsReadMode {
  if (typeof window === 'undefined') return 'kana'
  const v = localStorage.getItem(STUDY_TTS_MODE_STORAGE_KEY)
  if (v === 'kana' || v === 'literal' || v === 'auto') return v
  return 'kana'
}

/**
 * 学習画面の表面 🔊・自動読み上げ用。
 * - `literal`: 常に lang1 + セットの TTS 言語（ローマ字は英語読みになりやすい）
 * - `kana`: かな教材のときは常に lang2 を ja-JP（判定はラベル＋lang3）
 * - `auto`: 従来の自動判定（speechForLang1Column）
 */
export function resolveStudyFrontSpeech(
  lang1Label: string,
  lang2Label: string | undefined,
  card: { lang1: string; lang2: string; lang3?: string },
  mode: TtsReadMode,
  ttsLang1: string
): { text: string; lang: string } {
  if (mode === 'literal') {
    return { text: card.lang1, lang: ttsLang1 }
  }
  if (mode === 'kana') {
    const isKanaCourse =
      labelIsRomajiKanaCourse(lang1Label, lang2Label) || cardLooksLikeKanaCourseRow(card)
    if (isKanaCourse && card.lang2?.trim() && KANA_IN_TEXT.test(card.lang2)) {
      return { text: card.lang2, lang: 'ja-JP' }
    }
    return speechForLang1Column(lang1Label, lang2Label, card)
  }
  return speechForLang1Column(lang1Label, lang2Label, card)
}

/** 学習・一覧: 表面（lang1 列）の読み上げ用テキストと言語 */
export function speechForLang1Column(
  lang1Label: string,
  lang2Label: string | undefined,
  card: { lang1: string; lang2: string; lang3?: string }
): { text: string; lang: string } {
  if (shouldReadKanaInsteadOfRomaji(lang1Label, lang2Label, card)) {
    return { text: card.lang2, lang: 'ja-JP' }
  }
  return { text: card.lang1, lang: ttsLangForLang1Label(lang1Label) }
}

/** 小テスト: 出題プロンプトの読み上げ（lang1→lang2 ならローマ字教材はかなで読む） */
export function speechForQuizPrompt(
  card: { lang1: string; lang2: string; lang3?: string },
  direction: 'lang1to2' | 'lang2to1',
  lang1Label: string,
  lang2Label: string
): { text: string; lang: string } {
  if (direction === 'lang2to1') {
    return { text: card.lang2, lang: 'ja-JP' }
  }
  if (shouldReadKanaInsteadOfRomaji(lang1Label, lang2Label, card)) {
    return { text: card.lang2, lang: 'ja-JP' }
  }
  return { text: card.lang1, lang: ttsLangForLang1Label(lang1Label) }
}
