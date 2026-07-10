-- 원격 Supabase 적용 상태 검증 스크립트 (이슈 #2, #7)
-- 사용법: Supabase Dashboard > SQL Editor에 전체 붙여넣고 Run.
-- 모든 행의 result가 PASS면 0001(usage_logs) + 0002(profiles) + 0003(analyses)이 정상 적용된 상태다.
-- FAIL이 있으면 supabase/migrations/0001 → 0002 → 0003 순서로 붙여넣어 실행하면 된다(모두 멱등).

with checks as (
  select 1 as ord, 'usage_logs 테이블 존재' as item,
    exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'usage_logs') as ok
  union all
  select 2, 'usage_logs RLS 활성화',
    coalesce((select relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'usage_logs'), false)
  union all
  select 3, 'usage_logs insert 정책 (Anyone can insert)',
    exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = 'usage_logs' and policyname = 'Anyone can insert')
  union all
  select 4, 'usage_logs select 정책 (Users can view own logs)',
    exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = 'usage_logs' and policyname = 'Users can view own logs')
  union all
  select 5, 'get_daily_usage_by_device() 함수 존재',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'get_daily_usage_by_device')
  union all
  select 6, 'get_daily_usage_by_user() 함수 존재',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'get_daily_usage_by_user')
  union all
  select 7, 'profiles 테이블 존재 (0002)',
    exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'profiles')
  union all
  select 8, 'profiles RLS 활성화 (0002)',
    coalesce((select relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'profiles'), false)
  union all
  select 9, 'handle_new_user() 트리거 함수 존재 (0002)',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'handle_new_user')
  union all
  select 10, 'on_auth_user_created 트리거 존재 (0002)',
    exists (select 1 from pg_trigger where tgname = 'on_auth_user_created')
  union all
  select 11, '기존 auth 사용자 전원 profiles 백필됨 (0002)',
    not exists (select 1 from auth.users u
      left join public.profiles p on p.id = u.id where p.id is null)
  union all
  select 12, 'analyses 테이블 존재 (0003)',
    exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'analyses')
  union all
  select 13, 'analyses RLS 활성화 (0003)',
    coalesce((select relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'analyses'), false)
  union all
  select 14, 'analyses select/insert 정책 존재 (0003)',
    (select count(*) = 2 from pg_policies where schemaname = 'public'
      and tablename = 'analyses'
      and policyname in ('Users can view own analyses', 'Users can insert own analyses'))
)
select ord, item, case when ok then 'PASS ✅' else 'FAIL ❌' end as result
from checks order by ord;
