import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Polar SDK 서명 검증 유틸과 admin Supabase 클라이언트는 모듈 단위로 스텁한다.
vi.mock("@polar-sh/sdk/webhooks", () => ({
  validateEvent: vi.fn(),
  WebhookVerificationError: class WebhookVerificationError extends Error {},
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { POST } from "./route";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { createAdminClient } from "@/lib/supabase/admin";

const mockedValidateEvent = vi.mocked(validateEvent);
const mockedCreateAdminClient = vi.mocked(createAdminClient);

function makeRequest(body = "{}"): NextRequest {
  return new Request("http://localhost/api/webhooks/polar", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-signature": "v1,fake-signature",
    },
    body,
  }) as unknown as NextRequest;
}

/** 설정 가능한 가짜 Supabase admin 클라이언트 (profiles.update().eq() 체인). */
function makeAdminSupabase() {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return { from, update, eq };
}

function makeSubscriptionEvent(
  type: string,
  data: {
    id?: string;
    status?: string;
    customerId?: string;
    metadata?: Record<string, unknown>;
  } = {}
) {
  return {
    type,
    data: {
      id: data.id ?? "sub_1",
      status: data.status ?? "active",
      customerId: data.customerId ?? "cus_1",
      metadata: data.metadata ?? { user_id: "user-1" },
    },
  };
}

beforeEach(() => {
  vi.stubEnv("POLAR_WEBHOOK_SECRET", "test-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("POST /api/webhooks/polar - 설정/서명 검증", () => {
  it("POLAR_WEBHOOK_SECRET이 없으면 500을 반환하고 검증을 시도하지 않는다", async () => {
    vi.stubEnv("POLAR_WEBHOOK_SECRET", "");

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
    expect(mockedValidateEvent).not.toHaveBeenCalled();
  });

  it("서명 검증에 실패하면(WebhookVerificationError) 401을 반환한다", async () => {
    mockedValidateEvent.mockImplementation(() => {
      throw new WebhookVerificationError("invalid signature");
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
  });
});

describe("POST /api/webhooks/polar - 이벤트별 플랜 갱신", () => {
  it("subscription.created 수신 시 profiles.plan을 'pro'로 갱신한다", async () => {
    mockedValidateEvent.mockReturnValue(
      makeSubscriptionEvent("subscription.created", {
        status: "active",
      }) as never
    );
    const supabase = makeAdminSupabase();
    mockedCreateAdminClient.mockReturnValue(supabase as never);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ received: true });
    expect(supabase.from).toHaveBeenCalledWith("profiles");
    expect(supabase.update).toHaveBeenCalledWith({
      plan: "pro",
      polar_customer_id: "cus_1",
      polar_subscription_id: "sub_1",
    });
    expect(supabase.eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("subscription.updated + status:canceled 수신 시 profiles.plan을 'free'로 갱신한다", async () => {
    mockedValidateEvent.mockReturnValue(
      makeSubscriptionEvent("subscription.updated", {
        status: "canceled",
      }) as never
    );
    const supabase = makeAdminSupabase();
    mockedCreateAdminClient.mockReturnValue(supabase as never);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "free" })
    );
  });

  it("subscription.canceled 수신 시 profiles.plan을 'free'로 갱신한다", async () => {
    mockedValidateEvent.mockReturnValue(
      makeSubscriptionEvent("subscription.canceled") as never
    );
    const supabase = makeAdminSupabase();
    mockedCreateAdminClient.mockReturnValue(supabase as never);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "free" })
    );
    expect(supabase.eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("metadata.user_id가 없으면 갱신 없이 200을 반환한다", async () => {
    mockedValidateEvent.mockReturnValue(
      makeSubscriptionEvent("subscription.created", { metadata: {} }) as never
    );
    const supabase = makeAdminSupabase();
    mockedCreateAdminClient.mockReturnValue(supabase as never);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ received: true });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("admin 클라이언트를 생성할 수 없으면(service role 키 미설정) 500을 반환한다", async () => {
    mockedValidateEvent.mockReturnValue(
      makeSubscriptionEvent("subscription.created") as never
    );
    mockedCreateAdminClient.mockReturnValue(null);

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
  });

  it("checkout.* 등 미처리 이벤트는 갱신 없이 200을 반환한다", async () => {
    mockedValidateEvent.mockReturnValue({
      type: "checkout.created",
      data: { id: "checkout_1" },
    } as never);
    const supabase = makeAdminSupabase();
    mockedCreateAdminClient.mockReturnValue(supabase as never);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
