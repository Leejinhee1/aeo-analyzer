import * as cheerio from "cheerio";
import type {
  AEOAnalysisResult,
  CategoryResult,
  CheckItem,
  Improvement,
  AnalysisOptions,
} from "./types";
import { extractPageSignals, generatePredictedQueries } from "./queries";

export async function analyzeURL(
  url: string,
  options: AnalysisOptions
): Promise<AEOAnalysisResult> {
  // 웹페이지 가져오기 (브라우저처럼 요청)
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000), // 15초 타임아웃
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("timeout") || message.includes("aborted")) {
      throw new Error("페이지 로딩 시간이 초과되었습니다. 나중에 다시 시도해주세요.");
    }
    throw new Error(`페이지에 접근할 수 없습니다. 해당 사이트가 외부 접근을 차단하고 있을 수 있습니다.`);
  }

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error("이 사이트는 외부 분석을 차단하고 있습니다. 금융/보안 사이트는 분석이 제한될 수 있습니다.");
    }
    if (response.status === 404) {
      throw new Error("페이지를 찾을 수 없습니다. URL을 확인해주세요.");
    }
    throw new Error(`페이지 로드 실패 (HTTP ${response.status})`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // 기본 분석
  const structuredData = analyzeStructuredData($);
  const metaTags = analyzeMetaTags($);
  const headingStructure = analyzeHeadingStructure($);
  const faq = analyzeFAQ($);

  // Pro 분석 (옵션)
  let eeat: CategoryResult | undefined;
  let contentQuality: CategoryResult | undefined;

  if (options.isPro) {
    eeat = analyzeEEAT($);
    contentQuality = analyzeContentQuality($);
  }

  // 개선점 생성
  const improvements = generateImprovements({
    structuredData,
    metaTags,
    headingStructure,
    faq,
    eeat,
    contentQuality,
  });

  // 전체 점수 계산 (Pro 분석 시 eeat/contentQuality도 합산 — calculateTotalScore가
  // 카테고리 maxScore 합으로 정규화하므로 카테고리 수가 달라도 100점 만점으로 환산된다)
  const totalScore = calculateTotalScore({
    structuredData,
    metaTags,
    headingStructure,
    faq,
    ...(eeat && { eeat }),
    ...(contentQuality && { contentQuality }),
  });

  // AI 노출 테스트용 예상 질문 (Free: 휴리스틱, Pro: 휴리스틱 + AI)
  const predictedQueries = await generatePredictedQueries(extractPageSignals($), {
    isPro: options.isPro,
    aiGenerator: options.aiQueryGenerator,
  });

  return {
    url,
    score: totalScore,
    timestamp: new Date().toISOString(),
    categories: {
      structuredData,
      metaTags,
      headingStructure,
      faq,
      ...(options.isPro && { eeat, contentQuality }),
    },
    improvements,
    predictedQueries,
  };
}

