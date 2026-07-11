import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Supabase 서버 클라이언트는 모듈 단위로 스텁한다 (실제 DB/쿠키 접근 차단).
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { POST } from "./route";
import { createClient } from "@/lib/supabase/server";

const mockedCreateClient = vi.mocked(createClient);

/** 설정 가능한 가짜 Supabase 클라이언트. usage/route.test.ts의 makeSupabase 패턴 참고. */
function makeSupabase(opts: { user?: { id: string; email?: string } | null }) {
  const getUser = vi
    .fn()
    .mockResolvedValue({ data: { user: opts.user ?? null } });
  return { auth: { getUser } };
}

function makeRequest(body: unknown): NextRequest {
  const request = new Request("http://localhost/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  // route.ts가 request.nextUrl.origin을 사용하므로 NextRequest의 최소 형태를 흉내낸다.
  Object.assign(request, { nextUrl: new URL("http://localhost/api/checkout") });
  return request as unknown as NextRequest;
}

/** Polar checkout API로 가는 전역 fetch를 스텁한다. */
function stubCheckoutFetch() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ url: "https://polar.sh/checkout/abc" }),
  } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  mockedCreateClient.mockResolvedValue(null as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("POST /api/checkout", () => {
  it("Supabase 미연결이면 503", async () => {
    mockedCreateClient.mockResolvedValue(null as never);

    const res = await POST(makeRequest({}));

    expect(res.status).toBe(503);
  });

  it("비로그인이면 401", async () => {
    const supabase = makeSupabase({ user: null });
    mockedCreateClient.mockResolvedValue(supabase as never);

    const res = await POST(makeRequest({}));

    expect(res.status).toBe(401);
  });

  it("env 미설정(POLAR_ACCESS_TOKEN/POLAR_PRO_PRICE_ID)이면 500", async () => {
    vi.stubEnv("POLAR_ACCESS_TOKEN", "");
    vi.stubEnv("POLAR_PRO_PRICE_ID", "");
    const supabase = makeSupabase({
      user: { id: "user-1", email: "user@example.com" },
    });
    mockedCreateClient.mockResolvedValue(supabase as never);

    const res = await POST(makeRequest({}));

    expect(res.status).toBe(500);
  });

  it("로그인 시 세션 이메일과 user_id metadata로 Polar API를 호출하고 url을 반환한다", async () => {
    vi.stubEnv("POLAR_ACCESS_TOKEN", "test-token");
    vi.stubEnv("POLAR_PRO_PRICE_ID", "price-123");
    const fetchMock = stubCheckoutFetch();
    const supabase = makeSupabase({
      user: { id: "user-1", email: "user@example.com" },
    });
    mockedCreateClient.mockResolvedValue(supabase as never);

    // 클라이언트가 다른 이메일을 보내도(customerEmail) 무시되고 세션 이메일이 사용되어야 한다.
    const res = await POST(
      makeRequest({ customerEmail: "attacker@example.com" })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ url: "https://polar.sh/checkout/abc" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.polar.sh/v1/checkouts/custom/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      })
    );

    const [, requestInit] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(requestInit.body as string);

    expect(sentBody.customer_email).toBe("user@example.com");
    expect(sentBody.product_price_id).toBe("price-123");
    expect(sentBody.metadata).toEqual({
      source: "aeo-analyzer",
      user_id: "user-1",
    });
  });
});
