"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Download,
  Loader2,
  ExternalLink,
} from "lucide-react";
import type { AEOAnalysisResult, CheckItem } from "@/lib/aeo/types";
import { getDeviceId } from "@/lib/device";

function ResultContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url");
  const id = searchParams.get("id");

  const [result, setResult] = useState<AEOAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // id 모드: 저장된 분석 결과를 조회만 한다. 재분석(POST /api/analyze)은 호출하지 않는다
    // (조회할 때마다 무료 사용량이 차감되는 버그를 방지하기 위함).
    if (id) {
      const fetchSaved = async () => {
        try {
          const response = await fetch(`/api/analyses/${id}`);

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || "분석 결과를 찾을 수 없습니다");
          }

          const data = await response.json();
          setResult(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : "조회 중 오류 발생");
        } finally {
          setLoading(false);
        }
      };

      fetchSaved();
      return;
    }

    if (!url) {
      setError("URL이 제공되지 않았습니다");
      setLoading(false);
      return;
    }

    const analyze = async () => {
      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, isPro: false, deviceId: getDeviceId() }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "분석 실패");
        }

        const data = await response.json();
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "분석 중 오류 발생");
      } finally {
        setLoading(false);
      }
    };

    analyze();
  }, [url, id]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-lg font-medium">{id ? "불러오는 중..." : "분석 중..."}</p>
          {url && <p className="text-gray-500 mt-2">{url}</p>}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600">분석 실패</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                홈으로 돌아가기
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!result) return null;

  const scoreColor =
    result.score >= 80
      ? "text-green-600"
      : result.score >= 60
        ? "text-yellow-600"
        : "text-red-600";

  const scoreBgColor =
    result.score >= 80
      ? "bg-green-50 border-green-200"
      : result.score >= 60
        ? "bg-yellow-50 border-yellow-200"
        : "bg-red-50 border-red-200";

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              홈으로
            </Button>
          </Link>
          <Button variant="outline" disabled>
            <Download className="mr-2 h-4 w-4" />
            PDF 내보내기 (Pro)
          </Button>
        </div>

        {/* 전체 점수 */}
        <Card className={`mb-8 ${scoreBgColor}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">분석 URL</p>
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium flex items-center gap-1 hover:underline"
                >
                  {result.url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 mb-1">AEO 점수</p>
                <p className={`text-5xl font-bold ${scoreColor}`}>
                  {result.score}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 카테고리별 점수 */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <CategoryCard
            title="구조화 데이터"
            category={result.categories.structuredData}
          />
          <CategoryCard
            title="메타 태그"
            category={result.categories.metaTags}
          />
          <CategoryCard
            title="헤딩 구조"
            category={result.categories.headingStructure}
          />
          <CategoryCard title="FAQ" category={result.categories.faq} />
        </div>

        {/* 개선 포인트 */}
        <Card>
          <CardHeader>
            <CardTitle>개선 포인트</CardTitle>
            <CardDescription>
              AEO 점수를 높이기 위한 권장 사항 (코드 예시 포함)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result.improvements.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                훌륭합니다! 현재 주요 개선 사항이 없습니다.
              </p>
            ) : (
              <div className="space-y-6">
                {result.improvements.map((improvement, index) => (
                  <div key={index} className="border-l-4 pl-4 py-2" style={{
                    borderLeftColor: improvement.priority === "high" ? "#ef4444" : improvement.priority === "medium" ? "#f59e0b" : "#6b7280"
                  }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant={
                          improvement.priority === "high"
                            ? "destructive"
                            : improvement.priority === "medium"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {improvement.priority === "high"
                          ? "중요"
                          : improvement.priority === "medium"
                            ? "권장"
                            : "선택"}
                      </Badge>
                      <span className="text-xs text-gray-500">{improvement.category}</span>
                    </div>
                    <p className="font-semibold mb-2">{improvement.title}</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {improvement.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pro 기능 안내 */}
        <Card className="border-blue-200 bg-blue-50/50 mt-6">
          <CardHeader>
            <CardTitle className="text-blue-700">Pro 버전으로 더 깊은 분석을</CardTitle>
            <CardDescription>
              월 $0.99로 다음 기능을 이용할 수 있습니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="flex gap-2">
                <span className="text-blue-600">✓</span>
                <div>
                  <p className="font-medium">AI 노출 테스트</p>
                  <p className="text-gray-600">ChatGPT, Claude, Perplexity에 직접 질문하여 내 콘텐츠가 답변에 포함되는지 테스트</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="text-blue-600">✓</span>
                <div>
                  <p className="font-medium">E-E-A-T 심화 분석</p>
                  <p className="text-gray-600">전문성, 권위성, 신뢰성 신호를 상세 분석하고 구체적인 개선 방안 제시</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="text-blue-600">✓</span>
                <div>
                  <p className="font-medium">무제한 분석</p>
                  <p className="text-gray-600">월 3회 제한 없이 원하는 만큼 페이지 분석 가능</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="text-blue-600">✓</span>
                <div>
                  <p className="font-medium">AI 맞춤 개선 제안</p>
                  <p className="text-gray-600">Claude AI가 콘텐츠를 분석하여 맞춤형 개선 방안 제안</p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <Button className="w-full" disabled>
                Pro 업그레이드 (준비 중)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function CategoryCard({
  title,
  category,
}: {
  title: string;
  category: { score: number; maxScore: number; items: CheckItem[] };
}) {
  const percentage = Math.round((category.score / category.maxScore) * 100);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant={percentage >= 70 ? "default" : "secondary"}>
            {category.score}/{category.maxScore}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Progress bar */}
        <div className="h-2 bg-gray-200 rounded-full mb-4">
          <div
            className={`h-2 rounded-full ${
              percentage >= 70
                ? "bg-green-500"
                : percentage >= 40
                  ? "bg-yellow-500"
                  : "bg-red-500"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <Separator className="my-3" />

        <div className="space-y-2">
          {category.items.map((item, index) => (
            <div key={index} className="flex items-start gap-2 text-sm">
              {item.status === "pass" && (
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              )}
              {item.status === "fail" && (
                <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              )}
              {item.status === "warning" && (
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{item.name}</span>
                  <span className={`text-xs font-mono ${
                    item.score === item.maxScore
                      ? "text-green-600"
                      : item.score > 0
                        ? "text-yellow-600"
                        : "text-gray-400"
                  }`}>
                    {item.score}/{item.maxScore}
                  </span>
                </div>
                <p className="text-gray-600">{item.message}</p>
                {item.details && (
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.details}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        </main>
      }
    >
      <ResultContent />
    </Suspense>
  );
}
