# 未来塾アプリ DB設計書

最終更新：2026-04-02

## テーブル一覧

| テーブル名 | 用途 | 件数 |
|---|---|---|
| users | 生徒情報・EXP管理 | 複数 |
| plans | 学習計画タスク | 複数 |
| news | お知らせ | 複数 |
| events | カレンダーイベント | 複数 |
| help_requests | 質問箱 | 複数 |
| flashcard_books | 教材本マスタ | 3件 |
| flashcard_sets | 単語セット | 3件 |
| flashcards_v3 | 単語カード | 300件 |
| review_logs | SRS学習履歴 | 複数 |
| quiz_results | クイズ結果 | 複数 |
| ta_scores | タイムアタック結果 | 複数 |
| materials | 教材マスタ（plans連携） | 複数 |
| master_events | 全員共通イベント | 複数 |
| parents | 保護者情報 | 複数 |
| content | コンテンツ管理 | 複数 |

---

## 主要テーブル詳細

### users
| カラム | 型 | 説明 |
|---|---|---|
| id | INT PK | 自動採番 |
| username | TEXT | ログインID（メールの@前） |
| nickname | TEXT | 表示名 |
| current_points | INT | EXPポイント |
| exp | INT | 累計EXP |
| streak | INT | 連続学習日数 |
| lang | TEXT | 言語設定（ja/zh） |
| grade_num | INT | 学年 |
| last_login_date | TEXT | 最終ログイン日 |

### plans
| カラム | 型 | 説明 |
|---|---|---|
| id | INT PK | 自動採番 |
| username | TEXT | ユーザー名 |
| big_plan | TEXT | 大計画（ゴール） |
| mid_plan | TEXT | 中計画（月テーマ） |
| task_name | TEXT | タスク名 |
| task_date | TEXT | 実施日（YYYY-MM-DD） |
| is_done | INT | 完了フラグ（0/1） |
| task_type | TEXT | タスク種別 |
| planned_minutes | INT | 予定時間（分） |
| actual_minutes | INT | 実績時間（分） |
| material_id | TEXT | 教材ID |
| page_range | TEXT | ページ範囲 |
| deadline | TEXT | 締め切り |

### flashcard_books（教材本マスタ）
| カラム | 型 | 説明 |
|---|---|---|
| id | INT PK | 自動採番 |
| title | TEXT | 教材名 |
| subtitle | TEXT | サブタイトル |
| publisher | TEXT | 出版社 |
| category | TEXT | english/japanese/chinese等 |
| grade | TEXT | 学年・レベル |
| cover_emoji | TEXT | 表紙絵文字 |
| description | TEXT | 説明 |

**現在登録済み教材：**
- id=1：でる順パス単 英検4級 5訂版
- id=2：みんなの日本語 初級1
- id=3：でる順パス単 英検3級

### flashcard_sets（単語セット）
| カラム | 型 | 説明 |
|---|---|---|
| id | INT PK | 自動採番 |
| book_id | INT FK | flashcard_books.id |
| set_name | TEXT | セット名 |
| category | TEXT | english/japanese/chinese/science等 |
| card_type | TEXT | word/phrase/definition/qa/sentence |
| subject_type | TEXT | word/phrase/conversation |
| subject | TEXT | english/japanese/chinese等 |
| lang1_label | TEXT | 表面ラベル |
| lang2_label | TEXT | 裏面ラベル |
| lang3_label | TEXT | 補足ラベル |
| lang1_tts_lang | TEXT | 表面読み上げ言語 |
| lang2_tts_lang | TEXT | 裏面読み上げ言語 |
| question_lang | TEXT | lang1固定 |
| answer_lang | TEXT | lang2固定 |

**カテゴリ定義：**
- english：英語・英検
- japanese：日本語（外国人向け）
- chinese：中国語
- science：理科
- japanese_lang：国語・文法
- math：算数・数学
- social：社会・歴史地理
- other：その他

**card_type定義：**
- word：単語暗記
- phrase：熟語・フレーズ
- conversation：会話表現
- definition：用語説明
- qa：一問一答
- sentence：例文練習

### flashcards_v3（単語カード）
| カラム | 型 | 説明 |
|---|---|---|
| id | INT PK | 自動採番 |
| set_id | INT FK | flashcard_sets.id |
| item_no | INT | セット内順番 |
| page_no | INT | ページ番号 |
| page_range | TEXT | ページ範囲 |
| lang1 | TEXT | 表面（単語・問い） |
| lang1_sub | TEXT | 読み仮名・発音 |
| lang2 | TEXT | 裏面（意味・答え） |
| lang2_sub | TEXT | 中国語訳・補足説明 |
| lang3 | TEXT | 例文・解説 |
| lang3_sub | TEXT | 例文訳 |
| hint | TEXT | ヒント |
| image_url | TEXT | 画像URL（将来実装） |
| difficulty | INT | 難易度1〜5 |
| created_by | TEXT | 作成者 |

---

## テーブル関係図

flashcard_books
  └── flashcard_sets（book_id）
        └── flashcards_v3（set_id）
              ├── review_logs（flashcard_id）
              └── quiz_results（book_id）

users
  ├── plans（username）
  ├── events（username）
  ├── help_requests（username）
  ├── review_logs（username）
  ├── quiz_results（username）
  └── ta_scores（username）

---

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-04-02 | flashcardsテーブル削除（flashcards_v3に統合） |
| 2026-04-02 | flashcard_setsの空セット削除（id=4〜15） |
| 2026-04-02 | category/card_type/subject統一 |
| 2026-04-02 | flashcards_v3の不要カラム削除（tts_lang1/2/3、tags） |
| 2026-04-02 | 英語カード235件に中国語訳追加 |
| 2026-04-02 | 日本語カード11件に日本語補足説明追加 |
