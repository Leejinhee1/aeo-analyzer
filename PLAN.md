# AEO Analyzer - 프로젝트 플랜

## 서비스 개요
URL을 입력하면 AEO(Answer Engine Optimization) 최적화 상태를 분석하고 개선점을 알려주는 SaaS 서비스

## 프로젝트 문서 관리
- **Obsidian 볼트**: `/Users/eeejeenee/Projects/Vault`
- **프로젝트 문서 위치**: `Projects/AEO-Analyzer.md`
- **템플릿**: `project` 템플릿 사용
- 각 파트 완료 시 Obsidian에 진행상황 업데이트

## 기술 스택
- **Frontend/Backend**: Next.js 16 (App Router) — 현재 16.1.7
- **Database/Auth**: Supabase + Supabase MCP
- **Styling**: Tailwind CSS + shadcn/ui
- **AI 분석**: Claude API (개선점 제안용)
- **결제**: Polar
- **배포**: Vercel

---

## 구독 플랜 구조

### Free 플랜
- 월 3회 분석 제한
- 기본 분석 항목:
  - Schema.org 마크업 체크
  - FAQ 구조 존재 여부
  - 메타 태그 (title, description)
  - 제목 태그 구조 (H1-H6)

### Pro 플랜 ($0.99/월)
- 무제한 분석
- 기본 분석 + 심화 분석:
  - 페이지 속도 점수
  - E-E-A-T 신호 분석
  - 내부/외부 링크 구조
  - 모바일 최적화
  - 콘텐츠 가독성 점수
  - AI 기반 맞춤 개선 제안
- **일별 AEO 개선 현황 대시보드**
  - 시간별 점수 추이 그래프
  - 개선/악화 항목 하이라이트
  - 경쟁사 비교 (선택)
- **AI 노출 테스트**
  - 테스트 대상 AI 모델:
    - ChatGPT (OpenAI API + web search)
    - Claude (Anthropic API + web search)
    - Gemini (Google AI API + grounding)
    - Perplexity API
  - "n회 중 m회 노출됨" 형태로 모델별 결과 제공
  - 월 50회 테스트 제한 (API 비용)

---

## 개발 순서

### Part 0: Obsidian 프로젝트 문서 생성
1. `Projects/AI/AEO-Analyzer.md` 파일 생성 (ai-project 템플릿 기반)
2. 프로젝트 개요 및 기술 스택 기록
3. 라이프사이클 테이블에 각 파트 진행상황 추적

### Part 1: 프로젝트 셋업
1. Projects 폴더 생성 (`/Users/eeejeenee/clone_jeenee/Projects/`)
2. Next.js 프로젝트 생성 (`/Users/eeejeenee/clone_jeenee/Projects/aeo-analyzer`)
   - clone_jeenee 레포 안에 생성하여 기존 Git으로 함께 관리
3. Tailwind CSS + shadcn/ui 설정
4. 기본 파일 정리
5. ✅ Obsidian 업데이트: "프로토타입" 단계 시작

### Part 2: 랜딩 페이지
1. Hero 섹션 (서비스 소개 + CTA)
2. Features 섹션 (기능 소개)
3. Pricing 섹션 (Free vs Pro 비교)
4. 반응형 디자인

### Part 3: 인증 시스템
1. Supabase 프로젝트 생성
2. Google OAuth 설정
3. 로그인/로그아웃 페이지
4. Supabase MCP 연결

### Part 4: 대시보드
1. URL 입력 폼
2. 분석 히스토리 목록
3. 사용량 표시 (Free: 3/3 남음)
4. 업그레이드 버튼

### Part 5: AEO 분석 엔진
1. 웹페이지 크롤링 (Cheerio)
2. 기본 분석 로직:
   - Schema.org JSON-LD 파싱
   - FAQ 섹션 감지
   - 메타 태그 추출
   - 헤딩 구조 분석
3. Pro 분석 로직:
   - Lighthouse API (속도)
   - 콘텐츠 분석
4. AI 노출 테스트 (Pro 전용):
   - ChatGPT, Claude, Gemini, Perplexity API 연동
   - 관련 키워드 기반 테스트 쿼리 생성
   - 모델별 노출률 계산 및 결과 저장
5. AI 개선 제안 생성 (Claude API)

