import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Supabase 서버 클라이언트는 모듈 단위로 스텁한다 (실제 DB/쿠키 접근 차단).
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { GET } from "./route";
import { createClient } from "@/lib/supabase/server";

const mockedCreateClient = vi.mocked(createClient);

/** 설정 가능한 가짜 Supabase 클라이언트. usage/route.test.ts의 패턴을 따른다. */
function makeSupabase(opts: { user?: { id: string } | null; rows?: unknown[] }) {
  const limit = vi.fn().mockResolvedValue({ data: opts.rows ?? [] });
  const order = vi.fn(() => ({ limit }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const getUser = vi
    .fn()
    .mockResolvedValue({ data: { user: opts.user ?? null } });
  return { auth: { getUser }, from, select, eq, order, limit };
}

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  mockedCreateClient.mockResolvedValue(null as never);
});

describe("GET /api/analyses", () => {
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

  it("로그인이면 200 + 히스토리 목록 반환", async () => {
    const rows = [
      { id: "a1", url: "https://a.com", score: 90, created_at: "2026-07-10T00:00:00Z" },
    ];
    const supabase = makeSupabase({ user: { id: "user-1" }, rows });
    mockedCreateClient.mockResolvedValue(supabase as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(rows);
    expect(supabase.from).toHaveBeenCalledWith("analyses");
    expect(supabase.eq).toHaveBeenCalledWith("user_id", "user-1");
  });
});
