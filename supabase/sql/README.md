# Supabase 用 SQL（コピペ運用）

## 手順（みんなの日本語 第20課を入れる場合）

1. **`01_diagnose_flashcard_state.sql`** を Supabase の SQL Editor に貼り付けて実行する。  
   - 書籍・セットの `id`、既に `page_no = 20` のデータの有無が分かる。

2. **`02_insert_minna_lesson20_flashcards.sql`** を開き、**`WITH p AS` 内の `1`** を、手順1で確認した **`flashcard_sets.id`（使うセット）** にだけ書き換える。  
   - 同じ内容を入れ直すときは、ファイル先頭の `DELETE` のコメントを外し、`set_id` を同じ値にしてから実行してから `INSERT` する。

3. 書き換えた **`02_...sql` 全文** を SQL Editor に貼り付けて実行する。

## 再生成

JSON を直したあと、次で `02` を上書きできる（UTF-8 で保存）。

```bash
node scripts/generate-flashcard-sql.mjs data/flashcards/minna-shokyu1-lesson20.json --paste --out supabase/sql/02_insert_minna_lesson20_flashcards.sql
```
