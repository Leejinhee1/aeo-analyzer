import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeURL } from "./analyzer";

/**
 * analyzeURL은 전역 fetch로 분석 대상 페이지를 가져온다.
 * 실제 네트워크를 치지 않도록 fetch를 스텁해 고정 HTML을 반환한다.
 */
function stubFetchHtml(html: string) {
  const res = {
    ok: true,
    status: 200,
    text: async () => html,
  } as unknown as Response;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res));
}

const FULL_PAGE = `<!doctype html><html><head>
<title>김치찌개 황금 레시피 - 10분 완성 집밥 가이드 모음</title>
<meta name="description" content="집에서 10분만에 만드는 정통 김치찌개 레시피입니다. 돼지고기와 묵은지로 깊은 맛을 내는 비법과 재료 손질, 조리 순서를 단계별로 아주 자세히 알려드립니다. 초보도 한 번에 성공할 수 있어요.">
<meta property="og:title" content="김치찌개 레시피">
<meta property="og:description" content="10분 완성 김치찌개">
<meta property="og:image" content="https://e.com/a.jpg">
<link rel="canonical" href="https://e.com/kimchi">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"요리블로그"}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[]}</script>
</head><body>
<h1>김치찌개 만들기</h1>
<h2>재료 준비</h2><h3>채소 손질</h3>
<h2>자주 묻는 질문 FAQ</h2>
<div itemscope itemtype="https://schema.org/Recipe"><span>x</span></div>
</body></html>`;

const EMPTY_PAGE = `<!doctype html><html><head></head><body><p>안녕</p></body></html>`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("analyzeURL 기본 채점", () => {
  it("잘 최적화된 페이지는 높은 점수와 만점 카테고리를 받는다", async () => {
    stubFetchHtml(FULL_PAGE);
    const r = await analyzeURL("https://test/full", { isPro: false });

    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.categories.structuredData.score).toBe(25);
    expect(r.categories.faq.score).toBe(25);
  });

  it("빈 페이지는 0점이고 개선점을 생성한다", async () => {
    stubFetchHtml(EMPTY_PAGE);
    const r = await analyzeURL("https://test/empty", { isPro: false });

    expect(r.score).toBe(0);
    expect(r.improvements.length).toBeGreaterThan(0);
  });
});

describe("Bug A: CJK 콘텐츠 길이 측정", () => {
  it("공백이 거의 없는 한국어 장문도 '짧음'으로 오판정하지 않는다", async () => {
    // 띄어쓰기 없는 한글 1000자 이상 (과거엔 split(/\s+/)로 1단어 취급 → 오판정)
    const longKo = "가나다라마바사아자차".repeat(120); // 1200자
    const html = `<html><head><title>t</title></head><body><article>${longKo}</article></body></html>`;
    stubFetchHtml(html);

    const r = await analyzeURL("https://test/ko", { isPro: true });
    const lenItem = r.categories.contentQuality?.items.find(
      (i) => i.name === "콘텐츠 길이"
    );

    expect(lenItem?.status).toBe("pass");
    expect(lenItem?.score).toBe(10);
  });

  it("한국어 짧은 글은 여전히 짧음으로 판정한다", async () => {
    const html = `<html><head><title>t</title></head><body><article>짧은 글입니다</article></body></html>`;
    stubFetchHtml(html);

    const r = await analyzeURL("https://test/short", { isPro: true });
    const lenItem = r.categories.contentQuality?.items.find(
      (i) => i.name === "콘텐츠 길이"
    );

    expect(lenItem?.status).toBe("fail");
  });
});

describe("Bug B: Pro 카테고리가 총점에 반영", () => {
  it("eeat/contentQuality가 풍부하면 Pro 총점이 free 총점보다 높을 수 있다", async () => {
    // E-E-A-T/콘텐츠 신호가 강한 페이지: 저자 스키마, About/연락처, 날짜, 긴 본문, alt 이미지
    const proRich = `<!doctype html><html><head>
<title>전문가가 쓴 심층 가이드 - 신뢰할 수 있는 정보 모음집</title>
<meta name="description" content="분야 전문가가 직접 작성한 심층 가이드입니다. 출처와 저자 정보, 작성일을 명확히 밝혀 신뢰성을 높였습니다. 자세한 내용을 단계별로 정리했습니다.">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","author":{"@type":"Person","name":"홍길동"}}</script>
</head><body>
<h1>심층 가이드</h1><h2>개요</h2><h3>배경</h3>
<a href="/about">회사소개</a><a href="mailto:hi@e.com">연락처</a>
<time datetime="2026-01-01">2026-01-01</time>
<article>${"가나다라마바사아자차".repeat(120)}</article>
<img src="a.jpg" alt="설명1"><img src="b.jpg" alt="설명2">
<a href="/a">1</a><a href="/b">2</a><a href="/c">3</a>
</body></html>`;
    stubFetchHtml(proRich);

    const free = await analyzeURL("https://test/pro", { isPro: false });
    stubFetchHtml(proRich);
    const pro = await analyzeURL("https://test/pro", { isPro: true });

    // free는 4개 카테고리만, pro는 eeat/contentQuality까지 합산
    expect(pro.categories.eeat).toBeDefined();
    expect(pro.categories.contentQuality).toBeDefined();
    expect(pro.score).toBeGreaterThan(free.score);
  });
});
