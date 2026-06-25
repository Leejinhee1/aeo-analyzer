import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsageStatus, DAILY_LIMIT } from "@/lib/usage";

// 대시보드가 현재 사용자의 남은 횟수·플랜을 조회하는 엔드포인트.
export async function GET() {
  const supabase = await createClient();

  // Supabase 미연결(로컬/dev): 비로그인·무료 기본값
  if (!supabase) {
    return NextResponse.json({
      authenticated: false,
      isPro: false,
      limit: DAILY_LIMIT,
      used: 0,
      remaining: DAILY_LIMIT,
      unlimited: false,
    });
  }

  const status = await getUsageStatus(supabase);
  return NextResponse.json(status);
}
