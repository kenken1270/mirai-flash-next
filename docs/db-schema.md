プロジェクト概要:

アプリ名は「未来塾（Mirai Juku）」で、外国籍の子ども向け学習管理アプリです。日本語・中国語を学ぶ小学生を対象とし、妻が教室経営・ありむらさんがアプリ運営を担います。

技術スタック:

フロントエンド：Next.js 15 / TypeScript / Tailwind CSS
バックエンド：Supabase（PostgreSQL）
デプロイ：Vercel
リポジトリ：https://github.com/kenken1270/mirai-flash-next
ブランドデザイン:

メインカラー：クリーム背景 #FFFDF0
ブランドイエロー：#FCD34D（ヘッダーのみ）
テキスト：ダークブラウン #1C1410
マスコット：柴犬
コンセプト：ゲーミフィケーション（EXP・レベル・ストリーク）
DB構造（2026/04/04時点・確定済み）:

users テーブルは username, nickname, current_points, streak, exp を持ちます。plans テーブルは username, big_plan, mid_plan, task_name, task_date, is_done を持ちます。

flashcard_books は教材本マスタで、2026/04/04時点で4件が登録済みです。

id	title	lang1_label	lang2_label
1	英検3級 でる順パス単	英語	日本語
2	みんなの日本語 初級1	日本語	日本語
3	でる順パス単 英検4級	英語	日本語
4	新 HSK1〜4級 単語トレーニングブック	中国語	日本語
flashcard_sets は各教材のユニット／セットを管理します。2026/04/04時点で7件が登録済みです。

set_id	book_id	set_name	単語数
1	3	でる順パス単 英検4級 5訂版	135
2	2	みんなの日本語 初級1	65
3	1	英検3級 でる順パス単	100
16	4	UNIT 1: 人に関する言葉	546
17	4	UNIT 2: さまざまな物と事象の表現	302
18	4	UNIT 3: 周辺環境・社会に関する言葉	313
19	4	UNIT 4: 全分野に関わる表現	97
flashcards_v3 は単語カード本体で、2026/04/04時点で1,558件・全件中国語訳済みです。フィールド構成は id, set_id, item_no, lang1（単語本体）, lang1_sub（ピンイン/発音記号）, lang2（日本語訳）, lang2_sub（中国語補足訳）, lang3（例文）, difficulty（1〜4）, created_by です。

review_logs はSRS学習履歴、events はカレンダーイベント、help_requests は質問箱です。

ページ構成（2026/04/04時点）:

/student：ホーム（HUD・柴犬・EXP表示）
/student/today：今日のタスク
/student/plan：学習プラン（大/中/小・リスト/週間/月間タブ）
/student/tango：単語アプリ（/flashへリダイレクト）
/student/calendar：カレンダー
/student/test：テスト
/student/help：質問箱
/flash：フラッシュカードアプリ本体（教材選択・範囲選択）
/flash/list：単語一覧ページ（赤シートモード付き）
/flash/study：学習モード
/flash/attack：アタックモード
/flash/list ページ仕様（2026/04/04 実装済み）:

単語一覧ページの主要機能は以下の通りです。教材ごとに flashcard_books.lang1_label / lang2_label を参照してテーブルヘッダーを動的切替します（英語教材では「英語」列、中国語教材では「中国語」列と表示）。中国語教材（HSK）のみ「中国語訳」列（lang2_sub）を追加表示します。例文（lang3）列も常時表示します。

難易度別の行カラーは以下の通りです。difficulty=1 は bg-green-50（HSK1相当・易しい）、difficulty=2 は bg-yellow-50（HSK2相当・初級）、difficulty=3 は bg-orange-50（HSK3相当・中級）、difficulty=4 は bg-red-50（HSK4相当・上級）です。

赤シートモードの仕様は以下の通りです。赤いブロック（bg-red-500塗りつぶし）でセルを隠します。チェックボックスで隠す列を複数選択できます（lang1・lang1_sub・lang2・lang2_sub・lang3）。セルを個別タップすることで1つずつめくれます。「全て表示」「全て隠す」ボタンで一括操作できます。チェックボックスのラベルは教材の言語に応じて動的変化します（例：英語教材では「英語」、中国語教材では「中国語」）。

難易度基準（flashcards_v3.difficulty）:

difficulty=1 はHSK1相当（最頻出・基礎）、difficulty=2 はHSK2相当（初級）、difficulty=3 はHSK3相当（中級）、difficulty=4 はHSK4相当（上級）です。英検教材では difficulty=1〜3 を目安に設定しています。

現在の課題・作業中（2026/04/04）:

完了済みの内容は以下の通りです。DB重複排除（set_id=16,19の重複削除）、全1,558件の単語登録（英検4級135件、みんなの日本語65件、英検3級100件、新HSK UNIT1〜4 計1,258件）、全件中国語訳完了、flashcard_books に lang1_label / lang2_label 列追加、/flash/list ページの赤シートモード実装、教材ごとの動的ヘッダー切替実装です。

進行中の内容は /flash/list の最新コードのビルド・デプロイ確認（現在更新中）です。

次のタスク候補は以下の通りです。🔴 高優先：ユニットをまたいだ複数セット選択テスト機能（book_id 単位での全件テスト）、🔴 高優先：/student/plan のリスト/週間/月間タブ完成確認、🟡 中優先：/flash/study での学習進捗記録（review_logs への書き込み）、🟢 低優先：画像（image_url）機能追加です。

ユニットをまたいだテストの設計方針（確定）:

新しいテーブルは作らず、flashcard_books.id（book_id）を使って flashcard_sets 経由で全セットのカードを一括取得するアプローチC（Book-wide query）を採用します。

Copy-- book_id=4（新HSK）の全単語をランダム20件取得
SELECT v.* 
FROM flashcards_v3 v
JOIN flashcard_sets s ON s.id = v.set_id
WHERE s.book_id = 4
ORDER BY RANDOM() 
LIMIT 20;
UIでは /flash ページの教材選択後に「全セットまとめて学習」ボタンを設置し、bookId パラメータで /flash/list や /flash/study に遷移する設計です。
