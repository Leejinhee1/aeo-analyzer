"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Clock, ExternalLink, Loader2, Crown } from "lucide-react";
import type { User } from "@supabase/supabase-js";

// 임시 분석 히스토리 데이터 (나중에 DB에서 가져옴)
const mockHistory = [
  { id: 1, url: "https://example.com", score: 72, date: "2026-03-18" },
  { id: 2, url: "https://test.com/blog", score: 85, date: "2026-03-17" },
];

interface UsageStatus {
  isPro: boolean;
  limit: number;
  used: number;
  remaining: number;
  unlimited: boolean;
}

export default function DashboardPage() {
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // 사용량/플랜 (DB 기반, /api/usage에서 조회)
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const isPro = usage?.unlimited ?? false;
  const outOfQuota = usage ? !usage.unlimited && usage.remaining <= 0 : false;

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);

      // 남은 횟수·플랜 조회
      try {
        const res = await fetch("/api/usage");
        if (res.ok) setUsage(await res.json());
      } catch {
        // 조회 실패 시 사용량 표시는 비워둔다 (분석 자체는 서버가 다시 막아준다)
      }

      setLoading(false);
    };
    init();
  }, [supabase, router]);

  const handleAnalyze = () => {
    if (!url.trim()) return;

    // URL 유효성 검사
    try {
      new URL(url);
    } catch {
      alert("올바른 URL을 입력해주세요.");
      return;
    }

    // 사용량 체크 (서버가 최종 권위지만, UX상 먼저 막는다)
    if (outOfQuota) {
      alert("오늘 무료 분석 횟수(3회)를 모두 사용했습니다. 내일 다시 시도하거나 Pro로 업그레이드하세요.");
      return;
    }

    setIsAnalyzing(true);
    // 실제 분석은 결과 페이지가 /api/analyze를 호출해 수행한다.
    router.push(`/result?url=${encodeURIComponent(url)}`);
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
              <p className="text-sm text-gray-500">오늘 남은 분석</p>
              <p className="font-semibold">
                {isPro
                  ? "무제한"
                  : usage
                    ? `${usage.remaining}/${usage.limit}회`
                    : "—"}
              </p>
            </div>
            {!isPro && (
              <Button variant="outline" className="gap-2">
                <Crown className="h-4 w-4" />
                Pro 업그레이드
              </Button>
            )}
          </div>
        </div>

        {/* URL 입력 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>새 분석 시작</CardTitle>
            <CardDescription>
              분석할 웹페이지 URL을 입력하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="h-12"
                disabled={outOfQuota}
                onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              />
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !url.trim() || outOfQuota}
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
            {outOfQuota && (
              <p className="text-sm text-red-600 mt-3">
                오늘 무료 분석 횟수(3회)를 모두 사용했습니다. 내일 다시 시도하거나 Pro로 업그레이드하세요.
              </p>
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
            {mockHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                아직 분석한 URL이 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {mockHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
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
                          {item.date}
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
