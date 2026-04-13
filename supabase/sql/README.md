# Supabase 用 SQL（コピペ運用）

## 手順（みんなの日本語 第20課を入れる場合）

1. `**01_diagnose_flashcard_state.sql**` を Supabase の SQL Editor に貼り付けて実行する。
  - 書籍・セットの `id`、既に `page_no = 20` のデータの有無が分かる。
2. `**02_insert_minna_lesson20_flashcards.sql**` を開き、`**WITH p AS` 内の `1**` を、手順1で確認した `**flashcard_sets.id`（使うセット）** にだけ書き換える。
  - 同じ内容を入れ直すときは、ファイル先頭の `DELETE` のコメントを外し、`set_id` を同じ値にしてから実行してから `INSERT` する。
3. 書き換えた `**02_...sql` 全文** を SQL Editor に貼り付けて実行する。

## 有村先生アカウント（パスワード 1270）

Supabase Auth は **メールの @ より前に日本語など非ASCIIが使えません**。  
そのため **ログインID（username / メール左側）は英数字**、**画面表示は `nickname`** に分けています。

1. `**03_seed_user_arimura_sensei.sql**` を実行（`username = arimura_sensei`, `nickname = 有村先生`）。
2. **Authentication → Users** でユーザーを作成
  メール: `**arimura_sensei@mirai-juku.internal`**、パスワード: `**1270**`、Auto Confirm。
3. ログイン画面の生徒タブでは **「有村先生」** と表示され、パスワード `**1270`** で入る。

※ 生徒ログインは **入力したパスワード** と **従来の共通パスワード（Mirai2026）** の両方を試します。

## 日本語教育能力検定 完全攻略ガイド 第5版（目次）

1. **`04_nikkyou_kentei_guide_v5_toc.sql`** を SQL Editor で実行（`learning_resources` に `resource_type: toc` と書誌メタ `common` を投入）。
2. 目次を編集したい場合は `scripts/learning-materials/nikkyou-kentei-v5-data.mjs` を直し、  
   `node scripts/generate-nikkyou-toc-sql.mjs --out supabase/sql/04_nikkyou_kentei_guide_v5_toc.sql` で再生成。

## かなマスター（初級）

1. **`05_insert_kana_master_flashcards.sql`** を SQL Editor で実行すると、`flashcard_books` / `flashcard_sets` / `flashcards_v3` に **ひら→カタ→単語** のかなコースが一括投入される（`item_no` は連番、`page_no` で層を区別）。
2. 同タイトルで再投入すると書籍が重複する。差し替えるときは該当 `book` / `set` / `cards` を先に削除するか、`scripts/generate-kana-beginner.mjs` を編集してから `node scripts/generate-kana-beginner.mjs` で JSON / SQL を再生成する。

## 再生成

JSON を直したあと、次で `02` を上書きできる（UTF-8 で保存）。

```bash
node scripts/generate-flashcard-sql.mjs data/flashcards/minna-shokyu1-lesson20.json --paste --out supabase/sql/02_insert_minna_lesson20_flashcards.sql
```

