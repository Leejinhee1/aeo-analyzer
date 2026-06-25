import type { SupabaseClient } from "@supabase/supabase-js";

// 무료 플랜 일일 분석 한도. 사용량 제한과 대시보드 표시가 공유하는 단일 출처.
export const DAILY_LIMIT = 3;

export interface UsageStatus {
  /** 로그인 여부 */
  authenticated: boolean;
  /** 서버(profiles.plan)가 판정한 Pro 여부 */
  isPro: boolean;
  /** 무료 플랜 일일 한도 */
  limit: number;
  /** 오늘 사용한 분석 횟수 (무제한이면 의미 없음) */
  used: number;
  /** 오늘 남은 횟수 (0 미만으로 내려가지 않음) */
  remaining: number;
  /** Pro 등 무제한 여부 */
  unlimited: boolean;
}

/**
 * 현재 로그인 사용자의 사용량/플랜 상태를 계산한다.
 * 플랜 판정의 권위는 서버(profiles.plan)이며, 대시보드 표시는 이 값을 그대로 신뢰한다.
 */
export async function getUsageStatus(
  supabase: SupabaseClient
): Promise<UsageStatus> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      authenticated: false,
      isPro: false,
      limit: DAILY_LIMIT,
      used: 0,
      remaining: DAILY_LIMIT,
      unlimited: false,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();
  const isPro = profile?.plan === "pro";

  if (isPro) {
    return {
      authenticated: true,
      isPro: true,
      limit: DAILY_LIMIT,
      used: 0,
      remaining: DAILY_LIMIT,
      unlimited: true,
    };
  }

  const { data } = await supabase.rpc("get_daily_usage_by_user", {
    p_user_id: user.id,
  });
  const used = data ?? 0;

  return {
    authenticated: true,
    isPro: false,
    limit: DAILY_LIMIT,
    used,
    remaining: Math.max(0, DAILY_LIMIT - used),
    unlimited: false,
  };
}
