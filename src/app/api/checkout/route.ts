import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const accessToken = process.env.POLAR_ACCESS_TOKEN;
    const proPriceId = process.env.POLAR_PRO_PRICE_ID;

    if (!accessToken || !proPriceId) {
      return NextResponse.json(
        { error: "Polar is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { customerEmail, successUrl } = body;

    // Polar Checkout API 직접 호출
    const response = await fetch("https://api.polar.sh/v1/checkouts/custom/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        product_price_id: proPriceId,
        customer_email: customerEmail,
        success_url: successUrl || `${request.nextUrl.origin}/dashboard?success=true`,
        metadata: {
          source: "aeo-analyzer",
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
