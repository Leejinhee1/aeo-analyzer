import type { PredictedQueries, AIQueryGenerator } from "./queries";

export interface AEOAnalysisResult {
  url: string;
  score: number;
  timestamp: string;
  categories: {
    structuredData: CategoryResult;
    metaTags: CategoryResult;
    headingStructure: CategoryResult;
    faq: CategoryResult;
    // Pro 전용
    eeat?: CategoryResult;
    pageSpeed?: CategoryResult;
    contentQuality?: CategoryResult;
  };
  improvements: Improvement[];
  /** AI 노출 테스트용 예상 사용자 질문 (Free: 휴리스틱, Pro: 휴리스틱 + AI) */
  predictedQueries: PredictedQueries;
}

export interface CategoryResult {
  score: number;
  maxScore: number;
  items: CheckItem[];
}

export interface CheckItem {
  name: string;
  status: "pass" | "fail" | "warning" | "skip";
  message: string;
  details?: string;
  score: number;      // 획득 점수
  maxScore: number;   // 최대 점수
}

export interface Improvement {
  priority: "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
}

export interface AnalysisOptions {
  isPro: boolean;
  includeAITest?: boolean;
  /** Pro 분석 시 AI 예상 질문 생성기(주입). 비로그인/Free면 무시된다. */
  aiQueryGenerator?: AIQueryGenerator;
}
