# 未来塾アプリ 開発コンテキスト

## プロジェクト概要
- アプリ名：未来塾（Mirai Juku）
- 目的：外国籍の子ども向け学習管理アプリ
- 対象：日本語・中国語を学ぶ小学生
- 運営：個人事業主（妻が教室経営・私がアプリ運営）

## 技術スタック
- フロントエンド：Next.js 15 / TypeScript / Tailwind CSS
- バックエンド：Supabase（PostgreSQL）
- デプロイ：Vercel
- リポジトリ：https://github.com/kenken1270/mirai-flash-next

## ブランドデザイン
- メインカラー：クリーム背景 #FFFDF0
- ブランドイエロー：#FCD34D（ヘッダーのみ）
- テキスト：ダークブラウン #1C1410
- マスコット：柴犬（妻のお気に入り）
- コンセプト：ゲーミフィケーション（EXP・レベル・ストリーク）

## DB構造（主要テーブル）
- users：username, nickname, current_points, streak, exp
- plans：username, big_plan, mid_plan, task_name, task_date, is_done
- flashcard_books：教材本マスタ（3件）
- flashcard_sets：セット（3件：英検4級・英検3級・みんなの日本語）
- flashcards_v3：単語カード（300件・中国語訳済み）
- review_logs：SRS学習履歴
- events：カレンダーイベント
- help_requests：質問箱

## ページ構成（/student/配下）
- /student：ホーム（HUD・柴犬・EXP表示）
- /student/today：今日のタスク
- /student/plan：学習プラン（大/中/小・リスト/週間/月間タブ）
- /student/tango：単語アプリ（/flashへリダイレクト）
- /student/calendar：カレンダー
- /student/test：テスト
- /student/help：質問箱
- /flash：フラッシュカードアプリ本体

## 現在の課題・作業中
[ここに今日の作業内容を毎回追記]
