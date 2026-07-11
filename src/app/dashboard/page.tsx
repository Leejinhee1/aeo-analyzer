"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Clock, ExternalLink, Loader2, Crown, CheckCircle2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { DAILY_LIMIT, type AnalysisHistoryItem, type UsageStatus } from "@/lib/dashboard-data";
import { startCheckout } from "@/lib/checkout";

/** success=true 쿼리파라미터가 있으면 결제 완료 안내 배너를 보여준다. */
function SuccessBanner() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "true";

  if (!success) return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 p-4 text-sm text-green-800 dark:text-green-300">
      <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
      <p>
        결제가 완료되었습니다! Pro 활성화까지 잠시 걸릴 수 있습니다. 화면에 아직 무료
        플랜으로 보여도 잠시 후 새로고침하면 반영됩니다.
      </p>
    </div>
  );
}

function DashboardContent() {
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // 사용량/플랜 (실 데이터, 마운트 시 /api/usage로 조회)
  const [usage, setUsage] = useState<UsageStatus | null>(null);

  // 분석 히스토리 (실 데이터, 마운트 시 /api/analyses로 조회)
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);
      setLoading(false);
    };
    getUser();
  }, [supabase, router]);

  useEffect(() => {
    if (!user) return;

    // 대시보드에 진입(재진입 포함)할 때마다 최신 사용량을 조회한다.
    // /result에서 분석을 마치고 돌아오는 경우에도 이 마운트 시점 조회로 최신 값이 반영된다.
    const fetchUsage = async () => {
      try {
        const res = await fetch("/api/usage");
        if (!res.ok) return;
        const data: UsageStatus = await res.json();
        setUsage(data);
      } catch {
        // 사용량 조회 실패는 화면 전체를 막지 않는다 (표시만 못 함)
      }
    };
    fetchUsage();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const fetchHistory = async () => {
      try {
        const res = await fetch("/api/analyses");
        if (!res.ok) return;
        const data: AnalysisHistoryItem[] = await res.json();
        setHistory(data);
      } catch {
        // 히스토리 조회 실패는 화면 전체를 막지 않는다 (표시만 못 함)
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchHistory();
  }, [user]);

  const isPro = usage?.plan === "pro";
  const remaining = usage?.remaining ?? null;
  const isLimitReached = !isPro && remaining !== null && remaining <= 0;

  const handleAnalyze = () => {
    if (!url.trim()) return;

    // URL 유효성 검사
    try {
      new URL(url);
    } catch {
      alert("올바른 URL을 입력해주세요.");
      return;
    }

    // 사용량 체크 (서버에서 조회한 최신 값 기준)
    if (isLimitReached) {
      setAnalyzeError(
        `오늘 무료 분석 횟수(${DAILY_LIMIT}회)를 모두 사용했습니다. 내일 다시 시도하거나 Pro로 업그레이드하세요.`
      );
      return;
    }

    setAnalyzeError(null);
    setIsAnalyzing(true);

    // 실제 분석 실행: /result 페이지가 쿼리파라미터로 받은 url로 POST /api/analyze를
    // 호출해 분석하는 기존 방식을 그대로 재사용한다 (분석 로직/사용량 기록의 단일 진입점 유지).
    router.push(`/result?url=${encodeURIComponent(url)}`);
  };

  const handleUpgrade = async () => {
    if (isCheckingOut) return;

    setCheckoutError(null);
    setIsCheckingOut(true);
    const { error } = await startCheckout();
    if (error) {
      setCheckoutError(error);
      setIsCheckingOut(false);
    }
    // 성공 시 window.location.href로 이동하므로 별도 상태 정리가 필요 없다.
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Suspense fallback={null}>
          <SuccessBanner />
        </Suspense>

        {/* 사용량 & 플랜 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">대시보드</h1>
            <p className="text-gray-600 dark:text-gray-400">
              {user?.email}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">오늘 남은 분석 횟수</p>
              <p className="font-semibold">
                {usage === null
                  ? "조회 중..."
                  : isPro
                    ? "무제한"
                    : `${usage.remaining}/${DAILY_LIMIT}회`}
              </p>
            </div>
            {!isPro && (
              <div className="text-right">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleUpgrade}
                  disabled={isCheckingOut}
                >
                  {isCheckingOut ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Crown className="h-4 w-4" />
                  )}
                  Pro 업그레이드
                </Button>
                {checkoutError && (
                  <p className="text-xs text-red-600 mt-1 max-w-[200px]">
                    {checkoutError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* URL 입력 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>새 분석 시작</CardTitle>
            <CardDescription>
              {isLimitReached
                ? `오늘 무료 분석 횟수(${DAILY_LIMIT}회)를 모두 사용했습니다. 내일 다시 시도하거나 Pro로 업그레이드하세요.`
                : "분석할 웹페이지 URL을 입력하세요"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="h-12"
                disabled={isLimitReached}
                onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              />
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !url.trim() || isLimitReached}
                className="h-12 px-6"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    분석 중...
                  </>
                ) : (
                  <>
                    분석하기
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
            {analyzeError && (
              <p className="text-sm text-red-600 mt-3">{analyzeError}</p>
            )}
          </CardContent>
        </Card>

        {/* 분석 히스토리 */}
        <Card>
          <CardHeader>
            <CardTitle>분석 히스토리</CardTitle>
            <CardDescription>
              이전에 분석한 URL 목록
            </CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <p className="text-gray-500 text-center py-8">불러오는 중...</p>
            ) : history.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                아직 분석한 URL이 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => router.push(`/result?id=${item.id}`)}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <Badge
                        variant={item.score >= 80 ? "default" : item.score >= 60 ? "secondary" : "destructive"}
                        className="w-12 justify-center"
                      >
                        {item.score}
                      </Badge>
                      <div>
                        <p className="font-medium truncate max-w-md">
                          {item.url}
                        </p>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(item.created_at).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
