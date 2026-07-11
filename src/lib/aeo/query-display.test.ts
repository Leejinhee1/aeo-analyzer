import { describe, it, expect } from "vitest";
import { buildPredictedQueryView } from "./query-display";

describe("buildPredictedQueryView", () => {
  it("휴리스틱만 있으면(Free) AI 섹션 없이 휴리스틱만 표시한다", () => {
    const v = buildPredictedQueryView({ heuristic: ["질문1", "질문2"] });

    expect(v.heuristic).toEqual(["질문1", "질문2"]);
    expect(v.ai).toEqual([]);
    expect(v.showAiSection).toBe(false);
    expect(v.isEmpty).toBe(false);
  });

  it("AI 질문이 있으면(Pro) AI 섹션을 함께 표시한다", () => {
    const v = buildPredictedQueryView({
      heuristic: ["휴리스틱 질문"],
      ai: ["AI 질문1", "AI 질문2"],
    });

    expect(v.heuristic).toEqual(["휴리스틱 질문"]);
    expect(v.ai).toEqual(["AI 질문1", "AI 질문2"]);
    expect(v.showAiSection).toBe(true);
    expect(v.isEmpty).toBe(false);
  });

  it("ai가 빈 배열이면(키 미설정·실패) AI 섹션을 표시하지 않는다", () => {
    const v = buildPredictedQueryView({ heuristic: ["질문"], ai: [] });

    expect(v.showAiSection).toBe(false);
    expect(v.isEmpty).toBe(false);
  });

  it("과거 저장 분석처럼 predictedQueries가 없으면(undefined) 빈 상태로 처리한다", () => {
    expect(buildPredictedQueryView(undefined)).toEqual({
      heuristic: [],
      ai: [],
      showAiSection: false,
      isEmpty: true,
    });
    expect(buildPredictedQueryView(null).isEmpty).toBe(true);
  });

  it("질문이 0개면 isEmpty로 안내 문구를 표시하게 한다", () => {
    const v = buildPredictedQueryView({ heuristic: [] });

    expect(v.isEmpty).toBe(true);
    expect(v.showAiSection).toBe(false);
  });

  it("jsonb에서 온 비정상 데이터(배열 아님·비문자열·공백)도 안전하게 정리한다", () => {
    const v = buildPredictedQueryView({
      // 저장된 jsonb는 타입 보장이 없으므로 방어적으로 처리해야 한다
      heuristic: "not-an-array" as unknown as string[],
      ai: [1, null, "  유효한 질문  ", ""] as unknown as string[],
    });

    expect(v.heuristic).toEqual([]);
    expect(v.ai).toEqual(["유효한 질문"]);
    expect(v.showAiSection).toBe(true);
    expect(v.isEmpty).toBe(false);
  });
});