function analyzeStructuredData($: cheerio.CheerioAPI): CategoryResult {
  const items: CheckItem[] = [];
  let score = 0;
  const maxScore = 25; // JSON-LD(15) + 스키마 품질(5) + Microdata(5)

  // JSON-LD 스크립트 찾기
  const jsonLdScripts = $('script[type="application/ld+json"]');

  // JSON-LD 타입 분석
  let hasOrgOrSite = false;
  let hasArticle = false;
  let hasFAQ = false;

  if (jsonLdScripts.length > 0) {
    items.push({
      name: "JSON-LD 존재",
      status: "pass",
      message: `${jsonLdScripts.length}개의 JSON-LD 스크립트 발견`,
      details: "JSON-LD는 AI가 페이지 내용을 정확히 이해하는 핵심 요소입니다. Google, ChatGPT, Perplexity 등이 이 데이터를 직접 파싱하여 답변에 활용합니다.",
      score: 15,
      maxScore: 15,
    });
    score += 15;

    jsonLdScripts.each((_, el) => {
      try {
        const content = $(el).html();
        if (content) {
          const data = JSON.parse(content);
          const types = Array.isArray(data) ? data.map((d) => d["@type"]) : [data["@type"]];

          if (types.includes("Organization") || types.includes("WebSite")) hasOrgOrSite = true;
          if (types.includes("Article") || types.includes("BlogPosting")) hasArticle = true;
          if (types.includes("FAQPage")) hasFAQ = true;
        }
      } catch {
        // 파싱 에러는 무시
      }
    });
  } else {
    items.push({
      name: "JSON-LD 존재",
      status: "fail",
      message: "JSON-LD 구조화 데이터가 없습니다",
      details: "JSON-LD를 추가하면 AI가 콘텐츠의 유형, 저자, 날짜 등을 명확히 파악할 수 있어 인용 확률이 높아집니다.",
      score: 0,
      maxScore: 15,
    });
  }

  // 스키마 품질 (Organization/Article/FAQ 중 하나라도 있으면 5점)
  const schemaTypes = [
    hasOrgOrSite ? "Organization/WebSite" : null,
    hasArticle ? "Article" : null,
    hasFAQ ? "FAQPage" : null,
  ].filter(Boolean);

  if (schemaTypes.length > 0) {
    items.push({
      name: "스키마 타입",
      status: "pass",
      message: schemaTypes.join(", ") + " 발견",
      details: "Organization은 브랜드 신뢰도를, Article은 콘텐츠 맥락을, FAQPage는 Q&A 형식의 직접 답변 노출을 돕습니다.",
      score: 5,
      maxScore: 5,
    });
    score += 5;
  } else {
    items.push({
      name: "스키마 타입",
      status: "fail",
      message: "권장 스키마 없음 (Organization, Article, FAQ)",
      details: "콘텐츠 유형에 맞는 스키마를 추가하세요. 블로그는 Article, FAQ 페이지는 FAQPage 스키마가 효과적입니다.",
      score: 0,
      maxScore: 5,
    });
  }

  // Microdata 확인
  const itemscope = $("[itemscope]");
  if (itemscope.length > 0) {
    items.push({
      name: "Microdata",
      status: "pass",
      message: `${itemscope.length}개의 Microdata 발견`,
      details: "Microdata는 HTML 요소에 직접 의미를 부여하여 AI가 페이지 구조를 더 잘 이해하도록 돕습니다.",
      score: 5,
      maxScore: 5,
    });
    score += 5;
  } else {
    items.push({
      name: "Microdata",
      status: "fail",
      message: "Microdata 없음",
      details: "JSON-LD가 있다면 Microdata는 선택사항이지만, 둘 다 있으면 AI 이해도가 더 높아집니다.",
      score: 0,
      maxScore: 5,
    });
  }

  return { score, maxScore, items };
}

