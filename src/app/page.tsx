"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search,
  Zap,
  BarChart3,
  Bot,
  CheckCircle2,
  ArrowRight
} from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");

  const handleAnalyze = () => {
    if (url.trim()) {
      router.push(`/result?url=${encodeURIComponent(url.trim())}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAnalyze();
    }
  };

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 px-4 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="secondary" className="mb-4">
            AI 검색 최적화
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            AI가 당신의 콘텐츠를
            <br />
            <span className="text-blue-600">찾을 수 있나요?</span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            URL을 입력하면 ChatGPT, Claude, Perplexity 등 AI 검색 엔진에
            얼마나 최적화되어 있는지 분석해드립니다.
          </p>

          {/* URL Input */}
          <div className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto mb-8">
            <Input
              placeholder="https://example.com"
              className="h-12 text-base"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <Button size="lg" className="h-12 px-8" onClick={handleAnalyze}>
              분석하기
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <p className="text-sm text-gray-500">
            무료로 월 3회 분석 가능 · 신용카드 불필요
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">AEO 분석 항목</h2>
            <p className="text-gray-600 dark:text-gray-400">
              AI 검색 엔진이 콘텐츠를 이해하고 인용하는 데 필요한 요소를 점검합니다
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <Search className="h-10 w-10 text-blue-600 mb-2" />
                <CardTitle className="text-lg">구조화된 데이터</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Schema.org JSON-LD 마크업으로 AI가 콘텐츠를 정확히 이해할 수 있는지 확인
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Zap className="h-10 w-10 text-yellow-600 mb-2" />
                <CardTitle className="text-lg">메타 & 헤딩</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  제목, 설명, H1-H6 구조가 명확하고 일관성 있는지 분석
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-green-600 mb-2" />
                <CardTitle className="text-lg">E-E-A-T 신호</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  전문성, 경험, 권위성, 신뢰성을 나타내는 요소 점검
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Bot className="h-10 w-10 text-purple-600 mb-2" />
                <CardTitle className="text-lg">AI 노출 테스트</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  실제 AI 모델에게 질문하여 콘텐츠가 노출되는지 테스트
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">요금제</h2>
            <p className="text-gray-600 dark:text-gray-400">
              무료로 시작하고, 필요하면 업그레이드하세요
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Free Plan */}
            <Card>
              <CardHeader>
                <CardTitle>Free</CardTitle>
                <CardDescription>기본 AEO 분석</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$0</span>
                  <span className="text-gray-500">/월</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span>월 3회 분석</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span>Schema.org 마크업 체크</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span>메타 태그 분석</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span>헤딩 구조 분석</span>
                  </li>
                </ul>
                <Button variant="outline" className="w-full mt-6" onClick={() => router.push("/login")}>
                  무료로 시작
                </Button>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="border-blue-600 border-2 relative">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                추천
              </Badge>
              <CardHeader>
                <CardTitle>Pro</CardTitle>
                <CardDescription>심화 분석 + AI 노출 테스트</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$0.99</span>
                  <span className="text-gray-500">/월</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span>무제한 분석</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span>Free 플랜의 모든 기능</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span>E-E-A-T 신호 분석</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span>페이지 속도 점수</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span>AI 노출 테스트 (월 50회)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span>일별 개선 현황 대시보드</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span>AI 개선 제안</span>
                  </li>
                </ul>
                <Button className="w-full mt-6" onClick={() => router.push("/login")}>
                  Pro 업그레이드
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t">
        <div className="max-w-4xl mx-auto text-center text-gray-500 text-sm">
          <p>© 2026 AEO Analyzer. AI 검색 최적화의 시작.</p>
        </div>
      </footer>
    </main>
  );
}
