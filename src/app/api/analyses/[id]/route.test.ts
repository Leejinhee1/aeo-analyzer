import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Supabase 서버 클라이언트는 모듈 단위로 스텁한다 (실제 DB/쿠키 접근 차단).
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { GET } from "./route";
import { createClient } from "@/lib/supabase/server";

const mockedCreateClient = vi.mocked(createClient);

/** 설정 가능한 가짜 Supabase 클라이언트: from("analyses").select().eq("id", ...).single() 체인. */
function makeSupabase(opts: {
  user?: { id: string } | null;
  row?: { id: string; url: string; score: number; results: unknown; created_at: string } | null;
}) {
  const single = vi.fn().mockResolvedValue({
    data: opts.row ?? null,
    error: opts.row ? null : { message: "not found" },
  });
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const getUser = vi
    .fn()
    .mockResolvedValue({ data: { user: opts.user ?? null } });
  return { auth: { getUser }, from, select, eq, single };
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  mockedCreateClient.mockResolvedValue(null as never);
});

describe("GET /api/analyses/[id]", () => {
  it("Supabase 미연결이면 503", async () => {
    mockedCreateClient.mockResolvedValue(null as never);

    const res = await GET(new Request("http://localhost/api/analyses/a1"), makeParams("a1"));

    expect(res.status).toBe(503);
  });

  it("비로그인이면 401", async () => {
    const supabase = makeSupabase({ user: null });
    mockedCreateClient.mockResolvedValue(supabase as never);

    const res = await GET(new Request("http://localhost/api/analyses/a1"), makeParams("a1"));

    expect(res.status).toBe(401);
  });

  it("존재하지 않으면(또는 타인 소유) 404", async () => {
    const supabase = makeSupabase({ user: { id: "user-1" }, row: null });
    mockedCreateClient.mockResolvedValue(supabase as never);

    const res = await GET(new Request("http://localhost/api/analyses/missing"), makeParams("missing"));

    expect(res.status).toBe(404);
  });

  it("본인 소유 분석이면 200 + 저장된 results 전체 반환", async () => {
    const results = { url: "https://a.com", score: 88, categories: {}, improvements: [] };
    const supabase = makeSupabase({
      user: { id: "user-1" },
      row: { id: "a1", url: "https://a.com", score: 88, results, created_at: "2026-07-10T00:00:00Z" },
    });
    mockedCreateClient.mockResolvedValue(supabase as never);

    const res = await GET(new Request("http://localhost/api/analyses/a1"), makeParams("a1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(results);
    expect(supabase.from).toHaveBeenCalledWith("analyses");
    expect(supabase.eq).toHaveBeenCalledWith("id", "a1");
  });
});
