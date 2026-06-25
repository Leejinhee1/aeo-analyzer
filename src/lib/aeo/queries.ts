import * as cheerio from "cheerio";

/**
 * 페이지에서 추출한, 예상 질문 생성에 쓰이는 신호.
 * 파싱(extractPageSignals)과 질문 생성 로직을 분리해 후자를 순수 함수로 테스트한다.
 */
export interface PageSignals {
  title: string;
  description: string;
  h1: string[];
  headings: string[]; // h2, h3
  faqQuestions: string[]; // FAQPage 스키마 mainEntity[].name
}

export interface PredictedQueries {
  /** 휴리스틱 기반 예상 질문 (Free·Pro 공통) */
  heuristic: string[];
  /** Claude API 기반 예상 질문 (Pro 전용) */
  ai?: string[];
}

/** 페이지 신호를 받아 AI 기반 예상 질문을 생성하는 주입형 인터페이스(테스트 seam). */
export type AIQueryGenerator = (
  signals: PageSignals,
  opts: { limit: number }
) => Promise<string[]>;

// --- 파싱 ---

export function extractPageSignals($: cheerio.CheerioAPI): PageSignals {
  const title = $("title").first().text().trim();
  const description = $('meta[name="description"]').attr("content")?.trim() ?? "";
  const h1 = $("h1")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  const headings = $("h2, h3")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  return { title, description, h1, headings, faqQuestions: extractFaqQuestions($) };
}

function extractFaqQuestions($: cheerio.CheerioAPI): string[] {
  const questions: string[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      const nodes = Array.isArray(data["@graph"]) ? data["@graph"] : [data];
      for (const node of nodes) {
        if (node?.["@type"] !== "FAQPage" || !Array.isArray(node.mainEntity)) continue;
        for (const entity of node.mainEntity) {
          const name = typeof entity?.name === "string" ? entity.name.trim() : "";
          if (name) questions.push(name);
        }
      }
    } catch {
      // 파싱 에러 무시
    }
  });

  return questions;
}

// --- 휴리스틱 질문 생성 ---

const INTERROGATIVES = ["무엇", "어떻게", "왜", "언제", "어디", "누구", "어떤", "얼마"];

function isQuestion(text: string): boolean {
  const t = text.trim();
  if (t.includes("?") || t.includes("？")) return true;
  if (INTERROGATIVES.some((w) => t.includes(w))) return true;
  // 한국어 의문형 종결어미
  return /(나요|까요|가요|은가요|ㄴ가요|을까요|ㄹ까요)$/.test(t);
}

function isKorean(text: string): boolean {
  return /[가-힣]/.test(text);
}

/** 제목에서 사이트명 접미사("주제 - 사이트", "주제 | 사이트")를 제거한 핵심 주제. */
function cleanTopic(text: string): string {
  return text.split(/\s+[-|–—]\s+/)[0].trim();
}

/** 공백 정규화 + 대소문자 무시 중복 제거. 첫 등장 순서·원본 표기 유지. */
function dedupe(items: string[], limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const value = raw.replace(/\s+/g, " ").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

export function generateHeuristicQueries(signals: PageSignals, limit = 10): string[] {
  const topic = cleanTopic(signals.h1[0] || signals.title);
  const candidates: string[] = [];

  // 1. FAQ 스키마 질문 — 실제 질문이라 가장 가치가 높다
  candidates.push(...signals.faqQuestions);

  // 2. 질문형 헤딩은 그대로
  for (const h of signals.headings) {
    if (isQuestion(h)) candidates.push(h);
  }

  // 3. 주제 자체 + 주제 변형
  if (topic) {
    candidates.push(topic);
    if (isKorean(topic)) {
      candidates.push(`${topic}란?`, `${topic} 방법`);
    } else {
      candidates.push(`what is ${topic}`, `how to ${topic}`);
    }
  }

  // 4. 비질문 헤딩 → 주제로 한정한 키워드 쿼리
  for (const h of signals.headings) {
    if (isQuestion(h) || !topic || h === topic || h.length > 25) continue;
    candidates.push(`${topic} ${h}`);
  }

  return dedupe(candidates, limit);
}

// --- Free/Pro 분기 오케스트레이터 ---

export async function generatePredictedQueries(
  signals: PageSignals,
  opts: { isPro: boolean; limit?: number; aiGenerator?: AIQueryGenerator }
): Promise<PredictedQueries> {
  const limit = opts.limit ?? 10;
  const heuristic = generateHeuristicQueries(signals, limit);

  // Free: 휴리스틱만. Pro: AI 생성기가 있으면 둘 다.
  if (!opts.isPro || !opts.aiGenerator) {
    return { heuristic };
  }

  try {
    const ai = await opts.aiGenerator(signals, { limit });
    return { heuristic, ai: dedupe(ai, limit) };
  } catch {
    // AI 생성 실패 시에도 휴리스틱은 보장
    return { heuristic };
  }
}
