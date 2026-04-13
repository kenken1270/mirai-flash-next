-- 教科書の総ページ数（計画の「量」目安用）。未設定のときは従来どおり登録ページの種類数で集計。
ALTER TABLE public.learning_resources
  ADD COLUMN IF NOT EXISTS material_total_pages integer;

COMMENT ON COLUMN public.learning_resources.material_total_pages IS
  '教材（material_name）単位の総ページ数。同一教材の行に共通で入る。NULLのときは page_no の種類数で集計。';
