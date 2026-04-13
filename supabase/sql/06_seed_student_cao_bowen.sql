-- =============================================================================
-- 生徒アカウント: 曹博文（塾番号 1010801260003）
-- =============================================================================
-- プロフィール参照:
--   番号: 1010801260003 / 名前: 曹博文 / フリガナ: CAO BOWEN
--   生年月日: 2010-05-25 / 性別: 男 / 区分: 通塾生 / 学年: 高校1年生
--
-- ログイン username（ASCII）: 1010801260003
--   Auth メール: 1010801260003@mirai-juku.internal
--   一覧表示名: nickname = 曹博文
--
-- 【必須の2ステップ】
-- 1) この SQL を Supabase → SQL Editor で実行
-- 2) Authentication → Users → Add user
--      Email:    1010801260003@mirai-juku.internal
--      Password: Mirai2026（または運用ルールに合わせて設定）
--      Auto Confirm User: ON
-- =============================================================================

INSERT INTO public.users (
  username,
  nickname,
  current_points,
  streak,
  last_visit_date,
  last_login_date,
  grade_num
)
SELECT
  '1010801260003',
  '曹博文',
  0,
  0,
  to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::date, 'YYYY-MM-DD'),
  to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::date, 'YYYY-MM-DD'),
  10
WHERE NOT EXISTS (
  SELECT 1 FROM public.users WHERE username = '1010801260003'
);

-- 高校1年を grade_num=10 とする想定（運用で違う場合は変更）
UPDATE public.users SET grade_num = 10 WHERE username = '1010801260003';

-- 保護者用 PIN（4桁）。列 pin がある場合のみ有効。エラーならこの UPDATE をスキップ。
UPDATE public.users SET pin = '0525' WHERE username = '1010801260003';

-- 教室ステータス等。列 current_status がある場合のみ有効。エラーならスキップ。
UPDATE public.users SET current_status = '通塾・高校1年' WHERE username = '1010801260003';
