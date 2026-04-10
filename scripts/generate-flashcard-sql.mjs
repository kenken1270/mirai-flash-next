#!/usr/bin/env node
/**
 * JSON（data/flashcards/*.json）から flashcards_v3 用 INSERT SQL を標準出力する。
 * 使い方: node scripts/generate-flashcard-sql.mjs <jsonPath> <set_id>
 *
 * 例: node scripts/generate-flashcard-sql.mjs data/flashcards/minna-shokyu1-lesson20.json 42
 */
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function esc(s) {
  return String(s ?? '').replace(/'/g, "''")
}

function sqlVal(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return `'${esc(v)}'`
}

const jsonPath = process.argv[2]
const setId = parseInt(process.argv[3], 10)

if (!jsonPath || Number.isNaN(setId) || setId < 1) {
  console.error('Usage: node scripts/generate-flashcard-sql.mjs <path-to.json> <set_id>')
  process.exit(1)
}

const abs = resolve(process.cwd(), jsonPath)
const raw = JSON.parse(readFileSync(abs, 'utf8'))
const entries = raw.entries
if (!Array.isArray(entries)) {
  console.error('JSON must have an "entries" array')
  process.exit(1)
}

/** DB に hint 列が無い環境があるため、JSON の hint は README 用。INSERT は下記のみ。 */
const cols = [
  'set_id',
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

console.log('-- Generated from', jsonPath)
console.log('-- set_id =', setId)
console.log('INSERT INTO flashcards_v3 (' + cols.join(', ') + ') VALUES')

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
