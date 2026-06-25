import { NextRequest, NextResponse } from "next/server";
import { analyzeURL } from "@/lib/aeo/analyzer";
import { createClient } from "@/lib/supabase/server";
import { DAILY_LIMIT } from "@/lib/usage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // 주의: 클라이언트가 보낸 isPro는 신뢰하지 않는다. 플랜 판정의 권위는 서버(profiles)다.
    const { url, deviceId } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // URL 유효성 검사
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    const supabase = await createClient();

    // Supabase 미연결(로컬/dev): 제한 없이 무료 분석
    if (!supabase) {
      const result = await analyzeURL(url, { isPro: false });
      return NextResponse.json(result);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 서버측 플랜 판정: 로그인 사용자만 profiles.plan으로 Pro 여부를 결정.
    // 비로그인은 항상 무료.
    let isPro = false;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single();
      isPro = profile?.plan === "pro";
    }

    // Pro: 일 제한 없이 분석
    if (isPro) {
      const result = await analyzeURL(url, { isPro: true });
      return NextResponse.json(result);
    }

    // Free: 일 3회 제한 (로그인=user_id, 비로그인=deviceId)
    let usageCount = 0;
    if (user) {
      const { data } = await supabase.rpc("get_daily_usage_by_user", {
        p_user_id: user.id,
      });
      usageCount = data ?? 0;
    } else if (deviceId) {
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

    // 무료 분석 실행 (서버가 판정한 isPro=false를 전달)
    const result = await analyzeURL(url, { isPro: false });

    // 사용량 기록
    await supabase.from("usage_logs").insert({
      user_id: user?.id ?? null,
      device_id: deviceId ?? null,
      url_analyzed: url,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Analysis error:", error);

    const message = error instanceof Error ? error.message : "Analysis failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
