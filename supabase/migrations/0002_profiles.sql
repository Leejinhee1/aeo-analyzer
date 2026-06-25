-- profiles: 사용자별 구독 플랜. 플랜 판정의 단일 권위(서버)다.
-- /api/analyze는 클라이언트가 보낸 isPro를 신뢰하지 않고 이 테이블의 plan으로 Pro 여부를 판정한다.
-- Polar 구독 식별자는 webhook(#9)에서 사용자와 매핑·갱신하는 데 쓴다.

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  polar_customer_id text,
  polar_subscription_id text,
  created_at timestamptz not null default now()
);

-- RLS: 본인 행만 조회/수정 가능. plan 변경은 서버(service role)/webhook이 수행.
alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 신규 가입 시 profiles 행을 기본 'free'로 자동 생성한다.
-- 이로써 로그인 사용자의 플랜 조회가 항상 성립한다.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 기존 사용자 백필: profiles 행이 없는 auth.users에 대해 기본 'free' 생성.
insert into public.profiles (id)
select u.id from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
