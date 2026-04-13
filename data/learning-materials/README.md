# 教材メタデータ（アプリ外でも参照用）

## `nikkyou-kentei-guide-v5.json`

**日本語教育能力検定試験 完全攻略ガイド 第5版**（翔泳社 EXAMPRESS）の目次データです。

- ソース・編集の本体: `scripts/learning-materials/nikkyou-kentei-v5-data.mjs`
- DB 投入用 SQL: `supabase/sql/04_nikkyou_kentei_guide_v5_toc.sql`（再生成: `node scripts/generate-nikkyou-toc-sql.mjs --out ...`）

細目（1.1 など）を足す場合は `nikkyou-kentei-v5-data.mjs` の `tocEntries` に追記し、SQL を再生成してください。
