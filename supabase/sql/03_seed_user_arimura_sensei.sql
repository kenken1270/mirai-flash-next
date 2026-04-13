-- =============================================================================
-- 有村先生アカウント（ログイン用ユーザー）
-- =============================================================================
-- 手順:
--   1) このファイルの「A. public.users」を Supabase SQL Editor で実行
--   2) 「B. Supabase Auth」のどちらかで、同じメールの Auth ユーザーを作成（パスワード 1270）
--
-- メールアドレスはログイン画面の仕様どおり
--   有村先生@mirai-juku.internal
-- （@ より前が users.username / アプリ内のユーザーID になります）
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. アプリのユーザー一覧（public.users）
--    既に行がある場合は何もしない
-- -----------------------------------------------------------------------------
INSERT INTO public.users (
  username,
  nickname,
  current_points,
  streak,
  last_visit_date,
  last_login_date
)
SELECT
  '有村先生',
  '有村先生',
  0,
  0,
  to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::date, 'YYYY-MM-DD'),
  to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::date, 'YYYY-MM-DD')
WHERE NOT EXISTS (
  SELECT 1 FROM public.users WHERE username = '有村先生'
);

-- 上記でエラーになる場合は、テーブルに必須列（lang, grade_num, pin など）があるので
-- ダッシュボードの Table Editor で既存生徒の1行を参考に列を足してから再実行してください。

-- -----------------------------------------------------------------------------
-- B. Supabase Auth（パスワード 1270）
-- -----------------------------------------------------------------------------
-- 【推奨】ダッシュボード:
--   Authentication → Users → Add user → Create new user
--     Email:    有村先生@mirai-juku.internal
--     Password: 1270
--     「Auto Confirm User」にチェック
--
-- ※ メールに日本語が使えない場合は、次のいずれかにしてください:
--   - 英数字メール（例: arimura_sensei@mirai-juku.internal）で Auth ユーザーを作り、
--     上の INSERT の username も同じ @ より前に合わせる
--   - または Supabase のメール許可設定を確認する
-- -----------------------------------------------------------------------------
