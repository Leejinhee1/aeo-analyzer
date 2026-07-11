import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Supabase 미연결(로컬/dev 환경 변수 미설정)
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = process.env.POLAR_ACCESS_TOKEN;
    const proPriceId = process.env.POLAR_PRO_PRICE_ID;

    if (!accessToken || !proPriceId) {
      return NextResponse.json(
        { error: "Polar is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { successUrl } = body;

    // Polar Checkout API 직접 호출
    // customer_email은 클라이언트가 보낸 값을 신뢰하지 않고 서버 세션의 이메일을 사용한다.
    const response = await fetch("https://api.polar.sh/v1/checkouts/custom/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        product_price_id: proPriceId,
        customer_email: user.email,
        success_url: successUrl || `${request.nextUrl.origin}/dashboard?success=true`,
        metadata: {
          source: "aeo-analyzer",
          user_id: user.id,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Polar checkout error:", error);
      return NextResponse.json(
        { error: "Failed to create checkout" },
        { status: 500 }
      );
    }

    const checkout = await response.json();
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout" },
      { status: 500 }
    );
  }
}
