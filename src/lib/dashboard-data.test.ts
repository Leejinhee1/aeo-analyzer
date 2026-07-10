import { describe, expect, it, vi } from "vitest";
import { DAILY_LIMIT, getAnalysisHistory, getUsageStatus } from "./dashboard-data";

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

/** getAnalysisHistory 전용 가짜 Supabase 클라이언트: from("analyses").select().eq().order().limit() 체인. */
function makeHistorySupabase(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue({ data: rows });
  const order = vi.fn(() => ({ limit }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return { from, select, eq, order, limit };
}

describe("getAnalysisHistory", () => {
  it("analyses 테이블에서 본인 것만 최신순·limit개로 조회한다", async () => {
    const rows = [
      { id: "a1", url: "https://a.com", score: 90, created_at: "2026-07-10T00:00:00Z" },
    ];
    const supabase = makeHistorySupabase(rows);

    const result = await getAnalysisHistory(supabase as never, "user-1");

    expect(supabase.from).toHaveBeenCalledWith("analyses");
    expect(supabase.select).toHaveBeenCalledWith("id, url, score, created_at");
    expect(supabase.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(supabase.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(supabase.limit).toHaveBeenCalledWith(10);
    expect(result).toEqual(rows);
  });

  it("limit 인자를 그대로 쿼리에 전달한다", async () => {
    const supabase = makeHistorySupabase([]);

    await getAnalysisHistory(supabase as never, "user-1", 3);

    expect(supabase.limit).toHaveBeenCalledWith(3);
  });

  it("데이터가 없으면 빈 배열을 반환한다", async () => {
    const limit = vi.fn().mockResolvedValue({ data: null });
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const supabase = { from, select, eq, order, limit };

    const result = await getAnalysisHistory(supabase as never, "user-1");

    expect(result).toEqual([]);
  });
});
