import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Supabase 서버 클라이언트는 모듈 단위로 스텁한다 (실제 DB/쿠키 접근 차단).
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { GET } from "./route";
import { createClient } from "@/lib/supabase/server";

const mockedCreateClient = vi.mocked(createClient);

/** 설정 가능한 가짜 Supabase 클라이언트. analyze/route.test.ts의 makeSupabase 패턴 참고. */
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
  return { auth: { getUser }, rpc, from, select, eq, single };
}

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  mockedCreateClient.mockResolvedValue(null as never);
});

describe("GET /api/usage", () => {
  it("Supabase 미연결이면 503", async () => {
    mockedCreateClient.mockResolvedValue(null as never);

    const res = await GET();

    expect(res.status).toBe(503);
  });

  it("비로그인이면 401", async () => {
    const supabase = makeSupabase({ user: null });
    mockedCreateClient.mockResolvedValue(supabase as never);

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it("로그인한 free 사용자는 200 + 사용량/잔여 반환", async () => {
    const supabase = makeSupabase({
      user: { id: "user-1" },
      plan: "free",
      usageByUser: 2,
    });
    mockedCreateClient.mockResolvedValue(supabase as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ plan: "free", used: 2, remaining: 1 });
  });

  it("로그인한 pro 사용자는 200 + 무제한(remaining: null) 반환", async () => {
    const supabase = makeSupabase({ user: { id: "user-pro" }, plan: "pro" });
    mockedCreateClient.mockResolvedValue(supabase as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ plan: "pro", used: 0, remaining: null });
  });
});
