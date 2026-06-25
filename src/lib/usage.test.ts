import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUsageStatus, DAILY_LIMIT } from "./usage";

/** 설정 가능한 가짜 Supabase 클라이언트. */
function makeSupabase(opts: {
  user?: { id: string } | null;
  plan?: "free" | "pro";
  usageByUser?: number;
}) {
  const single = vi
    .fn()
    .mockResolvedValue({ data: opts.plan ? { plan: opts.plan } : null });
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn(async () => ({ data: opts.usageByUser ?? 0 }));
  const getUser = vi
    .fn()
    .mockResolvedValue({ data: { user: opts.user ?? null } });
  return { auth: { getUser }, from, rpc } as unknown as SupabaseClient;
}

describe("getUsageStatus", () => {
  it("비로그인이면 authenticated=false, 남은 횟수는 한도 전체", async () => {
    const status = await getUsageStatus(makeSupabase({ user: null }));
    expect(status.authenticated).toBe(false);
    expect(status.remaining).toBe(DAILY_LIMIT);
    expect(status.unlimited).toBe(false);
  });

  it("plan='pro'면 unlimited=true", async () => {
    const status = await getUsageStatus(
      makeSupabase({ user: { id: "u" }, plan: "pro" })
    );
    expect(status.isPro).toBe(true);
    expect(status.unlimited).toBe(true);
  });

  it("무료·1회 사용 → 남은 2회", async () => {
    const status = await getUsageStatus(
      makeSupabase({ user: { id: "u" }, usageByUser: 1 })
    );
    expect(status.used).toBe(1);
    expect(status.remaining).toBe(2);
    expect(status.unlimited).toBe(false);
  });

  it("무료·3회 사용 → 남은 0회", async () => {
    const status = await getUsageStatus(
      makeSupabase({ user: { id: "u" }, usageByUser: 3 })
    );
    expect(status.remaining).toBe(0);
  });

  it("무료·한도 초과 사용(5회)도 남은 횟수는 0으로 고정(음수 금지)", async () => {
    const status = await getUsageStatus(
      makeSupabase({ user: { id: "u" }, usageByUser: 5 })
    );
    expect(status.remaining).toBe(0);
  });
});
