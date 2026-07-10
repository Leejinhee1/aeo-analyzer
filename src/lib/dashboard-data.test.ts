import { describe, expect, it, vi } from "vitest";
import { DAILY_LIMIT, getUsageStatus } from "./dashboard-data";

/** 설정 가능한 가짜 Supabase 클라이언트. route.test.ts의 makeSupabase 패턴을 따른다. */
function makeSupabase(opts: {
  plan?: "free" | "pro" | null;
  hasProfile?: boolean;
  usageByUser?: number;
}) {
  const single = vi.fn().mockResolvedValue({
    data: opts.hasProfile === false ? null : { plan: opts.plan ?? "free" },
  });
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn(async () => ({ data: opts.usageByUser ?? 0 }));

  return { from, select, eq, single, rpc };
}

describe("getUsageStatus", () => {
  it("free 플랜: 잔여 횟수 = DAILY_LIMIT - used", async () => {
    const supabase = makeSupabase({ plan: "free", usageByUser: 1 });

    const result = await getUsageStatus(supabase as never, "user-1");

    expect(result).toEqual({ plan: "free", used: 1, remaining: DAILY_LIMIT - 1 });
    expect(supabase.rpc).toHaveBeenCalledWith("get_daily_usage_by_user", {
      p_user_id: "user-1",
    });
  });

  it("free 플랜: used가 DAILY_LIMIT을 초과해도 remaining은 음수가 아닌 0", async () => {
    const supabase = makeSupabase({ plan: "free", usageByUser: 5 });

    const result = await getUsageStatus(supabase as never, "user-1");

    expect(result).toEqual({ plan: "free", used: 5, remaining: 0 });
  });

  it("pro 플랜: remaining은 null(무제한)이고 사용량 RPC를 호출하지 않는다", async () => {
    const supabase = makeSupabase({ plan: "pro" });

    const result = await getUsageStatus(supabase as never, "user-pro");

    expect(result).toEqual({ plan: "pro", used: 0, remaining: null });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("profiles 행이 없으면 free로 취급한다", async () => {
    const supabase = makeSupabase({ hasProfile: false, usageByUser: 2 });

    const result = await getUsageStatus(supabase as never, "user-no-profile");

    expect(result).toEqual({ plan: "free", used: 2, remaining: DAILY_LIMIT - 2 });
  });
});