### Part 6: 결과 페이지
1. 전체 점수 표시 (100점 만점)
2. 카테고리별 상세 점수
3. 개선 포인트 리스트
4. PDF 내보내기 (Pro만)

### Part 7: 결제 시스템
1. Polar 프로젝트 설정
2. Checkout API 연동
3. Webhook 처리 (구독 상태 관리)
4. 구독 관리 페이지

### Part 8: 배포
1. 환경변수 설정
2. Vercel 배포
3. 도메인 연결 (선택)
4. ✅ Obsidian 업데이트: "배포" 단계 완료, 상태를 "completed"로 변경

---

## 데이터베이스 스키마

### users (Supabase Auth 기본)
- id, email, created_at

### profiles
- id (user_id FK)
- plan: 'free' | 'pro'
- analysis_count: number (이번 달 사용량)
- subscription_id: string (Polar)

### analyses
- id
- user_id (FK)
- url: string
- score: number
- results: jsonb (상세 분석 결과)
- created_at

---

## 검증 방법
1. `npm run dev`로 로컬 실행
2. 로그인 → URL 입력 → 분석 결과 확인
3. Polar Sandbox에서 결제 테스트
4. Pro 기능 접근 확인

---

## 현재 작업: Part 8 - Vercel 배포

### 진행 상황
- ✅ Part 1-6 완료
- ⏳ Part 7 (결제) - Polar 연동 대기
- ✅ **Part 8 (배포) - 완료!**

