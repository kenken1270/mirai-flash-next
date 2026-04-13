#!/usr/bin/env node
/**
 * nikkyou-kentei-v5-data.mjs から learning_resources 用 INSERT SQL を出力する。
 * 使い方:
 *   node scripts/generate-nikkyou-toc-sql.mjs
 *   node scripts/generate-nikkyou-toc-sql.mjs --out supabase/sql/04_nikkyou_kentei_guide_v5_toc.sql
 */
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import { MATERIAL, tocEntries } from './learning-materials/nikkyou-kentei-v5-data.mjs'

function esc(s) {
  return String(s ?? '').replace(/'/g, "''")
}

const metaExplanation = [
  `【${MATERIAL.meta.tagline}】`,
  `著：${MATERIAL.meta.authors}／刊：${MATERIAL.meta.publisher}（${MATERIAL.meta.imprint}）`,
  `版：${MATERIAL.meta.edition}。${MATERIAL.meta.notes}`,
].join('\n')

const rows = []
rows.push('-- 日本語教育能力検定試験 完全攻略ガイド 第5版 → learning_resources')
rows.push('-- 生成: node scripts/generate-nikkyou-toc-sql.mjs')
rows.push('')
rows.push(
  `INSERT INTO public.learning_resources (material_name, page_no, resource_type, explanation, hint_text, video_url, image_url) VALUES`
)

const valueLines = []
valueLines.push(
  `('${esc(MATERIAL.material_name)}', '0', 'common', '${esc(metaExplanation)}', '${esc(JSON.stringify({ role: 'book_meta', ...MATERIAL.meta }))}', '', '')`
)

tocEntries.forEach((e, i) => {
  valueLines.push(
    `('${esc(MATERIAL.material_name)}', '${e.page}', 'toc', '${esc(e.title)}', '${esc(JSON.stringify({ depth: e.depth, seq: i + 1 }))}', '', '')`
  )
})

rows.push(valueLines.join(',\n') + ';')
rows.push('')
rows.push(
  `UPDATE public.learning_resources SET material_total_pages = ${MATERIAL.material_total_pages} WHERE material_name = '${esc(MATERIAL.material_name)}';`
)
rows.push('')

const text = rows.join('\n')
const outArg = process.argv.indexOf('--out')
if (outArg >= 0 && process.argv[outArg + 1]) {
  const outPath = resolve(process.cwd(), process.argv[outArg + 1])
  writeFileSync(outPath, text, 'utf8')
  console.error('Wrote', outPath)
} else {
  console.log(text)
}
