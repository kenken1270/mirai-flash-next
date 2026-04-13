#!/usr/bin/env node
/**
 * JSON（data/flashcards/*.json）から flashcards_v3 用 INSERT SQL を標準出力する。
 *
 * 使い方:
 *   node scripts/generate-flashcard-sql.mjs <jsonPath> <set_id>
 *   node scripts/generate-flashcard-sql.mjs <jsonPath> --paste
 *   node scripts/generate-flashcard-sql.mjs <jsonPath> --paste --out supabase/sql/02_....sql
 *
 * --paste … Supabase SQL エディタに貼る用。set_id は WITH 句の 1 か所だけ差し替え。
 * --out … ファイルへ UTF-8 で書き出し（Windows のコンソール文字化け回避用）。
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

function esc(s) {
  return String(s ?? '').replace(/'/g, "''")
}

function sqlVal(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return `'${esc(v)}'`
}

const argv = process.argv.slice(2)
const pasteMode = argv.includes('--paste')
const outIdx = argv.indexOf('--out')
const outPath = outIdx >= 0 ? argv[outIdx + 1] : null
const args = argv.filter((a, i) => {
  if (a === '--paste' || a === '--out') return false
  if (outIdx >= 0 && i === outIdx + 1) return false
  return true
})
const jsonPath = args[0]
const setIdArg = args[1]

if (!jsonPath) {
  console.error(
    'Usage:\n  node scripts/generate-flashcard-sql.mjs <path-to.json> <set_id>\n  node scripts/generate-flashcard-sql.mjs <path-to.json> --paste'
  )
  process.exit(1)
}

if (!pasteMode) {
  const setId = parseInt(setIdArg, 10)
  if (Number.isNaN(setId) || setId < 1) {
    console.error('Usage: node scripts/generate-flashcard-sql.mjs <path-to.json> <set_id>')
    process.exit(1)
  }
}

const abs = resolve(process.cwd(), jsonPath)
const raw = JSON.parse(readFileSync(abs, 'utf8'))
const entries = raw.entries
if (!Array.isArray(entries)) {
  console.error('JSON must have an "entries" array')
  process.exit(1)
}

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

const allCols = ['set_id', ...colsNoSet]

if (pasteMode) {
  const valueRows = entries.map(e => {
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

  const lines = [
    `-- みんなの日本語 初級Ⅰ 第20課 → flashcards_v3`,
    `-- 元JSON: ${jsonPath}`,
    `--`,
    `-- ★ 手順: 先に 01_diagnose_flashcard_state.sql を実行し、flashcard_sets.id を確認`,
    `-- ★ 下の WITH 句の「1」を、使うセットの id にだけ書き換えてから実行`,
    ``,
    `-- （任意）同じ範囲を入れ直す前に既存行を消す場合: コメントを外し、set_id を WITH と同じ値にして先に実行`,
    `-- DELETE FROM flashcards_v3 WHERE set_id = 1 /* WITH と同じ id */ AND page_no = 20 AND item_no BETWEEN 1 AND 25;`,
    ``,
    `WITH p AS (`,
    `  SELECT 1::bigint AS set_id  -- ★★★ ここを flashcard_sets.id に変更 ★★★`,
    `)`,
    `INSERT INTO flashcards_v3 (${allCols.join(', ')})`,
    `SELECT p.set_id, v.item_no, v.page_no, v.lang1, v.lang1_sub, v.lang2, v.lang2_sub, v.lang3, v.lang3_sub, v.difficulty`,
    `FROM (`,
    `  VALUES`,
    `  ` + valueRows.join(`,\n  `),
    `) AS v (${colsNoSet.join(', ')})`,
    `CROSS JOIN p;`,
    ``,
  ]
  const text = lines.join('\n')
  if (outPath) {
    writeFileSync(resolve(process.cwd(), outPath), text, 'utf8')
    console.error('Wrote', outPath)
  } else {
    console.log(text)
  }
  process.exit(0)
}

const setId = parseInt(setIdArg, 10)
console.log('-- Generated from', jsonPath)
console.log('-- set_id =', setId)
console.log('INSERT INTO flashcards_v3 (' + allCols.join(', ') + ') VALUES')

const rows = entries.map(e => {
  const vals = [
    setId,
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

console.log(rows.join(',\n') + ';')