### 다음 할 일
- [x] Supabase profiles 테이블 생성 ✅ 2026-03-19
- [x] usage_logs 테이블 생성 (비로그인/로그인 일 3회 제한용) ✅ 2026-06-17 → `supabase/migrations/0001_usage_logs.sql`
- [x] API에 분석 횟수 제한 로직 추가 ✅ 2026-06-17 (`/api/analyze` + `src/lib/device.ts`)
- [ ] Supabase에 0001~0003 마이그레이션 실행·검증 (아래 "원격 마이그레이션 검증 절차" 참고 — 이슈 #2, **사용자 액션 필요**)
- [x] 대시보드에 남은 횟수 표시 (이슈 #6) ✅ 2026-07-10 — `src/lib/dashboard-data.ts` + `/api/usage`, 가짜 setTimeout·하드코딩 제거
- [x] 분석 히스토리 영속화 (이슈 #7) ✅ 2026-07-10 — `analyses` 저장(free/pro), `/api/analyses`(+`/[id]`), 대시보드 실히스토리, `/result?id=` 저장결과 재조회(재분석 없음)
- [ ] Polar 결제 연동 (이슈 #8, #9)

### 원격 마이그레이션 검증 절차 (이슈 #2)

에이전트 원격 환경에서는 검증 불가 확인됨(2026-07-10): Supabase MCP 미연결,
자격증명(.env) 없음, 네트워크 정책이 supabase.co/vercel.app 아웃바운드 차단.
아래는 **사람이 1~2분에 끝낼 수 있는** 절차:

1. **검증**: Supabase Dashboard > SQL Editor에 `supabase/verify_remote.sql` 전체를
   붙여넣고 Run → 모든 행이 `PASS ✅`인지 확인 (0001/0002/0003 전체 커버).
2. **FAIL이 있으면**: `supabase/migrations/0001_usage_logs.sql` → `0002_profiles.sql`
   → `0003_analyses.sql` 순서로 SQL Editor에서 실행 (모두 멱등이라 재실행 안전) → 1번 재실행.
3. **엔드투엔드 확인** (로컬 터미널):
   ```bash
   DEVICE="verify-$(date +%s)"
   for i in 1 2 3 4; do
     curl -s -o /dev/null -w "try $i -> %{http_code}\n" \
       -X POST https://aeo-analyzer-mu.vercel.app/api/analyze \
       -H 'content-type: application/json' \
       -d "{\"url\":\"https://example.com\",\"deviceId\":\"$DEVICE\"}"
   done
   # 기대: 200, 200, 200, 429  (4회째가 429면 usage_logs 기록+집계가 원격에서 동작하는 것)
   ```
4. 결과를 이슈 #2에 코멘트로 남기고 클로즈.

### 배포 정보
- **URL**: https://aeo-analyzer-mu.vercel.app
- **Vercel 프로젝트**: dlwlsgml573-4540s-projects/aeo-analyzer

### Vercel 배포 단계

#### 1. 빌드 테스트
```bash
npm run build
```
- 타입 에러, 빌드 에러 확인 및 수정

#### 2. Vercel CLI 설치 및 로그인
```bash
npm i -g vercel
vercel login
```

#### 3. 환경변수 설정
Vercel 대시보드 또는 CLI에서 설정:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — Polar 웹훅이 profiles.plan을 갱신할 때 필요 (RLS 우회, 서버 전용. Supabase Dashboard > Settings > API에서 복사)
- `POLAR_ACCESS_TOKEN` — Polar Dashboard > Settings에서 발급
- `POLAR_PRO_PRICE_ID` — Polar에서 Pro 상품($0.99/월) 생성 후 price ID
- `POLAR_WEBHOOK_SECRET` — Polar Dashboard > Webhooks에서 엔드포인트(`https://<도메인>/api/webhooks/polar`) 등록 시 발급. 구독 이벤트(subscription.*) 구독 필요
- `ANTHROPIC_API_KEY` — (선택) Pro AI 예상 질문 생성용. 없으면 휴리스틱만 제공

#### 4. 배포
```bash
vercel --prod
```

#### 5. Supabase Redirect URL 업데이트
- Supabase > Authentication > URL Configuration
- Site URL: `https://[프로젝트명].vercel.app`
- Redirect URLs: `https://[프로젝트명].vercel.app/auth/callback`

#### 6. Google OAuth Redirect URI 추가
- Google Cloud Console > OAuth 2.0 Client
- Authorized redirect URIs에 추가:
  - `https://[supabase-project-id].supabase.co/auth/v1/callback`

### 검증
1. 배포된 URL 접속
2. Google 로그인 테스트
3. URL 분석 기능 테스트

---

## 기능 추가 로그

### 2026-06-25: AI 노출 테스트용 예상 질문 생성 (Free=휴리스틱 / Pro=휴리스틱+AI)
**배경**: "실제 AI 검색에 얼마나 노출되는지" 테스트하려면, 그 전에 "사용자가 이 페이지를 찾을 때 던질 질문"을 먼저 생성하는 선행 모듈이 필요. AI 노출 측정의 입력이 되는 슬라이스. TDD(🔴→🟢)로 작성.

**모듈** (`src/lib/aeo/queries.ts`)
- `extractPageSignals($)` — title/description/H1/소제목/FAQPage 스키마 질문 추출 (파싱과 생성 로직 분리).
- `generateHeuristicQueries(signals, limit)` — 순수·결정적 휴리스틱:
  - FAQ 스키마 질문은 그대로(최고 가치), 질문형 헤딩도 그대로
  - 주제(H1→title, 사이트명 접미사 제거)에 한국어면 `~란?`/`~ 방법`, 영어면 `what is`/`how to` 변형
  - 비질문 헤딩은 `주제 + 헤딩` 키워드 쿼리, 공백정규화·대소문자무시 중복제거·limit 적용
- `generatePredictedQueries(signals, {isPro, aiGenerator})` — **Free/Pro 분기 오케스트레이터**:
  - Free → 휴리스틱만
  - Pro → 휴리스틱 + 주입된 AI 생성기 결과, AI 실패 시에도 휴리스틱 보장

**Pro AI 생성기** (`src/lib/aeo/claudeQueries.ts`)
- `createClaudeQueryGenerator(client?)` — `@anthropic-ai/sdk`, 모델 `claude-opus-4-8`. 페이지 신호로 프롬프트 구성→예상 질문 JSON 배열 파싱(방어적). client 주입 가능(테스트·재사용).
- `AIQueryGenerator` 인터페이스로 주입해 `queries.ts`는 SDK 비의존(순수 테스트 가능). SDK 임포트는 route만 경유.

**통합**
- `AEOAnalysisResult.predictedQueries`(Free=휴리스틱 / Pro=+AI) 추가, `analyzeURL`이 산출.
- `/api/analyze`: Pro && `ANTHROPIC_API_KEY` 있을 때만 Claude 생성기 주입(키 없으면 휴리스틱으로 폴백).

**테스트**: `queries.test.ts` 10개(추출·휴리스틱 규칙·Free/Pro 분기·AI 실패 폴백), 전체 21개 통과·tsc 통과.
**범위 주의**: 실제 AI 모델에 질문을 던져 노출률을 측정하는 단계(2~3슬라이스)와 결과 UI 노출은 후속.

## 버그 수정 로그

### 2026-06-25: AEO 분석 로직 검증 + 버그 2건 수정 (이슈 #4 테스트 인프라 포함)
**배경**: 레포 최초로 AEO 분석 로직을 직접 실행·검증. 산식은 결정적으로 정확하나 자동 테스트가 0개였고, 실행 중 버그 2건 발견.

**Bug A — CJK 콘텐츠 길이 측정 오류**
- **파일**: `src/lib/aeo/analyzer.ts` (`analyzeContentQuality`)
- **문제**: `bodyText.split(/\s+/)`로 단어를 세어, 띄어쓰기로 단어를 나누지 않는 한/중/일 텍스트가 체계적으로 과소 집계됨. 한글 1,200자 본문이 "콘텐츠가 너무 짧습니다"로 오판정.
- **수정**: `countWords()` 헬퍼 추가 — CJK 문자는 글자 단위로, 그 외 언어는 공백으로 분할해 합산.

**Bug B — Pro 카테고리가 총점에 미반영**
- **파일**: `src/lib/aeo/analyzer.ts` (`analyzeURL` → `calculateTotalScore`)
- **문제**: `eeat`/`contentQuality`를 계산만 하고 총점에 합산하지 않아 `free 총점 == pro 총점`.
- **수정**: Pro 분석 시 두 카테고리를 `calculateTotalScore`에 전달. 정규화(점수합/최대합×100)라 카테고리 수가 달라도 100점 만점 유지.

**테스트 인프라 (이슈 #4)**
- Vitest 도입 (`npm test` / `npm run test:watch`), `vitest.config.ts` + `vite-tsconfig-paths`로 `@/` 별칭 해석.
- `src/app/api/analyze/route.test.ts` — 라우트 핸들러를 직접 import해 통합 테스트. Supabase 클라이언트와 fetch만 스텁:
  - 무료·제한 미달 → 분석 실행 + `usage_logs` 기록 + 200
  - 무료·제한 초과(≥3) → 429 + 분석 미실행 + 미기록
  - url 누락/형식 오류 → 400
  - 비로그인 → deviceId 기준 집계
- `src/lib/aeo/analyzer.test.ts` — 기본 채점 + Bug A/B 회귀 고정.
- 결과: 11개 테스트 통과, `tsc --noEmit` 통과.

### 2026-03-19: Microdata 점수 미반영 버그
**파일**: `src/lib/aeo/analyzer.ts` (127-135줄)
**문제**: Microdata 발견 시 items에 추가하지만 score += 를 하지 않음
**수정**: Microdata 발견 시 score += 5 추가

### 2026-03-19: 점수 상세 표시 개선
**파일**:
- `src/lib/aeo/types.ts` - CheckItem에 score, maxScore 필드 추가
- `src/lib/aeo/analyzer.ts` - 각 체크 항목에 점수 정보 포함
- `src/app/result/page.tsx` - UI에서 각 항목별 점수 표시

**변경 내용**:
- 각 CheckItem에 `score`(획득 점수)와 `maxScore`(최대 점수) 추가
- 결과 페이지에서 "항목명: 상태 (획득/최대)" 형식으로 표시
- 미충족 항목도 0점으로 표시하여 투명성 확보

### 2026-03-19: 랜딩 페이지 버튼 동작 추가
**파일**: `src/app/page.tsx`
**문제**: 로그인 안 한 상태에서 버튼 클릭 시 아무 동작 안 함
**수정**:
- "분석하기" 버튼: URL 입력 후 결과 페이지로 이동 (Enter 키 지원)
- "무료로 시작" 버튼: 로그인 페이지로 이동
- "Pro 업그레이드" 버튼: 로그인 페이지로 이동

### 2026-03-19: 결과 페이지 네비게이션 수정
**파일**: `src/app/result/page.tsx`
**문제**: 미로그인 상태에서 "대시보드" 버튼이 부적절
**수정**: "대시보드" → "홈으로" 변경, 링크를 `/` 로 수정

### 2026-03-19: 점수 합산 버그 수정
**파일**: `src/lib/aeo/analyzer.ts`
**문제**: 구조화 데이터 항목들의 점수 합이 카테고리 총점과 불일치
**수정**:
- 모든 항목을 항상 표시 (pass/fail 모두)
- 점수 배분 조정: JSON-LD(15) + 스키마타입(5) + Microdata(5) = 25점
- 4개 카테고리 총합 100점으로 맞춤

### 2026-03-19: 각 항목별 상세 설명 추가
**파일**: `src/lib/aeo/analyzer.ts`
**변경**: 모든 CheckItem에 `details` 필드 추가
- 각 항목이 AEO에 왜 중요한지 설명
- AI가 콘텐츠를 어떻게 활용하는지 맥락 제공

### 2026-03-19: 개선 포인트에 코드 예시 추가
**파일**: `src/lib/aeo/analyzer.ts` (generateImprovements 함수)
**변경**: 비전공자도 이해할 수 있도록 구체적인 HTML 코드 예시 포함
- JSON-LD 스키마 예시
- Title, Meta Description 예시
- FAQ 섹션 구조 예시
- 헤딩 태그 계층 예시

### 2026-03-19: Pro 기능 안내 영역 추가
**파일**: `src/app/result/page.tsx`
**변경**: 결과 페이지 하단에 Pro 버전 기능 소개 카드 추가
- AI 노출 테스트
- E-E-A-T 심화 분석
- 무제한 분석
- AI 맞춤 개선 제안

---

## 다음 구현 필요: 분석 횟수 제한

### Supabase profiles 테이블 SQL
```sql
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  plan text default 'free' check (plan in ('free', 'pro')),
  analysis_count int default 0,
  analysis_reset_date date default current_date,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### usage_logs 테이블 SQL (대기 중)
비로그인/로그인 사용자 모두 **일 3회** 제한

```sql
-- 사용량 추적 테이블
create table public.usage_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  device_id text,
  url_analyzed text not null,
  created_at timestamptz default now()
);

-- 인덱스
create index idx_usage_device_date on public.usage_logs (device_id, created_at);
create index idx_usage_user_date on public.usage_logs (user_id, created_at);

-- RLS
alter table public.usage_logs enable row level security;

create policy "Anyone can insert"
  on public.usage_logs for insert with check (true);

create policy "Users can view own logs"
  on public.usage_logs for select
  using (auth.uid() = user_id);

-- 오늘 사용량 체크 함수 (디바이스 기반 - 비로그인용)
create or replace function get_daily_usage_by_device(p_device_id text)
returns int as $$
  select count(*)::int
  from public.usage_logs
  where device_id = p_device_id
    and created_at >= current_date;
$$ language sql security definer;

-- 오늘 사용량 체크 함수 (유저 기반 - 로그인용)
create or replace function get_daily_usage_by_user(p_user_id uuid)
returns int as $$
  select count(*)::int
  from public.usage_logs
  where user_id = p_user_id
    and created_at >= current_date;
$$ language sql security definer;
```

### API 수정 방법 (`/api/analyze/route.ts`)
```typescript
const DAILY_LIMIT = 3;

// 사용량 체크
if (!isPro) {
  let usageCount = 0;

  if (user) {
    // 로그인: user_id로 체크
    const { data } = await supabase.rpc('get_daily_usage_by_user', { p_user_id: user.id });
    usageCount = data || 0;
  } else if (deviceId) {
    // 비로그인: device_id로 체크
    const { data } = await supabase.rpc('get_daily_usage_by_device', { p_device_id: deviceId });
    usageCount = data || 0;
  }

  if (usageCount >= DAILY_LIMIT) {
    return NextResponse.json({ error: '오늘 무료 분석 횟수(3회)를 모두 사용했습니다.' }, { status: 429 });
  }
}

// 분석 후 사용량 기록
await supabase.from('usage_logs').insert({
  user_id: user?.id || null,
  device_id: deviceId || null,
  url_analyzed: url
});
```

### 프론트엔드 deviceId 생성
```typescript
const getDeviceId = () => {
  let id = localStorage.getItem('aeo_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('aeo_device_id', id);
  }
  return id;
};
```