function analyzeMetaTags($: cheerio.CheerioAPI): CategoryResult {
  const items: CheckItem[] = [];
  let score = 0;
  const maxScore = 25;

  // Title (8점)
  const title = $("title").text().trim();
  if (title) {
    if (title.length >= 30 && title.length <= 60) {
      items.push({ name: "Title 태그", status: "pass", message: `적절한 길이 (${title.length}자)`, details: "AI는 Title을 콘텐츠의 주제를 파악하는 첫 번째 신호로 사용합니다. 30-60자가 검색 결과에서 잘리지 않는 최적 길이입니다.", score: 8, maxScore: 8 });
      score += 8;
    } else {
      items.push({ name: "Title 태그", status: "warning", message: `길이 조정 필요 (${title.length}자, 권장: 30-60자)`, details: "너무 짧으면 정보 부족, 너무 길면 검색 결과에서 잘립니다. AI가 주제를 정확히 파악할 수 있도록 핵심 키워드를 포함한 30-60자를 권장합니다.", score: 4, maxScore: 8 });
      score += 4;
    }
  } else {
    items.push({ name: "Title 태그", status: "fail", message: "Title 태그가 없습니다", details: "Title 태그는 필수입니다. AI가 페이지 주제를 파악하지 못하면 답변 소스로 선택될 확률이 크게 낮아집니다.", score: 0, maxScore: 8 });
  }

  // Meta Description (8점)
  const description = $('meta[name="description"]').attr("content")?.trim();
  if (description) {
    if (description.length >= 120 && description.length <= 160) {
      items.push({ name: "Meta Description", status: "pass", message: `적절한 길이 (${description.length}자)`, details: "Meta Description은 AI가 페이지 요약을 이해하는 데 활용됩니다. 질문에 대한 답변 형태로 작성하면 AI 인용 확률이 높아집니다.", score: 8, maxScore: 8 });
      score += 8;
    } else {
      items.push({ name: "Meta Description", status: "warning", message: `길이 조정 필요 (${description.length}자, 권장: 120-160자)`, details: "120-160자 사이로 작성하면 검색 결과에서 완전히 표시됩니다. 핵심 내용을 간결하게 요약하세요.", score: 4, maxScore: 8 });
      score += 4;
    }
  } else {
    items.push({ name: "Meta Description", status: "fail", message: "Meta Description이 없습니다", details: "Meta Description이 없으면 AI가 페이지 내용을 요약하기 어렵습니다. 콘텐츠의 핵심을 담은 설명을 추가하세요.", score: 0, maxScore: 8 });
  }

  // Open Graph (5점)
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogDesc = $('meta[property="og:description"]').attr("content");
  const ogImage = $('meta[property="og:image"]').attr("content");

  if (ogTitle && ogDesc && ogImage) {
    items.push({ name: "Open Graph", status: "pass", message: "완전한 OG 태그 설정", details: "OG 태그는 소셜 미디어 공유 시 표시되며, 일부 AI 모델도 이 정보를 참조하여 콘텐츠의 신뢰도를 판단합니다.", score: 5, maxScore: 5 });
    score += 5;
  } else if (ogTitle || ogDesc || ogImage) {
    items.push({ name: "Open Graph", status: "warning", message: "일부 OG 태그 누락", details: "og:title, og:description, og:image를 모두 설정하면 콘텐츠가 더 신뢰성 있게 보입니다.", score: 2, maxScore: 5 });
    score += 2;
  } else {
    items.push({ name: "Open Graph", status: "fail", message: "Open Graph 태그가 없습니다", details: "OG 태그를 추가하면 소셜 공유 시 미리보기가 개선되고, AI가 콘텐츠 메타데이터를 더 잘 이해합니다.", score: 0, maxScore: 5 });
  }

  // Canonical (4점)
  const canonical = $('link[rel="canonical"]').attr("href");
  if (canonical) {
    items.push({ name: "Canonical URL", status: "pass", message: "Canonical URL 설정됨", details: "Canonical URL은 중복 콘텐츠 문제를 방지하고, AI가 원본 소스를 정확히 식별하도록 돕습니다.", score: 4, maxScore: 4 });
    score += 4;
  } else {
    items.push({ name: "Canonical URL", status: "fail", message: "Canonical URL이 없습니다", details: "중복 URL이 있는 경우 AI가 어떤 페이지를 인용해야 할지 혼란스러워 합니다. Canonical URL을 설정하세요.", score: 0, maxScore: 4 });
  }

  return { score: Math.min(score, maxScore), maxScore, items };
}

