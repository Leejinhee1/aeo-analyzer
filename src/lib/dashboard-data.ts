import type { createClient } from "@/lib/supabase/server";

// createClient()가 반환하는 Supabase 서버 클라이언트 타입 (null 아님을 호출부에서 보장)
type SupabaseClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

// 무료 플랜 일일 분석 제한
// 주의: src/app/api/analyze/route.ts의 DAILY_LIMIT과 값이 중복된다. 지금은 의도적으로 그대로 둔다.
export const DAILY_LIMIT = 3;

export interface UsageStatus {
  plan: "free" | "pro";
  used: number;
  remaining: number | null; // pro는 무제한이므로 null
}

/**
 * 로그인 사용자의 오늘 사용량/플랜 상태를 조회한다.
 * - profiles.plan을 조회해 pro 여부를 판정한다. 행이 없으면 free로 취급한다.
 * - free면 get_daily_usage_by_user RPC로 오늘 사용량을 가져와 잔여 횟수를 계산한다.
 * - pro면 RPC를 호출하지 않고 무제한(remaining: null)으로 반환한다.
 */
export async function getUsageStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<UsageStatus> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .single();

  const plan: "free" | "pro" = profile?.plan === "pro" ? "pro" : "free";

  if (plan === "pro") {
    return { plan, used: 0, remaining: null };
  }

  const { data } = await supabase.rpc("get_daily_usage_by_user", {
    p_user_id: userId,
  });
  const used = data ?? 0;

  return { plan, used, remaining: Math.max(0, DAILY_LIMIT - used) };
}
