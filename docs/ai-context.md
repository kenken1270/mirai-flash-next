# 未来塾アプリ 開発コンテキスト

最終更新：2026-04-02

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
- ブランドイエロー：#FCD34D（ヘッダーのみ・面積20%以下）
- アクセント：Honey Gold #F59E0B（ボーダー・バッジ）
- テキスト：ダークブラウン #1C1410
- サブテキスト：ウォームブラウン #78350F
- 成功：ソフトグリーン #10B981
- マスコット：柴犬🐕（妻のお気に入り）
- コンセプト：ゲーミフィケーション（EXP・レベル・ストリーク）

## ページ構成（/student/配下）
| ルート | 説明 | 状態 |
|---|---|---|
| /student | ホーム（HUD・柴犬・EXP表示） | ✅ 完成 |
| /student/today | 今日のタスク | ✅ 完成 |
| /student/plan | 学習プラン（大/中/小・リスト/週間/月間タブ） | 🔄 更新中 |
| /student/tango | 単語アプリ（/flashへリダイレクト） | ✅ 完成 |
| /student/calendar | カレンダー | ✅ 完成 |
| /student/test | テスト | ✅ 完成 |
| /student/help | 質問箱 | ✅ 完成 |
| /flash | フラッシュカードアプリ本体 | ✅ 完成 |

## 現在の作業状況
- planページにリスト/週間/月間タブを追加中（rewrite_plan_v2.mjs実行済み・Vercelビルド確認待ち）
- ヘッダー2重表示の修正が必要（layout.tsxとpage.tsxの両方にheaderがある）

## AIへの指示ルール
作業完了時は必ず以下を出力すること：
1. 変更サマリー（何を変更したか1〜3行）
2. db-schema.md の更新箇所
3. ai-context.md の更新箇所

出力形式：
---DOCS UPDATE---
[変更後のMarkdown該当箇所のみ]
---END---
