# 未来塾アプリ 開発コンテキスト
最終更新：2026-04-04

## プロジェクト概要
- アプリ名：未来塾（Mirai Juku）
- 目的：外国籍子ども向け学習管理アプリ
- 対象：日本語・中国語学習小学生
- 運営：個人事業主（妻が教室経営、ありむらさんが運営）

## 技術スタック
- フロントエンド：Next.js 15 / TypeScript / Tailwind CSS
- バックエンド：Supabase（PostgreSQL）
- デプロイ：Vercel
- リポジトリ：https://github.com/kenken1270/mirai-flash-next
- ブランド：背景 #FFFDF0、ヘッダー #FCD34D、テキスト #1C1410、マスコット柴犬

## ブランチ運用
- main：本番（生徒が使用中）
- dev：開発・テスト用（Vercelプレビューで確認）
- 作業フロー：push-dev "メッセージ" → プレビュー確認 → push-prod で本番反映
- PowerShellプロファイル：push-dev / push-prod 関数登録済み

## DB構造（確定・2026-04-04）

### flashcard_books（4件）
| id | title | lang1_label | lang2_label |
|---|---|---|---|
| 1 | 英検3級 でる順パス単 | 英語 | 日本語 |
| 2 | みんなの日本語 初級1 | 日本語 | 日本語 |
| 3 | でる順パス単 英検4級 | 英語 | 日本語 |
| 4 | 新 HSK1〜4級 単語トレーニングブック | 中国語 | 日本語 |

### flashcard_sets（7件）
| set_id | book_id | set_name | 単語数 |
|---|---|---|---|
| 1 | 3 | でる順パス単 英検4級 5訂版 | 135 |
| 2 | 2 | みんなの日本語 初級1 | 65 |
| 3 | 1 | 英検3級 でる順パス単 | 100 |
| 16 | 4 | UNIT 1 | 546 |
| 17 | 4 | UNIT 2 | 302 |
| 18 | 4 | UNIT 3 | 313 |
| 19 | 4 | UNIT 4 | 97 |

### flashcards_v3（1,558件・全件中国語訳済み）
カラムの使い分け：
| カラム | 英検4級(set_id=1) | 英検3級(set_id=3) | HSK(set_id=16〜19) |
|---|---|---|---|
| lang1 | 英単語 | 英単語 | 中国語 |
| lang1_sub | 発音記号 | 発音記号 | ピンイン |
| lang2 | 日本語訳 | 日本語訳 | 日本語訳 |
| lang2_sub | カタカナ読み | カタカナ読み | 中国語（再掲） |
| lang3 | 空（例文未入力） | 例文 | 例文 |
| lang3_sub | 中国語訳 | 中国語訳 | null |
| hint | null | null | null |
| image_url | null | null | null |
| difficulty | 1〜4 | 1〜4 | 1〜4 |

その他カラム：id, set_id, item_no, page_range, page_no, created_by, created_at, updated_at

### review_logs
id, username, flashcard_id, quality, ease_factor, interval_days, repetitions, next_review_date, reviewed_at, created_at

### users（public.users ※RLSなし・auth.usersと別）
username, nickname, current_points, streak, exp, base_daily_limit, lang, grade_num, daily_new_limit, today_limit, today_limit_date など

### その他テーブル
plans（username, big_plan, mid_plan, task_name, task_date, is_done）, events, help_requests

## ページ構成
| パス | 説明 | 状態 |
|---|---|---|
| /student | ホーム（HUD、EXP、ストリーク） | 稼働中 |
| /student/today | 今日のタスク | 稼働中 |
| /student/plan | 学習計画（リスト/週間/月間タブ） | 要確認 |
| /student/tango | /flash へリダイレクト | 稼働中 |
| /student/calendar | カレンダー | 稼働中 |
| /student/test | テスト | 稼働中 |
| /student/help | ヘルプ | 稼働中 |
| /flash | 教材選択（bookId渡し） | 稼働中 |
| /flash/list | 単語一覧・赤シートモード | 稼働中 |
| /flash/study | 学習画面（SM-2忘却曲線） | 稼働中 |
| /flash/attack | アタックモード | 未完成 |

## /flash/list 仕様（確定）
- 教材のlang1_labelでテーブルヘッダーを動的切替
- 中国語教材のみlang2_sub列を表示
- 例文（lang3）列あり
- 難易度別行カラー：1=green-50、2=yellow-50、3=orange-50、4=red-50
- 赤シートモード：列選択チェックボックス・セル個別タップで公開・全表示/全非表示ボタン

## /flash/study 仕様（確定）
- bookId指定 → 全セット横断でカード取得
- setId指定 → 単一セット取得
- start/end指定 → item_no範囲フィルタ
- 範囲指定あり or bookId あり → 制限なしランダム全件出題（何度でも可）
- 通常学習 → 新規カード + 復習期限カード（base_daily_limit上限）、0件なら全件フォールバック
- SM-2忘却曲線アルゴリズムで復習間隔を自動計算
- 答え面の表示ロジック：
  - lang2：日本語訳（常時表示）
  - lang2_sub：中国語教材 → 中国語 / 英語教材 → よみかた（カタカナ）
  - lang3_sub：英語教材のみ → 中国語訳（英検3級・4級共通）
  - lang3：例文（空でなければ表示）
- 結果画面：スコア・内訳バッジ・できなかった単語リスト・できた単語リスト・柴犬応援・EXP表示
- 下部固定ボタン：一覧に戻る / もう一度 / ホーム

## AI開発ルール
- コード修正はPowerShellスクリプトで提供（UTF-8書き込み）
- 置換は $content.Replace() を使用、失敗時は Get-Content で現在コードを確認
- ビルド確認：npm run build 2>&1 | Select-Object -Last 10
- 文字化けに注意：絵文字・日本語はUTF-8で [System.IO.File]::WriteAllText() を使用
- PowerShell の $lines[412..] は使用不可 → $lines[412..($lines.Length-1)] を使用

## 完了済みタスク（〜2026-04-04）
- set_id 16,19の重複削除
- 全1,558件のカード登録完了
- 全件中国語訳済み
- flashcard_booksにlang1_label/lang2_label追加
- 赤シートモード実装（セル個別タップ）
- 教材別ヘッダー動的切替実装
- /flash/studyのbookId対応・カード0件バグ修正
- 存在しないカラム（tts_lang1等）削除
- 結果画面リデザイン（未来塾カラー統一）
- 英検4級DBデータ整理（lang2_sub=カタカナ、lang3_sub=中国語に統一）
- 英検3級に中国語訳100件投入（lang3_sub）
- dev/mainブランチ運用フロー確立・PowerShellプロファイル設定完了

## 次タスク（優先順・2026-04-04時点）
- 🔴 /flash/listの赤シートにlang3_sub（中国語）表示対応
- 🔴 /student/planのリスト/週間/月間タブ完成確認
- 🟡 /flash/studyのreview_logs書き込み精度確認
- 🟡 英検4級の例文データ投入（lang3が空）
- 🟢 みんなの日本語（set_id=2）データ整備
- 🟢 image_url画像機能追加
- 🟢 /flash/attack アタックモード実装