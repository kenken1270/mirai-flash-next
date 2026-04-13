#!/usr/bin/env node
/**
 * 初級かな（清音→濁音・半濁音→拗音→単語）の JSON と Supabase 用 SQL を生成する。
 *
 *   node scripts/generate-kana-beginner.mjs
 *
 * 出力:
 *   data/flashcards/kana-beginner.json
 *   supabase/sql/05_insert_kana_master_flashcards.sql
 */
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'

function esc(s) {
  return String(s ?? '').replace(/'/g, "''")
}

function sqlVal(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return `'${esc(v)}'`
}

function hiraToKata(str) {
  return [...str].map((ch) => {
    const cp = ch.codePointAt(0)
    if (cp >= 0x3041 && cp <= 0x3096) return String.fromCodePoint(cp + 0x60)
    return ch
  }).join('')
}

const ROW_NAMES = ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ']

const HIRA_SEION = [
  ['あ', 'い', 'う', 'え', 'お'],
  ['か', 'き', 'く', 'け', 'こ'],
  ['さ', 'し', 'す', 'せ', 'そ'],
  ['た', 'ち', 'つ', 'て', 'と'],
  ['な', 'に', 'ぬ', 'ね', 'の'],
  ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  ['ま', 'み', 'む', 'め', 'も'],
  ['や', 'ゆ', 'よ'],
  ['ら', 'り', 'る', 'れ', 'ろ'],
  ['わ', 'を', 'ん'],
]

const ROMAJI_SEION = [
  ['a', 'i', 'u', 'e', 'o'],
  ['ka', 'ki', 'ku', 'ke', 'ko'],
  ['sa', 'shi', 'su', 'se', 'so'],
  ['ta', 'chi', 'tsu', 'te', 'to'],
  ['na', 'ni', 'nu', 'ne', 'no'],
  ['ha', 'hi', 'fu', 'he', 'ho'],
  ['ma', 'mi', 'mu', 'me', 'mo'],
  ['ya', 'yu', 'yo'],
  ['ra', 'ri', 'ru', 're', 'ro'],
  ['wa', 'o', 'n'],
]

const HIRA_DAKU = [
  ['が', 'ぎ', 'ぐ', 'げ', 'ご'],
  ['ざ', 'じ', 'ず', 'ぜ', 'ぞ'],
  ['だ', 'ぢ', 'づ', 'で', 'ど'],
  ['ば', 'び', 'ぶ', 'べ', 'ぼ'],
]

const ROMAJI_DAKU = [
  ['ga', 'gi', 'gu', 'ge', 'go'],
  ['za', 'ji', 'zu', 'ze', 'zo'],
  ['da', 'ji', 'zu', 'de', 'do'],
  ['ba', 'bi', 'bu', 'be', 'bo'],
]

const HIRA_HAND = [['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ']]
const ROMAJI_HAND = [['pa', 'pi', 'pu', 'pe', 'po']]

const DAKU_ROW_NAMES = ['が', 'ざ', 'だ', 'ば']
const HAND_ROW_NAME = 'ぱ'

/** 拗音（ひらがな・ローマ字） */
const YOON = [
  ['きゃ', 'kya'],
  ['きゅ', 'kyu'],
  ['きょ', 'kyo'],
  ['しゃ', 'sha'],
  ['しゅ', 'shu'],
  ['しょ', 'sho'],
  ['ちゃ', 'cha'],
  ['ちゅ', 'chu'],
  ['ちょ', 'cho'],
  ['にゃ', 'nya'],
  ['にゅ', 'nyu'],
  ['にょ', 'nyo'],
  ['ひゃ', 'hya'],
  ['ひゅ', 'hyu'],
  ['ひょ', 'hyo'],
  ['みゃ', 'mya'],
  ['みゅ', 'myu'],
  ['みょ', 'myo'],
  ['りゃ', 'rya'],
  ['りゅ', 'ryu'],
  ['りょ', 'ryo'],
  ['ぎゃ', 'gya'],
  ['ぎゅ', 'gyu'],
  ['ぎょ', 'gyo'],
  ['じゃ', 'ja'],
  ['じゅ', 'ju'],
  ['じょ', 'jo'],
  ['びゃ', 'bya'],
  ['びゅ', 'byu'],
  ['びょ', 'byo'],
  ['ぴゃ', 'pya'],
  ['ぴゅ', 'pyu'],
  ['ぴょ', 'pyo'],
]

/** 短い単語（読み練習）: [romaji, ひらがな, 注記] */
const WORDS = [
  ['ai', 'あい', '愛・相'],
  ['ie', 'いえ', '家'],
  ['ue', 'うえ', '上'],
  ['eki', 'えき', '駅'],
  ['ongaku', 'おんがく', '音楽'],
  ['kaze', 'かぜ', '風・風邪'],
  ['kiku', 'きく', '聞く'],
  ['kuchi', 'くち', '口'],
  ['keeki', 'けーき', 'ケーキ'],
  ['kokoro', 'こころ', '心'],
  ['sakura', 'さくら', '桜'],
  ['shima', 'しま', '島'],
  ['suzuki', 'すずき', '鈴木'],
  ['sensei', 'せんせい', '先生'],
  ['tako', 'たこ', '凧・蛸'],
  ['chizu', 'ちず', '地図'],
  ['tsuki', 'つき', '月'],
  ['denwa', 'でんわ', '電話'],
  ['tokyo', 'とうきょう', '東京'],
  ['niku', 'にく', '肉'],
  ['neko', 'ねこ', '猫'],
  ['nori', 'のり', '乗り・海苔'],
  ['hana', 'はな', '花・鼻'],
  ['hikari', 'ひかり', '光'],
  ['fune', 'ふね', '船'],
  ['heya', 'へや', '部屋'],
  ['hotaru', 'ほたる', '蛍'],
  ['mizu', 'みず', '水'],
  ['yama', 'やま', '山'],
  ['yuki', 'ゆき', '雪'],
  ['yoru', 'よる', '夜'],
  ['ringo', 'りんご', '林檎'],
  ['watashi', 'わたし', '私'],
]

function rowLabelForSeion(rowIdx, colIdx) {
  const base = ROW_NAMES[rowIdx] ?? ''
  return `${base}行`
}

function buildEntries() {
  const entries = []
  let item = 1

  function push(pageNo, lang1, lang2, lang3, lang3Sub) {
    entries.push({
      item_no: item++,
      page_no: pageNo,
      lang1,
      lang1_sub: '',
      lang2,
      lang2_sub: '',
      lang3,
      lang3_sub: lang3Sub,
      difficulty: 1,
    })
  }

  // 1: ひらがな 清音
  HIRA_SEION.forEach((row, ri) => {
    row.forEach((h, ci) => {
      const romaji = ROMAJI_SEION[ri][ci]
      const sub = rowLabelForSeion(ri, ci)
      push(1, romaji, h, 'ひらがな・清音', sub)
    })
  })

  // 2: ひらがな 濁音・半濁音
  HIRA_DAKU.forEach((row, ri) => {
    row.forEach((h, ci) => {
      const romaji = ROMAJI_DAKU[ri][ci]
      const sub = `${DAKU_ROW_NAMES[ri]}行`
      push(2, romaji, h, 'ひらがな・濁音', sub)
    })
  })
  HIRA_HAND[0].forEach((h, ci) => {
    const romaji = ROMAJI_HAND[0][ci]
    push(2, romaji, h, 'ひらがな・半濁音', `${HAND_ROW_NAME}行`)
  })

  // 3: ひらがな 拗音
  YOON.forEach(([h, r]) => {
    push(3, r, h, 'ひらがな・拗音', h)
  })

  // 4–6: カタカナ（同順）
  HIRA_SEION.forEach((row, ri) => {
    row.forEach((h, ci) => {
      const romaji = ROMAJI_SEION[ri][ci]
      const k = hiraToKata(h)
      const sub = rowLabelForSeion(ri, ci)
      push(4, romaji, k, 'カタカナ・清音', sub)
    })
  })
  HIRA_DAKU.forEach((row, ri) => {
    row.forEach((h, ci) => {
      const romaji = ROMAJI_DAKU[ri][ci]
      const k = hiraToKata(h)
      const sub = `${DAKU_ROW_NAMES[ri]}行`
      push(5, romaji, k, 'カタカナ・濁音', sub)
    })
  })
  HIRA_HAND[0].forEach((h, ci) => {
    const romaji = ROMAJI_HAND[0][ci]
    const k = hiraToKata(h)
    push(5, romaji, k, 'カタカナ・半濁音', `${HAND_ROW_NAME}行`)
  })
  YOON.forEach(([h, r]) => {
    const k = hiraToKata(h)
    push(6, r, k, 'カタカナ・拗音', h)
  })

  // 7: 単語
  WORDS.forEach(([r, h, note]) => {
    push(7, r, h, '単語', note)
  })

  return entries
}

const entries = buildEntries()

const jsonPath = resolve(process.cwd(), 'data/flashcards/kana-beginner.json')
mkdirSync(dirname(jsonPath), { recursive: true })
writeFileSync(jsonPath, JSON.stringify({ title: 'かなマスター（初級）', entries }, null, 2), 'utf8')

const colsNoSet = [
  'item_no',
  'page_no',
  'lang1',
  'lang1_sub',
  'lang2',
  'lang2_sub',
  'lang3',
  'lang3_sub',
  'difficulty',
]

const valueRows = entries.map((e) => {
  const vals = [
    e.item_no,
    e.page_no ?? null,
    e.lang1 ?? '',
    e.lang1_sub ?? '',
    e.lang2 ?? '',
    e.lang2_sub ?? '',
    e.lang3 ?? '',
    e.lang3_sub ?? '',
    e.difficulty ?? 1,
  ]
  return '(' + vals.map(sqlVal).join(', ') + ')'
})

const sqlText = `-- かなマスター（初級）— flashcard_books / flashcard_sets / flashcards_v3 を一括投入
-- 清音→濁音・半濁音→拗音（ひら→カタ）→短い単語。item_no は 1 から連番、page_no で層を区別。
--
-- page_no 目安: 1=ひら清音 2=ひら濁半 3=ひら拗音 4=カタ清音 5=カタ濁半 6=カタ拗音 7=単語
--
-- ★ 再実行する場合: 同タイトルの書籍が既にあると重複します。先に該当 book / set / cards を削除するか、
--    下のブロックをコメントアウトして cards のみ手動で投入してください。

WITH new_book AS (
  INSERT INTO flashcard_books (title, subtitle, category, cover_emoji, lang1_label, lang2_label)
  VALUES (
    'かなマスター（初級）',
    'ひらがな・カタカナ（清音→濁音・半濁音→拗音→単語）',
    '日本語',
    '🔤',
    'ローマ字',
    'かな'
  )
  RETURNING id
),
new_set AS (
  INSERT INTO flashcard_sets (book_id, set_name, category, lang1_label, lang2_label, lang1_tts_lang, lang2_tts_lang)
  SELECT id, 'かなフルコース（全241枚）', '日本語', 'ローマ字', 'かな', 'en-US', 'ja-JP' FROM new_book
  RETURNING id
)
INSERT INTO flashcards_v3 (set_id, item_no, page_no, lang1, lang1_sub, lang2, lang2_sub, lang3, lang3_sub, difficulty)
SELECT s.id, v.item_no, v.page_no, v.lang1, v.lang1_sub, v.lang2, v.lang2_sub, v.lang3, v.lang3_sub, v.difficulty
FROM (
  VALUES
  ${valueRows.join(',\n  ')}
) AS v (${colsNoSet.join(', ')})
CROSS JOIN new_set s;
`

const sqlPath = resolve(process.cwd(), 'supabase/sql/05_insert_kana_master_flashcards.sql')
writeFileSync(sqlPath, sqlText, 'utf8')

console.error('Wrote', jsonPath)
console.error('Wrote', sqlPath, `(${entries.length} cards)`)
