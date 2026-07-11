import { NextRequest, NextResponse } from "next/server";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { createAdminClient } from "@/lib/supabase/admin";

type Plan = "free" | "pro";

/**
 * "취소/비활성" 계열 구독 상태.
 * subscription.created/updated 이벤트에서 이 상태를 만나면 pro가 아니라 free로 갱신한다.
 */
const INACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "canceled",
  "revoked",
  "unpaid",
  "incomplete_expired",
]);

interface SubscriptionEventData {
  id: string;
  status?: string;
  customerId?: string;
  metadata?: Record<string, unknown>;
}

interface SubscriptionEvent {
  type: string;
  data: SubscriptionEventData;
}

/**
 * event.data.metadata.user_id로 profiles 행을 갱신한다.
 * user_id가 없으면 갱신 없이 null을 반환한다 (호출부에서 200 no-op 처리).
 * admin 클라이언트가 없거나 갱신에 실패하면 500 응답을 반환한다.
 */
async function syncPlanFromSubscription(
  data: SubscriptionEventData,
  plan: Plan
): Promise<NextResponse | null> {
  const userId = data.metadata?.user_id;

  if (!userId || typeof userId !== "string") {
    console.warn(
      "Polar webhook: metadata.user_id missing, skipping plan sync",
      { subscriptionId: data.id }
    );
    return null;
  }

  const supabase = createAdminClient();
  if (!supabase) {
    console.error(
      "Polar webhook: SUPABASE_SERVICE_ROLE_KEY not set, cannot sync plan"
    );
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 }
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      plan,
      polar_customer_id: data.customerId ?? null,
      polar_subscription_id: data.id ?? null,
    })
    .eq("id", userId);

  if (error) {
    console.error("Polar webhook: failed to update profile plan", error);
    return NextResponse.json(
      { error: "Failed to update plan" },
      { status: 500 }
    );
  }

  return null;
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("POLAR_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  const body = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  let event: SubscriptionEvent;
  try {
    event = validateEvent(body, headers, webhookSecret) as unknown as SubscriptionEvent;
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    // 서명은 유효하지만 알 수 없는/파싱 불가 이벤트 — 재시도 폭주를 막기 위해 200으로 흡수한다.
    console.error("Polar webhook: failed to parse event", error);
    return NextResponse.json({ received: true });
  }

  switch (event.type) {
    case "subscription.created":
    case "subscription.updated": {
      const plan: Plan = INACTIVE_SUBSCRIPTION_STATUSES.has(
        event.data.status ?? ""
      )
        ? "free"
        : "pro";
      const errorResponse = await syncPlanFromSubscription(event.data, plan);
      if (errorResponse) return errorResponse;
      break;
    }

    case "subscription.canceled":
    case "subscription.revoked": {
      const errorResponse = await syncPlanFromSubscription(event.data, "free");
      if (errorResponse) return errorResponse;
      break;
    }

    default:
      console.log("Unhandled event type:", event.type);
  }

  return NextResponse.json({ received: true });
}