function analyzeHeadingStructure($: cheerio.CheerioAPI): CategoryResult {
  const items: CheckItem[] = [];
  let score = 0;
  const maxScore = 25;

  // H1 확인 (10점)
  const h1s = $("h1");
  if (h1s.length === 1) {
    items.push({ name: "H1 태그", status: "pass", message: "정확히 하나의 H1 태그", details: "H1은 페이지의 핵심 주제를 AI에게 알려주는 가장 중요한 신호입니다. 질문에 답하는 형태의 H1이 AI 인용에 효과적입니다.", score: 10, maxScore: 10 });
    score += 10;
  } else if (h1s.length === 0) {
    items.push({ name: "H1 태그", status: "fail", message: "H1 태그가 없습니다", details: "H1 태그가 없으면 AI가 페이지의 주제를 파악하기 어렵습니다. 페이지당 하나의 H1을 반드시 추가하세요.", score: 0, maxScore: 10 });
  } else {
    items.push({ name: "H1 태그", status: "warning", message: `${h1s.length}개의 H1 태그 (권장: 1개)`, details: "여러 H1이 있으면 AI가 페이지의 주요 주제를 혼동할 수 있습니다. 하나의 명확한 H1만 사용하세요.", score: 5, maxScore: 10 });
    score += 5;
  }

  // 헤딩 구조 분석
  const headings: string[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    headings.push(el.tagName.toLowerCase());
  });

  if (headings.length > 0) {
    // 계층 구조 검사 (10점)
    let isHierarchical = true;
    let prevLevel = 0;
    for (const h of headings) {
      const level = parseInt(h.charAt(1));
      if (level > prevLevel + 1 && prevLevel !== 0) {
        isHierarchical = false;
        break;
      }
      prevLevel = level;
    }

    if (isHierarchical) {
      items.push({ name: "헤딩 계층", status: "pass", message: "올바른 계층 구조", details: "H1→H2→H3 순서의 논리적 구조는 AI가 콘텐츠의 개요를 파악하고 섹션별로 정보를 추출하는 데 핵심적입니다.", score: 10, maxScore: 10 });
      score += 10;
    } else {
      items.push({ name: "헤딩 계층", status: "warning", message: "헤딩 레벨이 순서대로 사용되지 않음", details: "H1에서 바로 H3로 넘어가면 AI가 콘텐츠 구조를 이해하기 어렵습니다. 순차적 계층을 지키세요.", score: 5, maxScore: 10 });
      score += 5;
    }

    // 헤딩 개수 (5점)
    if (headings.length >= 3) {
      items.push({ name: "헤딩 사용", status: "pass", message: `${headings.length}개의 헤딩 태그 사용`, details: "충분한 헤딩은 AI가 콘텐츠를 스캔하고 관련 섹션을 빠르게 찾는 데 도움을 줍니다.", score: 5, maxScore: 5 });
      score += 5;
    } else {
      items.push({ name: "헤딩 사용", status: "warning", message: "더 많은 헤딩 태그 사용 권장", details: "헤딩이 적으면 긴 텍스트 블록이 되어 AI가 정보를 추출하기 어렵습니다. 논리적 섹션마다 헤딩을 추가하세요.", score: 2, maxScore: 5 });
      score += 2;
    }
  } else {
    items.push({ name: "헤딩 계층", status: "fail", message: "헤딩 태그가 없습니다", details: "헤딩 없이는 AI가 페이지 구조를 전혀 파악할 수 없습니다. H1, H2, H3를 사용하여 콘텐츠를 구조화하세요.", score: 0, maxScore: 10 });
    items.push({ name: "헤딩 사용", status: "fail", message: "헤딩 태그가 없습니다", details: "콘텐츠를 섹션별로 나누고 각 섹션에 헤딩을 추가하세요.", score: 0, maxScore: 5 });
  }

  return { score: Math.min(score, maxScore), maxScore, items };
}

