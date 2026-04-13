-- =============================================================================
-- 有村先生アカウント（ログイン用ユーザー）
-- =============================================================================
-- Supabase Auth のメールは「@より前が英数字のみ」に制限されるため、
--   メール: arimura_sensei@mirai-juku.internal
--   表示名: public.users.nickname = 有村先生
-- アプリのログイン一覧は nickname を表示します（login/page.tsx）。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A0. 以前「username = 有村先生」だけ入れていた場合の移行（任意）
-- -----------------------------------------------------------------------------
UPDATE public.users
SET
  username = 'arimura_sensei',
  nickname = COALESCE(NULLIF(trim(nickname), ''), '有村先生'),
  grade_num = 1
WHERE username = '有村先生';

-- -----------------------------------------------------------------------------
-- A. アプリのユーザー一覧（public.users）
-- grade_num は管理画面などで使う場合あり。ホームの「レベル」表示は EXP から算出（student/page.tsx）
-- -----------------------------------------------------------------------------
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
  'arimura_sensei',
  '有村先生',
  0,
  0,
  to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::date, 'YYYY-MM-DD'),
  to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::date, 'YYYY-MM-DD'),
  1
WHERE NOT EXISTS (
  SELECT 1 FROM public.users WHERE username = 'arimura_sensei'
);

-- 既に INSERT 済みで grade_num だけずれている場合
UPDATE public.users SET grade_num = 1 WHERE username = 'arimura_sensei';

-- 上記でエラーになる場合は、必須列を既存生徒の1行を参考に足してから再実行。

-- -----------------------------------------------------------------------------
-- B. Supabase Auth（パスワード 1270）— ダッシュボードから作成
-- -----------------------------------------------------------------------------
-- Authentication → Users → Add user → Create new user
--   Email:    arimura_sensei@mirai-juku.internal
--   Password: 1270
--   Auto Confirm User: ON
--
-- ※ 有村先生@mirai-juku.internal は Supabase 側で拒否されます（非ASCII不可）。
-- -----------------------------------------------------------------------------
