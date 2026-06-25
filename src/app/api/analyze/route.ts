import { NextRequest, NextResponse } from "next/server";
import { analyzeURL } from "@/lib/aeo/analyzer";
import { createClient } from "@/lib/supabase/server";

const DAILY_LIMIT = 3;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, isPro = false, deviceId } = body;

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // URL 유효성 검사
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // 사용량 제한 (Free 플랜만, Supabase 연결된 경우)
    const supabase = await createClient();

    if (supabase && !isPro) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let usageCount = 0;

      if (user) {
        // 로그인: user_id로 체크
        const { data } = await supabase.rpc("get_daily_usage_by_user", {
          p_user_id: user.id,
        });
        usageCount = data ?? 0;
      } else if (deviceId) {
        // 비로그인: device_id로 체크
        const { data } = await supabase.rpc("get_daily_usage_by_device", {
          p_device_id: deviceId,
        });
        usageCount = data ?? 0;
      }

      if (usageCount >= DAILY_LIMIT) {
        return NextResponse.json(
          {
            error: `오늘 무료 분석 횟수(${DAILY_LIMIT}회)를 모두 사용했습니다. 내일 다시 시도하거나 Pro로 업그레이드하세요.`,
          },
          { status: 429 }
        );
      }

      // AEO 분석 실행
      const result = await analyzeURL(url, { isPro });

      // 사용량 기록
      await supabase.from("usage_logs").insert({
        user_id: user?.id ?? null,
        device_id: deviceId ?? null,
        url_analyzed: url,
      });

      return NextResponse.json(result);
    }

    // Supabase 미연결 또는 Pro: 제한 없이 분석
    const result = await analyzeURL(url, { isPro });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Analysis error:", error);

    const message = error instanceof Error ? error.message : "Analysis failed";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