function analyzeFAQ($: cheerio.CheerioAPI): CategoryResult {
  const items: CheckItem[] = [];
  let score = 0;
  const maxScore = 25;

  // FAQ Schema 확인 (15점)
  const faqSchema = $('script[type="application/ld+json"]')
    .toArray()
    .some((el) => {
      try {
        const content = $(el).html();
        if (content) {
          const data = JSON.parse(content);
          return data["@type"] === "FAQPage" ||
            (Array.isArray(data["@graph"]) &&
              data["@graph"].some((item: { "@type": string }) => item["@type"] === "FAQPage"));
        }
      } catch {
        return false;
      }
      return false;
    });

  if (faqSchema) {
    items.push({ name: "FAQ Schema", status: "pass", message: "FAQPage 스키마 발견", details: "FAQPage 스키마는 AI가 Q&A 형식을 직접 인식하게 해줍니다. Google의 Featured Snippet과 ChatGPT 답변에서 직접 인용될 확률이 매우 높아집니다.", score: 15, maxScore: 15 });
    score += 15;
  } else {
    items.push({ name: "FAQ Schema", status: "fail", message: "FAQPage 스키마 없음", details: "FAQ 콘텐츠가 있다면 FAQPage 스키마를 추가하세요. 사용자 질문에 대한 직접적인 답변 형태로 AI 검색 결과에 노출될 수 있습니다.", score: 0, maxScore: 15 });
  }

  // FAQ 섹션 패턴 찾기 (10점)
  const faqPatterns = ["faq", "자주 묻는 질문", "frequently asked", "q&a", "질문과 답변"];

  let hasFAQSection = false;
  $("h2, h3, section, div").each((_, el) => {
    const text = $(el).text().toLowerCase();
    if (faqPatterns.some((p) => text.includes(p))) {
      hasFAQSection = true;
      return false;
    }
  });

  if (hasFAQSection) {
    items.push({ name: "FAQ 섹션", status: "pass", message: "FAQ 관련 섹션 발견", details: "Q&A 형식의 콘텐츠는 AI가 가장 선호하는 답변 소스입니다. 질문 형태의 헤딩과 간결한 답변 구조가 이상적입니다.", score: 10, maxScore: 10 });
    score += 10;
  } else {
    items.push({ name: "FAQ 섹션", status: "fail", message: "FAQ 섹션 없음", details: "사용자들이 자주 묻는 질문을 FAQ 섹션으로 추가하면 AI가 답변을 찾을 때 해당 콘텐츠를 우선 참조합니다.", score: 0, maxScore: 10 });
  }

  return { score: Math.min(score, maxScore), maxScore, items };
}

function analyzeEEAT($: cheerio.CheerioAPI): CategoryResult {
  const items: CheckItem[] = [];
  let score = 0;
  const maxScore = 20;

  // 저자 정보
  const authorSchema = $('script[type="application/ld+json"]')
    .toArray()
    .some((el) => {
      try {
        const content = $(el).html();
        if (content) {
          const data = JSON.parse(content);
          return data.author || data["@graph"]?.some((item: { author?: unknown }) => item.author);
        }
      } catch {
        return false;
      }
      return false;
    });

  if (authorSchema) {
    items.push({
      name: "저자 정보",
      status: "pass",
      message: "저자 스키마 발견",
      score: 5,
      maxScore: 5,
    });
    score += 5;
  } else {
    items.push({
      name: "저자 정보",
      status: "fail",
      message: "저자 스키마 없음",
      score: 0,
      maxScore: 5,
    });
  }

  // About 페이지 링크
  const hasAbout = $('a[href*="about"], a[href*="회사소개"]').length > 0;
  if (hasAbout) {
    items.push({
      name: "About 페이지",
      status: "pass",
      message: "About 페이지 링크 발견",
      score: 5,
      maxScore: 5,
    });
    score += 5;
  } else {
    items.push({
      name: "About 페이지",
      status: "fail",
      message: "About 페이지 링크 없음",
      score: 0,
      maxScore: 5,
    });
  }

  // 연락처 정보
  const hasContact = $('a[href*="contact"], a[href^="tel:"], a[href^="mailto:"]').length > 0;
  if (hasContact) {
    items.push({
      name: "연락처",
      status: "pass",
      message: "연락처 정보 발견",
      score: 5,
      maxScore: 5,
    });
    score += 5;
  } else {
    items.push({
      name: "연락처",
      status: "fail",
      message: "연락처 정보 없음",
      score: 0,
      maxScore: 5,
    });
  }

  // 날짜 정보
  const hasDate = $("time, [datetime], .date, .published").length > 0;
  if (hasDate) {
    items.push({
      name: "날짜 정보",
      status: "pass",
      message: "게시/수정 날짜 발견",
      score: 5,
      maxScore: 5,
    });
    score += 5;
  } else {
    items.push({
      name: "날짜 정보",
      status: "fail",
      message: "날짜 정보 없음",
      score: 0,
      maxScore: 5,
    });
  }

  return { score: Math.min(score, maxScore), maxScore, items };
}

