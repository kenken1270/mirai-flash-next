# 未来塾アプリ — AI向けコンテキスト（要更新）

このファイルは DB・多言語・画面の**単一の真実**としてメンテナンスする。スキーマや方針が変わったら必ず追記・修正すること。

## プロジェクト

- **名前:** 未来塾（Mirai-Flash）系アプリ
- **スタック（想定）:** Next.js App Router, Supabase, TypeScript

## テーブル・フィールド（概要）

### flashcards_v3

- 単語カード。`set_id` でセットに紐づく。
- 言語列の意味（運用上の呼び方）:
  - `lang1` — 母国語/中国語など表面側
  - `lang2` — ひらがな等
  - `lang2_sub` — 読み・サブ
  - `lang3` — 品詞など
- その他: `item_no`, `tts_lang1` / `tts_lang2` / `tts_lang3`, `hint`, `page_range`, `difficulty` 等（実DBに合わせて型定義を更新すること）。

### flashcard_sets

- セット名・カテゴリ・科目・TTS言語・ラベル（`lang1_label` 等）を保持。

### learning_resources

- 教材キーでの紐付け、解説テキスト、動画URL、画像。
- **解説の多言語:** `[:ja]...[:zh]...` のような区切り形式を**壊さない**（パース前提のUIがある場合がある）。

### review_logs / users / plans

- 復習ログ、ユーザーXP・日次上限、タスク計画。列名は Supabase の実スキーマに合わせて `src/lib` の型と同期すること。

## SRL・ロードマップ・児童フィードバック運用

- 詳細は [srl-roadmap-and-feedback.md](./srl-roadmap-and-feedback.md)（現状分析、大掛かり改築候補、フェーズ別ロードマップ、フィードバックサイクル）。

## AIへの注意

- マイグレーションや列追加を提案するときは、このファイルと `src/lib` の型の両方を更新する案にすること。
- 紙面・教材ID・キー規則が決まっている場合は、下に「確定仕様」として追記する。

## 確定仕様

### ユーザー名（Auth → DB）

- Supabase Auth の `user.email` から **`@` より前のローカル部** を `users.username` / `plans.username` / `review_logs.username` 等のキーとして使う。
- 実装は **`src/lib/auth-user.ts`** の `usernameFromEmail` / `getUsernameFromSession` に集約。画面ごとに `split` / `replace` しない。

### 学習タスクの画面（統一）

- **メイン:** `/student/study?taskId=…` — `learning_resources` による解説・動画・多言語ヒント＋タイマー。開始時 `users.current_status: doing`、完了後 `waiting_check` → `/student/check`。
- **旧URL:** `/student/do/[taskId]` → 上記 study へリダイレクト（ブックマーク互換）。

### 学生ホームの EXP バー（暫定）

- `users.current_points` をもとに、**100 EXP ごとの区間内進捗**（`current_points % 100`）をプログレスバーに表示。Lv計算式が固まったら `docs` と定数を更新する。

### 今後追記

- 教材キー、セットID規則、環境変数名など