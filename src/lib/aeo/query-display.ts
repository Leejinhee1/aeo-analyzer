import type { PredictedQueries } from "./queries";

/**
 * 결과 페이지 "예상 질문" 섹션의 표시용 뷰모델.
 * cheerio를 임포트하는 queries.ts와 분리해 클라이언트 번들에 파서가 딸려가지 않게 한다.
 */
export interface PredictedQueryView {
  /** 휴리스틱 기반 질문 (Free·Pro 공통) */
  heuristic: string[];
  /** Claude 기반 질문 (Pro 분석에만 존재) */
  ai: string[];
  /** AI 섹션을 별도(Pro 배지)로 표시할지 여부 */
  showAiSection: boolean;
  /** 표시할 질문이 하나도 없어 안내 문구를 보여줘야 하는지 여부 */
  isEmpty: boolean;
}

/** 배열이 아니거나 문자열이 아닌 항목이 섞여 있어도 안전하게 문자열 목록으로 정리한다. */
function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * 저장된 분석(jsonb)에는 predictedQueries가 아예 없을 수 있으므로
 * undefined/부분 데이터를 받아도 런타임 에러 없이 뷰모델을 만든다.
 * AI 질문은 Pro 분석 결과에만 존재하므로, 데이터 유무로 Pro 섹션 표시를 결정한다.
 */
export function buildPredictedQueryView(
  predictedQueries: Partial<PredictedQueries> | null | undefined
): PredictedQueryView {
  const heuristic = toStringList(predictedQueries?.heuristic);
  const ai = toStringList(predictedQueries?.ai);

  return {
    heuristic,
    ai,
    showAiSection: ai.length > 0,
    isEmpty: heuristic.length === 0 && ai.length === 0,
  };
}
