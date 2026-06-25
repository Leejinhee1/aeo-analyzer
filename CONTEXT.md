# CONTEXT

AEO Analyzer의 도메인 단일 컨텍스트. 용어, 핵심 제약, 외부 연동을 한곳에 정리한다.
ADR은 `docs/adr/`, 개발 계획·버그 로그는 `PLAN.md` 참조.

## 한 줄 정의

URL을 입력하면 그 웹페이지의 **AEO(Answer Engine Optimization)** 최적화 상태를 점수화하고 개선점을 알려주는 SaaS.

## 도메인 용어 (Ubiquitous Language)

- **AEO (Answer Engine Optimization)**: 검색엔진이 아니라 답변엔진(ChatGPT, Claude, Perplexity 등 AI)이 콘텐츠를 잘 인용·노출하도록 페이지를 최적화하는 것. 이 서비스가 측정하는 대상.
- **분석 (Analysis)**: 하나의 URL에 대해 HTML을 가져와 AEO 관점에서 점수와 개선점을 산출하는 1회 작업. 결과 형태는 `AEOAnalysisResult`.
- **점수 (Score)**: 100점 만점의 AEO 종합 점수. 카테고리 점수의 합.
- **카테고리 (Category)**: 점수를 구성하는 평가 축. 무료 분석은 4개 — **구조화 데이터(structuredData)**, **메타 태그(metaTags)**, **헤딩 구조(headingStructure)**, **FAQ**. 각 카테고리는 `score`/`maxScore`와 체크 항목 목록을 가진다.
- **체크 항목 (CheckItem)**: 카테고리 안의 개별 점검 단위. `status`는 `pass | fail | warning | skip`, 각 항목이 `score`/`maxScore`를 가져 점수 산출이 투명하다.
- **개선 포인트 (Improvement)**: 점수를 올리기 위한 권장 사항. `priority`(high/medium/low)와 코드 예시 포함 설명.
- **사용량 (Usage)**: 사용자(또는 디바이스)가 오늘 실행한 분석 횟수. `usage_logs`에 분석 1건당 1행 기록.
- **디바이스 ID (deviceId)**: 비로그인 사용자를 식별하는 localStorage 기반 UUID(`aeo_device_id`). 비로그인 사용량 집계 키.
- **플랜 (Plan)**: 사용자의 구독 등급. `free` 또는 `pro`. `profiles.plan`에 저장되며 **서버가 유일한 권위**다.
- **구독 (Subscription)**: Polar에서 관리하는 Pro 결제 상태. webhook으로 `profiles.plan`에 반영된다.

## 핵심 제약 (Invariants)

- **일 3회 제한**: 무료(`free`) 사용자는 **하루 3회**까지 분석 가능. "월"이 아니라 **"일" 기준이며 자정(서버 날짜 경계)에 리셋**된다. 집계는 `usage_logs`의 당일 행 수로 계산(`created_at >= current_date`).
- **로그인=user_id, 비로그인=deviceId**로 사용량을 집계한다.
- **플랜 판정 권위는 서버**다. 클라이언트가 보내는 `isPro` 같은 값은 신뢰하지 않는다. 로그인 사용자의 Pro 여부는 서버에서 `profiles.plan`을 조회해 판정한다. (결제 우회 방지의 핵심)
- **Pro는 무제한 분석**: `plan='pro'`이면 일 3회 제한을 적용하지 않는다.
- **본인 데이터만 접근**: `usage_logs`, `analyses`, `profiles`는 RLS로 본인 행만 조회/변경 가능.

## 외부 연동

- **Supabase** — 인증(Google OAuth) + DB. 테이블: `usage_logs`(사용량), 그리고 로드맵상 추가 예정인 `profiles`(플랜), `analyses`(히스토리). 사용량 집계는 RPC 함수 `get_daily_usage_by_user`/`get_daily_usage_by_device`로 수행.
- **Polar** — Pro 구독 결제. `/api/checkout`으로 결제 시작, `/api/webhooks/polar`로 구독 상태(created/updated/canceled)를 받아 플랜에 반영. 환경변수: `POLAR_ACCESS_TOKEN`, `POLAR_PRO_PRICE_ID`, `POLAR_WEBHOOK_SECRET`.
- **Vercel** — 배포. 운영 URL: https://aeo-analyzer-mu.vercel.app

## 주요 경로

- `/` — 랜딩 + URL 입력
- `/result?url=...` — 분석 실행·결과 표시 (실제 `/api/analyze` 호출 경로)
- `/dashboard` — 로그인 후 분석 시작·사용량·히스토리
- `/login`, `/auth/callback` — 인증
- `/api/analyze` — 분석 실행 + 사용량 제한의 단일 권위
- `/api/checkout`, `/api/webhooks/polar` — 결제

## 기술 스택

Next.js 16 (App Router) · React 19 · Supabase(Auth+DB) · Tailwind CSS 4 + shadcn/ui · Cheerio(HTML 파싱) · Polar(결제).
