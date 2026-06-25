import { describe, it, expect, vi } from "vitest";
import * as cheerio from "cheerio";
import {
  extractPageSignals,
  generateHeuristicQueries,
  generatePredictedQueries,
  type PageSignals,
} from "./queries";

const koSignals: PageSignals = {
  title: "김치찌개 레시피 - 요리블로그",
  description: "맛있는 김치찌개",
  h1: ["김치찌개 만들기"],
  headings: ["재료 준비", "조리 순서", "보관 방법은 무엇인가요?"],
  faqQuestions: ["배송은 얼마나 걸리나요?", "환불이 가능한가요?"],
};

describe("extractPageSignals", () => {
  it("title·헤딩·FAQPage 스키마 질문을 추출한다", () => {
    const faq = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [{ "@type": "Question", name: "배송은 얼마나 걸리나요?" }],
    });
    const html = `<html><head>
      <title>김치찌개 레시피</title>
      <meta name="description" content="맛있는 김치찌개">
      <script type="application/ld+json">${faq}</script>
      </head><body>
      <h1>김치찌개 만들기</h1><h2>재료</h2><h3>조리</h3>
      </body></html>`;
    const s = extractPageSignals(cheerio.load(html));

    expect(s.title).toBe("김치찌개 레시피");
    expect(s.description).toBe("맛있는 김치찌개");
    expect(s.h1).toEqual(["김치찌개 만들기"]);
    expect(s.headings).toEqual(["재료", "조리"]);
    expect(s.faqQuestions).toContain("배송은 얼마나 걸리나요?");
  });
});

describe("generateHeuristicQueries", () => {
  it("FAQ 질문을 그대로 포함한다", () => {
    const q = generateHeuristicQueries(koSignals, 20);
    expect(q).toContain("배송은 얼마나 걸리나요?");
    expect(q).toContain("환불이 가능한가요?");
  });

  it("한국어 주제에 '~란?'·'~ 방법' 변형을 만든다", () => {
    const q = generateHeuristicQueries(koSignals, 20);
    expect(q).toContain("김치찌개 만들기란?");
    expect(q).toContain("김치찌개 만들기 방법");
  });

  it("질문형 헤딩은 변형 없이 그대로 포함한다", () => {
    const q = generateHeuristicQueries(koSignals, 20);
    expect(q).toContain("보관 방법은 무엇인가요?");
    expect(q).not.toContain("김치찌개 만들기 보관 방법은 무엇인가요?");
  });

  it("비질문 헤딩은 주제로 한정한 키워드 쿼리를 만든다", () => {
    const q = generateHeuristicQueries(koSignals, 20);
    expect(q).toContain("김치찌개 만들기 재료 준비");
  });

  it("limit를 초과하지 않고 중복이 없다", () => {
    const q = generateHeuristicQueries(koSignals, 5);
    expect(q.length).toBeLessThanOrEqual(5);
    expect(new Set(q).size).toBe(q.length);
  });

  it("영어 주제에는 'what is' 변형을 만든다", () => {
    const q = generateHeuristicQueries(
      { title: "Running Shoes Guide", description: "", h1: ["Running Shoes Guide"], headings: [], faqQuestions: [] },
      20
    );
    expect(q).toContain("Running Shoes Guide");
    expect(q.some((x) => /what is/i.test(x))).toBe(true);
  });
});

describe("generatePredictedQueries — Free/Pro 분기", () => {
  it("Free는 휴리스틱만 제공하고 AI 생성기를 호출하지 않는다", async () => {
    const aiGen = vi.fn();
    const r = await generatePredictedQueries(koSignals, { isPro: false, aiGenerator: aiGen });

    expect(r.heuristic.length).toBeGreaterThan(0);
    expect(r.ai).toBeUndefined();
    expect(aiGen).not.toHaveBeenCalled();
  });

  it("Pro는 휴리스틱과 AI 둘 다 제공한다", async () => {
    const aiGen = vi.fn().mockResolvedValue(["AI가 만든 질문1", "AI가 만든 질문2"]);
    const r = await generatePredictedQueries(koSignals, { isPro: true, aiGenerator: aiGen });

    expect(r.heuristic.length).toBeGreaterThan(0);
    expect(r.ai).toEqual(["AI가 만든 질문1", "AI가 만든 질문2"]);
    expect(aiGen).toHaveBeenCalledOnce();
  });

  it("Pro에서 AI 생성기가 실패해도 휴리스틱은 반환한다", async () => {
    const aiGen = vi.fn().mockRejectedValue(new Error("API down"));
    const r = await generatePredictedQueries(koSignals, { isPro: true, aiGenerator: aiGen });

    expect(r.heuristic.length).toBeGreaterThan(0);
    expect(r.ai).toBeUndefined();
  });
});
