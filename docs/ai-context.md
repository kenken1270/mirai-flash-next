# 未来塾アプリ 開発コンテキスト

最終更新：2026-04-04

## プロジェクト概要
- アプリ名：未来塾（Mirai Juku）
- 目的：外国籍の子ども向け学習管理アプリ
- 対象：日本語・中国語を学ぶ小学生
- 運営：個人事業主（妻が教室経営・ありむらさんがアプリ運営）

## 技術スタック
- フロントエンド：Next.js 15 / TypeScript / Tailwind CSS
- バックエンド：Supabase（PostgreSQL）
- デプロイ：Vercel
- リポジトリ：https://github.com/kenken1270/mirai-flash-next

## ブランドデザイン
- メインカラー：クリーム背景 #FFFDF0
- ブランドイエロー：#FCD34D（ヘッダーのみ・面積20%以下）
- アクセント：Honey Gold #F59E0B（ボーダー・バッジ）
- テキスト：ダークブラウン #1C1410
- サブテキスト：ウォームブラウン #78350F
- 成功：ソフトグリーン #10B981
- マスコット：柴犬🐕
- コンセプト：ゲーミフィケーション（EXP・レベル・ストリーク）

## DB構造（2026/04/04時点・確定済み）

### users
| カラム | 型 | 説明 |
|---|---|---|
| username | text | ログインID |
| nickname | text | 表示名 |
| current_points | int | 現在ポイント |
| streak | int | 連続学習日数 |
| exp | int | 累計EXP |

### plans
| カラム | 型 | 説明 |
|---|---|---|
| username | text | ユーザーID |
| big_plan | text | 大目標 |
| mid_plan | text | 中目標 |
| task_name | text | タスク名 |
| task_date | date | 実施日 |
| is_done | int | 完了フラグ（1=完了） |

### flashcard_books（4件登録済み）
| id | title | lang1_label | lang2_label |
|---|---|---|---|
| 1 | 英検3級 でる順パス単 | 英語 | 日本語 |
| 2 | みんなの日本語 初級1 | 日本語 | 日本語 |
| 3 | でる順パス単 英検4級 | 英語 | 日本語 |
| 4 | 新 HSK1〜4級 単語トレーニングブック | 中国語 | 日本語 |

### flashcard_sets（7件登録済み）
| set_id | book_id | set_name | 単語数 |
|---|---|---|---|
| 1 | 3 | でる順パス単 英検4級 5訂版 | 135 |
| 2 | 2 | みんなの日本語 初級1 | 65 |
| 3 | 1 | 英検3級 でる順パス単 | 100 |
| 16 | 4 | UNIT 1: 人に関する言葉 | 546 |
| 17 | 4 | UNIT 2: さまざまな物と事象の表現 | 302 |
| 18 | 4 | UNIT 3: 周辺環境・社会に関する言葉 | 313 |
| 19 | 4 | UNIT 4: 全分野に関わる表現 | 97 |

### flashcards_v3（1,558件・全件中国語訳済み）
| カラム | 説明 |
|---|---|
| id | PK |
| set_id | flashcard_sets.id |
| item_no | 教材内通し番号 |
| lang1 | 単語本体（英語 or 中国語 or 日本語） |
| lang1_sub | ピンイン / 発音記号 |
| lang2 | 日本語訳 |
| lang2_sub | 中国語補足訳 |
| lang3 | 例文 |
| difficulty | 難易度 1〜4 |
| created_by | 登録者 |

### difficulty基準
| 値 | 相当 | 色 |
|---|---|---|
| 1 | HSK1（最頻出） | bg-green-50 |
| 2 | HSK2（初級） | bg-yellow-50 |
| 3 | HSK3（中級） | bg-orange-50 |
| 4 | HSK4（上級） | bg-red-50 |

### その他テーブル
- review_logs：SRS学習履歴
- events：カレンダーイベント
- help_requests：質問箱

## ページ構成
| ルート | 説明 | 状態 |
|---|---|---|
| /student | ホーム（HUD・柴犬・EXP表示） | ✅ 完成 |
| /student/today | 今日のタスク | ✅ 完成 |
| /student/plan | 学習プラン（大/中/小・リスト/週間/月間タブ） | 🔄 更新中 |
| /student/tango | 単語アプリ（/flashへリダイレクト） | ✅ 完成 |
| /student/calendar | カレンダー | ✅ 完成 |
| /student/test | テスト | ✅ 完成 |
| /student/help | 質問箱 | ✅ 完成 |
| /flash | フラッシュカードアプリ本体（教材選択・範囲選択） | ✅ 完成 |
| /flash/list | 単語一覧（赤シートモード付き） | ✅ 完成 |
| /flash/study | 学習モード | ✅ 完成 |
| /flash/attack | アタックモード | ✅ 完成 |

## /flash/list 仕様（実装済み）
- flashcard_books.lang1_label / lang2_label を参照してテーブルヘッダーを動的切替
- 中国語教材（HSK）のみ「中国語訳」列（lang2_sub）を追加表示
- 例文（lang3）列を常時表示
- 難易度別行カラー（difficulty 1〜4 → 緑/黄/橙/赤）
- 赤シートモード：赤ブロックでセルを隠し、タップで1セルずつめくれる
- チェックボックスで隠す列を複数選択可（lang1・lang1_sub・lang2・lang2_sub・lang3）
- 「全て表示」「全て隠す」ボタンで一括操作

## ユニットをまたいだテスト設計方針（確定）
新テーブル不要。book_id 単位で flashcard_sets 経由の全件取得（アプローチC）を採用。

```sql
SELECT v.* 
FROM flashcards_v3 v
JOIN flashcard_sets s ON s.id = v.set_id
WHERE s.book_id = 4
ORDER BY RANDOM() 
LIMIT 20;
