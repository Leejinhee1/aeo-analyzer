import Anthropic from "@anthropic-ai/sdk";
import type { AIQueryGenerator, PageSignals } from "./queries";

const MODEL = "claude-opus-4-8";

function buildPrompt(signals: PageSignals, limit: number): string {
  const lines = [
    `제목: ${signals.title}`,
    signals.description ? `설명: ${signals.description}` : "",
    signals.h1.length ? `H1: ${signals.h1.join(" / ")}` : "",
    signals.headings.length ? `소제목: ${signals.headings.join(" / ")}` : "",
    signals.faqQuestions.length ? `기존 FAQ: ${signals.faqQuestions.join(" / ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "아래는 한 웹페이지의 핵심 콘텐츠 신호다. 이 페이지를 찾으려는 실제 사용자가",
    "ChatGPT·Claude·Gemini·Perplexity 같은 AI 검색에 던질 법한 자연스러운 질문을",
    `${limit}개 생성하라. 페이지 언어에 맞춰 작성하고, 중복 없이 다양하게 만든다.`,
    "",
    "콘텐츠 신호:",
    lines,
    "",
    '오직 JSON 문자열 배열만 출력하라. 예: ["질문1", "질문2"]. 다른 설명은 출력하지 마라.',
  ].join("\n");
}

/** 모델 응답 텍스트에서 JSON 문자열 배열을 방어적으로 파싱한다. */
function parseQueries(text: string): string[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((q): q is string => typeof q === "string" && q.trim() !== "");
  } catch {
    return [];
  }
}

/**
 * Claude API 기반 예상 질문 생성기(Pro 전용).
 * client를 주입하면 테스트/재사용이 가능하고, 없으면 ANTHROPIC_API_KEY로 생성한다.
 */
export function createClaudeQueryGenerator(client?: Anthropic): AIQueryGenerator {
  return async (signals, { limit }) => {
    const anthropic = client ?? new Anthropic();
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: buildPrompt(signals, limit) }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return [];
    return parseQueries(textBlock.text).slice(0, limit);
  };
}
