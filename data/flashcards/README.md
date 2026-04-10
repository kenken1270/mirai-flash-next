# フラッシュカード用データ（教材単語）

## ファイル

| ファイル | 内容 |
|----------|------|
| `minna-shokyu1-lesson20.json` | みんなの日本語 初級Ⅰ・第20課の単語（25語）。アプリの `flashcards_v3` と同じ意味の列名。 |

## 列の対応（`flashcards_v3`）

アプリの仕様（`docs/ai-context.md`）に合わせています。

| JSON フィールド | DB 列 | この教材での内容 |
|-----------------|-------|------------------|
| `lang1` | `lang1` | 中国語（意味・用法メモ） |
| `lang1_sub` | `lang1_sub` | 補足（任意） |
| `lang2` | `lang2` | 日本語見出し（丁寧形・語形のメモ含む） |
| `lang2_sub` | `lang2_sub` | 辞書形など（動詞） |
| `lang3` | `lang3` | 品詞（名・動Ⅰ 等） |
| `lang3_sub` | `lang3_sub` | アクセント番号メモ |
| `hint` | （JSONのみ） | 補足メモ。SQL生成では INSERT に含めない（列の有無が環境で異なるため）。 |
| `page_no` | `page_no` | 課番号と同じ `20`（一覧のページ範囲に利用） |
| `item_no` | `item_no` | セット内の通し番号（1〜） |
| `difficulty` | `difficulty` | 1（既定） |

## Supabase に取り込む手順

1. **既存の書籍・セットを確認**  
   `flashcard_books` に「みんなの日本語 初級Ⅰ」等があるか、なければ `flashcard_sets` に紐づく **新しいセット** を用意するか、既存の `set_id` を決める。

2. **SQL を生成**（`set_id` を置き換え）  
   リポジトリ直下で:

   ```bash
   node scripts/generate-flashcard-sql.mjs data/flashcards/minna-shokyu1-lesson20.json 123
   ```

   `123` は実際の `flashcard_sets.id` に置き換える。

3. **Supabase SQL Editor** で出力された `INSERT` を実行する（本番前はプレビュー環境で確認）。

4. **単語暗記・小テスト**  
   - `/flash` で書籍選択 → ページ番号（`page_no: 20`）または `item_no` 範囲で学習。  
   - `/student/test` の「単語」タブで同じ書籍の `item_no` 範囲を指定。

## 注意

- 既存の `set_id` に同じ `item_no` が重複している場合は、先に番号をずらすか、別セットに入れる。
- `id` は DB の SERIAL を任せるため、INSERT では指定しない。
