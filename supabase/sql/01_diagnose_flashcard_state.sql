-- =============================================================================
-- ① フラッシュカード関連の DB 状態を調べる（Supabase SQL Editor にそのまま貼り付け）
-- =============================================================================
-- 実行後、02_insert_minna_lesson20_flashcards.sql の WITH 句にある set_id を
-- flashcard_sets.id のうち「みんなの日本語」用のセットに合わせて書き換えてください。
-- =============================================================================

-- 1) flashcards_v3 にどんな列があるか（INSERT 時に必須列に合わせるため）
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'flashcards_v3'
ORDER BY ordinal_position;

-- 2) 登録書籍一覧
SELECT id, title, subtitle, category
FROM flashcard_books
ORDER BY id;

-- 3) セット一覧（どの書籍に紐づくか）
SELECT
  s.id AS set_id,
  s.book_id,
  b.title AS book_title,
  s.lang1_label,
  s.lang2_label,
  s.lang1_tts_lang,
  s.lang2_tts_lang
FROM flashcard_sets s
LEFT JOIN flashcard_books b ON b.id = s.book_id
ORDER BY s.id;

-- 4) page_no = 20 のカードが既にどのセットに何件あるか（重複投入の確認）
SELECT
  set_id,
  COUNT(*) AS card_count,
  MIN(item_no) AS min_item_no,
  MAX(item_no) AS max_item_no
FROM flashcards_v3
WHERE page_no = 20
GROUP BY set_id
ORDER BY set_id;

-- 5) セットIDごとのカード総数（全 page）
SELECT
  set_id,
  COUNT(*) AS total_cards
FROM flashcards_v3
GROUP BY set_id
ORDER BY set_id;
