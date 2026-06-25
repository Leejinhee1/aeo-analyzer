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
}
