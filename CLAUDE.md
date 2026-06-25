# AEO Analyzer

URL을 입력하면 AEO(Answer Engine Optimization) 최적화 상태를 분석하는 SaaS 서비스

## 참고 문서
- 플랜 파일 (개발 계획, 버그 수정 로그 포함): `./PLAN.md`
- Obsidian 문서: `/Users/eeejeenee/Projects/Vault/Projects/AEO-Analyzer.md`

## 기술 스택
- Next.js 16 (App Router)
- Supabase (Auth + DB)
- Tailwind CSS + shadcn/ui
- Cheerio (HTML 파싱)

## 주요 명령어
```bash
npm run dev    # 개발 서버 (localhost:3000)
npm run build  # 프로덕션 빌드
```

## Agent skills

Matt Pocock 엔지니어링 스킬(`/tdd`, `/to-issues`, `/triage`, `/to-prd`, `/qa`, `/diagnosing-bugs`, `/improve-codebase-architecture`, `/review` 등)이 이 레포에서 동작하도록 구성됨.

### Issue tracker

이슈/PRD는 GitHub Issues(`Leejinhee1/aeo-analyzer`)에서 관리, `gh` CLI 사용. 외부 PR은 트리아지 대상 아님. See `docs/agents/issue-tracker.md`.

### Triage labels

5개 표준 트리아지 라벨(`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`)을 그대로 사용. See `docs/agents/triage-labels.md`.

### Domain docs

단일 컨텍스트 — 루트의 `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
