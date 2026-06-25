import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Supabase 서버 클라이언트는 모듈 단위로 스텁한다 (실제 DB/쿠키 접근 차단).
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { POST } from "./route";
import { createClient } from "@/lib/supabase/server";

const mockedCreateClient = vi.mocked(createClient);

const VALID_HTML = `<!doctype html><html><head>
<title>테스트 페이지 제목입니다 - 분석 대상 샘플 문서</title>
<meta name="description" content="분석 대상이 되는 테스트 페이지입니다. 충분한 길이의 설명을 넣어 메타 태그 점검이 정상 동작하는지 확인하기 위한 더미 콘텐츠를 담고 있습니다.">
</head><body><h1>제목</h1><h2>섹션</h2><h3>하위</h3></body></html>`;

/** analyzeURL이 내부에서 호출하는 전역 fetch를 스텁한다. */
function stubAnalyzeFetch() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => VALID_HTML,
  } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** 설정 가능한 가짜 Supabase 클라이언트. */
function makeSupabase(opts: {
  user?: { id: string } | null;
  plan?: "free" | "pro";
  usageByUser?: number;
  usageByDevice?: number;
}) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  // profiles 조회 체인: from("profiles").select("plan").eq("id", ...).single()
  const single = vi
    .fn()
    .mockResolvedValue({ data: opts.plan ? { plan: opts.plan } : null });
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn((table: string) => {
    if (table === "profiles") return { select };
    return { insert }; // usage_logs 등
  });
  const rpc = vi.fn(async (fn: string) => {
    if (fn === "get_daily_usage_by_user") return { data: opts.usageByUser ?? 0 };
    if (fn === "get_daily_usage_by_device") return { data: opts.usageByDevice ?? 0 };
    return { data: 0 };
  });
  const getUser = vi
    .fn()
    .mockResolvedValue({ data: { user: opts.user ?? null } });
  return { auth: { getUser }, rpc, from, insert, select, single };
}

function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  mockedCreateClient.mockResolvedValue(null as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("POST /api/analyze - 입력 검증", () => {
  it("url 누락 시 400", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("잘못된 url 형식 시 400", async () => {
    const res = await POST(makeRequest({ url: "not-a-url" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/analyze - 무료 사용량 제한", () => {
  it("로그인·제한 미달이면 분석 실행 + usage_logs 기록 + 결과 반환", async () => {
    const fetchMock = stubAnalyzeFetch();
    const supabase = makeSupabase({ user: { id: "user-1" }, usageByUser: 1 });
    mockedCreateClient.mockResolvedValue(supabase as never);

    const res = await POST(makeRequest({ url: "https://example.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(typeof body.score).toBe("number");
    expect(fetchMock).toHaveBeenCalled(); // 실제 분석이 수행됨
    expect(supabase.from).toHaveBeenCalledWith("usage_logs");
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        url_analyzed: "https://example.com",
      })
    );
  });

  it("로그인·제한 초과(usage>=3)면 429 + 분석 미실행 + 기록 안 함", async () => {
    const fetchMock = stubAnalyzeFetch();
    const supabase = makeSupabase({ user: { id: "user-1" }, usageByUser: 3 });
    mockedCreateClient.mockResolvedValue(supabase as never);

    const res = await POST(makeRequest({ url: "https://example.com" }));

    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("비로그인은 deviceId 기준으로 집계된다", async () => {
    stubAnalyzeFetch();
    const supabase = makeSupabase({ user: null, usageByDevice: 0 });
    mockedCreateClient.mockResolvedValue(supabase as never);

    const res = await POST(
      makeRequest({ url: "https://example.com", deviceId: "device-abc" })
    );

    expect(res.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith("get_daily_usage_by_device", {
      p_device_id: "device-abc",
    });
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        device_id: "device-abc",
        user_id: null,
      })
    );
  });

  it("비로그인·deviceId 제한 초과면 429", async () => {
    const fetchMock = stubAnalyzeFetch();
    const supabase = makeSupabase({ user: null, usageByDevice: 3 });
    mockedCreateClient.mockResolvedValue(supabase as never);

    const res = await POST(
      makeRequest({ url: "https://example.com", deviceId: "device-abc" })
    );

    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/analyze - 서버측 플랜 권위", () => {
  it("plan='pro'면 제한을 무시하고 분석한다 (usage 초과여도 200)", async () => {
    const fetchMock = stubAnalyzeFetch();
    // 사용량이 제한을 넘겨도(5) Pro면 통과해야 한다.
    const supabase = makeSupabase({
      user: { id: "user-pro" },
      plan: "pro",
      usageByUser: 5,
    });
    mockedCreateClient.mockResolvedValue(supabase as never);

    const res = await POST(makeRequest({ url: "https://example.com" }));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalled();
    // Pro는 무제한이므로 사용량 제한 RPC를 타지 않는다.
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("클라이언트가 보낸 isPro=true는 무시된다 (free 사용자는 여전히 429)", async () => {
    const fetchMock = stubAnalyzeFetch();
    // 서버 plan은 free(미설정)인데 클라이언트가 isPro=true를 위조해 보냄.
    const supabase = makeSupabase({ user: { id: "user-1" }, usageByUser: 3 });
    mockedCreateClient.mockResolvedValue(supabase as never);

    const res = await POST(
      makeRequest({ url: "https://example.com", isPro: true })
    );

    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("비로그인은 isPro=true를 보내도 무료로 취급된다", async () => {
    const fetchMock = stubAnalyzeFetch();
    const supabase = makeSupabase({ user: null, usageByDevice: 3 });
    mockedCreateClient.mockResolvedValue(supabase as never);

    const res = await POST(
      makeRequest({
        url: "https://example.com",
        deviceId: "device-abc",
        isPro: true,
      })
    );

    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