function analyzeContentQuality($: cheerio.CheerioAPI): CategoryResult {
  const items: CheckItem[] = [];
  let score = 0;
  const maxScore = 20;

  // 본문 텍스트 추출
  const bodyText = $("article, main, .content, .post")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();

  const wordCount = countWords(bodyText);

  if (wordCount >= 1000) {
    items.push({
      name: "콘텐츠 길이",
      status: "pass",
      message: `충분한 콘텐츠 (약 ${wordCount}단어)`,
      score: 10,
      maxScore: 10,
    });
    score += 10;
  } else if (wordCount >= 300) {
    items.push({
      name: "콘텐츠 길이",
      status: "warning",
      message: `콘텐츠 보강 권장 (약 ${wordCount}단어)`,
      score: 5,
      maxScore: 10,
    });
    score += 5;
  } else {
    items.push({
      name: "콘텐츠 길이",
      status: "fail",
      message: "콘텐츠가 너무 짧습니다",
      score: 0,
      maxScore: 10,
    });
  }

  // 이미지 alt 태그
  const images = $("img");
  const imagesWithAlt = $("img[alt]").filter((_, el) => $(el).attr("alt")?.trim() !== "");

  if (images.length > 0) {
    const altRatio = imagesWithAlt.length / images.length;
    if (altRatio >= 0.9) {
      items.push({
        name: "이미지 Alt",
        status: "pass",
        message: `${imagesWithAlt.length}/${images.length} 이미지에 Alt 속성`,
        score: 5,
        maxScore: 5,
      });
      score += 5;
    } else if (altRatio >= 0.5) {
      items.push({
        name: "이미지 Alt",
        status: "warning",
        message: `${imagesWithAlt.length}/${images.length} 이미지에 Alt 속성`,
        score: 2,
        maxScore: 5,
      });
      score += 2;
    } else {
      items.push({
        name: "이미지 Alt",
        status: "fail",
        message: "대부분의 이미지에 Alt 속성 누락",
        score: 0,
        maxScore: 5,
      });
    }
  } else {
    items.push({
      name: "이미지 Alt",
      status: "skip",
      message: "이미지 없음",
      score: 0,
      maxScore: 5,
    });
  }

  // 내부 링크
  const internalLinks = $('a[href^="/"], a[href^="./"]').length;
  if (internalLinks >= 3) {
    items.push({
      name: "내부 링크",
      status: "pass",
      message: `${internalLinks}개의 내부 링크`,
      score: 5,
      maxScore: 5,
    });
    score += 5;
  } else {
    items.push({
      name: "내부 링크",
      status: "warning",
      message: "더 많은 내부 링크 권장",
      score: 0,
      maxScore: 5,
    });
  }

  return { score: Math.min(score, maxScore), maxScore, items };
}

// CJK(한·중·일) 텍스트는 띄어쓰기로 단어를 구분하지 않으므로, 공백 분할만으로는
// 분량을 심하게 과소 집계한다. CJK 문자는 글자 단위로 세고, 그 외 언어는 공백으로 분할한다.
function countWords(text: string): number {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return 0;

  const cjkRegex =
    /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/g;
  const cjkCount = (trimmed.match(cjkRegex) || []).length;

  const nonCjk = trimmed.replace(cjkRegex, " ").trim();
  const nonCjkWords = nonCjk ? nonCjk.split(/\s+/).filter(Boolean).length : 0;

  return cjkCount + nonCjkWords;
}

