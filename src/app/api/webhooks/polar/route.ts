import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("POLAR_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("webhook-signature");

  // 서명 검증 (간소화된 버전)
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  // TODO: 실제 Polar 서명 검증 로직 구현
  // 현재는 기본적인 검증만 수행

  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 이벤트 타입별 처리
  const eventType = event.type || event.event;

  switch (eventType) {
    case "subscription.created":
      console.log("New subscription:", event.data);
      // TODO: DB에 구독 정보 저장
      // await updateUserPlan(event.data.customer_id, 'pro');
      break;

    case "subscription.updated":
      console.log("Subscription updated:", event.data);
      // TODO: 구독 상태 업데이트
      break;

    case "subscription.canceled":
      console.log("Subscription canceled:", event.data);
      // TODO: 구독 취소 처리
      // await updateUserPlan(event.data.customer_id, 'free');
      break;

    case "checkout.created":
    case "checkout.updated":
      console.log("Checkout event:", event.data);
      break;

    default:
      console.log("Unhandled event type:", eventType);
  }

  return NextResponse.json({ received: true });
}
