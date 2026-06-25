-- usage_logs: 비로그인/로그인 사용자 모두 "일 3회" 분석 제한용 사용량 추적
-- 비로그인 = device_id(localStorage UUID) 기준, 로그인 = user_id 기준

create table if not exists public.usage_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  device_id text,
  url_analyzed text not null,
  created_at timestamptz default now()
);

-- 조회 성능용 인덱스
create index if not exists idx_usage_device_date on public.usage_logs (device_id, created_at);
create index if not exists idx_usage_user_date on public.usage_logs (user_id, created_at);

-- RLS
alter table public.usage_logs enable row level security;

drop policy if exists "Anyone can insert" on public.usage_logs;
create policy "Anyone can insert"
  on public.usage_logs for insert with check (true);

drop policy if exists "Users can view own logs" on public.usage_logs;
create policy "Users can view own logs"
  on public.usage_logs for select
  using (auth.uid() = user_id);

-- 오늘 사용량 체크 함수 (디바이스 기반 - 비로그인용)
create or replace function public.get_daily_usage_by_device(p_device_id text)
returns int as $$
  select count(*)::int
  from public.usage_logs
  where device_id = p_device_id
    and created_at >= current_date;
$$ language sql security definer;

-- 오늘 사용량 체크 함수 (유저 기반 - 로그인용)
create or replace function public.get_daily_usage_by_user(p_user_id uuid)
returns int as $$
  select count(*)::int
  from public.usage_logs
  where user_id = p_user_id
    and created_at >= current_date;
$$ language sql security definer;
