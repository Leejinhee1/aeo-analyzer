-- analyses: 로그인 사용자의 분석 결과 영속화 (대시보드 히스토리용, 이슈 #7)
-- 분석 성공 시 /api/analyze가 저장하고, 대시보드가 본인 것만 최신순으로 조회한다.

create table if not exists public.analyses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users on delete cascade,
  url text not null,
  score int not null,
  results jsonb not null,
  created_at timestamptz not null default now()
);

-- 히스토리 조회(본인 것 최신순) 성능용 인덱스
create index if not exists idx_analyses_user_date on public.analyses (user_id, created_at desc);

-- RLS: 본인 행만 조회/생성. 수정·삭제는 현재 범위 밖(정책 없음 = 불가).
alter table public.analyses enable row level security;

drop policy if exists "Users can view own analyses" on public.analyses;
create policy "Users can view own analyses"
  on public.analyses for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own analyses" on public.analyses;
create policy "Users can insert own analyses"
  on public.analyses for insert
  with check (auth.uid() = user_id);