function generateImprovements(
  categories: Record<string, CategoryResult | undefined>
): Improvement[] {
  const improvements: Improvement[] = [];

  // 구조화 데이터
  if (categories.structuredData && categories.structuredData.score < 15) {
    improvements.push({
      priority: "high",
      category: "구조화 데이터",
      title: "JSON-LD 스키마 추가하기",
      description:
        "JSON-LD는 AI가 읽을 수 있는 '명함' 같은 것입니다. 웹사이트 정보를 AI가 이해하기 쉬운 형태로 제공합니다.\n\n💡 예시: 아래 코드를 <head> 태그 안에 추가하세요:\n<script type=\"application/ld+json\">\n{\"@context\": \"https://schema.org\", \"@type\": \"Organization\", \"name\": \"회사명\", \"url\": \"https://example.com\"}\n</script>",
    });
  }

  // 메타 태그
  if (categories.metaTags) {
    const failedItems = categories.metaTags.items.filter((i) => i.status === "fail");
    for (const item of failedItems) {
      let description = item.message;
      if (item.name === "Title 태그") {
        description = "Title 태그는 브라우저 탭과 검색 결과에 표시되는 페이지 제목입니다.\n\n💡 예시: <title>맛있는 김치찌개 레시피 - 10분 완성 | 요리블로그</title>\n\n핵심 키워드를 앞쪽에 배치하고, 30-60자 사이로 작성하세요.";
      } else if (item.name === "Meta Description") {
        description = "Meta Description은 검색 결과에서 제목 아래 표시되는 설명문입니다.\n\n💡 예시: <meta name=\"description\" content=\"집에서 10분만에 만드는 정통 김치찌개 레시피. 돼지고기와 묵은지로 깊은 맛을 내는 비법을 알려드립니다.\">\n\n120-160자로 페이지 내용을 요약하세요.";
      } else if (item.name === "Canonical URL") {
        description = "Canonical URL은 '이 페이지의 원본 주소는 여기입니다'라고 알려주는 태그입니다.\n\n💡 예시: <link rel=\"canonical\" href=\"https://example.com/blog/post-1\">\n\n같은 내용이 여러 URL로 접근 가능할 때 원본을 지정하세요.";
      }
      improvements.push({
        priority: "high",
        category: "메타 태그",
        title: `${item.name} 추가하기`,
        description,
      });
    }
  }

  // FAQ
  if (categories.faq && categories.faq.score < 15) {
    improvements.push({
      priority: "medium",
      category: "FAQ",
      title: "FAQ 섹션 추가하기",
      description:
        "FAQ는 '자주 묻는 질문' 섹션입니다. AI는 질문-답변 형식의 콘텐츠를 매우 선호합니다.\n\n💡 예시:\n<h2>자주 묻는 질문</h2>\n<h3>배송은 얼마나 걸리나요?</h3>\n<p>주문 후 2-3일 내 배송됩니다.</p>\n\n실제 고객들이 자주 묻는 질문을 정리해서 추가하세요.",
    });
  }

  // 헤딩 구조
  if (categories.headingStructure && categories.headingStructure.score < 15) {
    improvements.push({
      priority: "medium",
      category: "헤딩 구조",
      title: "헤딩 태그 구조 개선하기",
      description:
        "헤딩(H1, H2, H3...)은 콘텐츠의 '목차' 역할을 합니다. AI는 이를 통해 내용을 파악합니다.\n\n💡 올바른 예시:\n<h1>김치찌개 만들기</h1>\n  <h2>재료 준비</h2>\n  <h2>조리 순서</h2>\n    <h3>1단계: 재료 손질</h3>\n    <h3>2단계: 끓이기</h3>\n\nH1은 페이지당 1개, H1→H2→H3 순서를 지키세요.",
    });
  }

  // E-E-A-T
  if (categories.eeat && categories.eeat.score < 10) {
    improvements.push({
      priority: "medium",
      category: "E-E-A-T",
      title: "신뢰성 정보 추가하기",
      description: "E-E-A-T는 전문성, 경험, 권위성, 신뢰성을 뜻합니다. AI는 신뢰할 수 있는 출처를 선호합니다.\n\n💡 추가하면 좋은 것들:\n• 글쓴이 이름과 약력\n• 회사 소개 페이지 링크\n• 연락처 (이메일, 전화번호)\n• 글 작성일/수정일\n\n'이 글을 쓴 사람이 누구인지' 명확히 보여주세요.",
    });
  }

  return improvements.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

function calculateTotalScore(categories: Record<string, CategoryResult>): number {
  const scores = Object.values(categories);
  const totalScore = scores.reduce((sum, cat) => sum + cat.score, 0);
  const totalMax = scores.reduce((sum, cat) => sum + cat.maxScore, 0);
  return Math.round((totalScore / totalMax) * 100);
}
