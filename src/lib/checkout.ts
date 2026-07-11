/**
 * /api/checkout를 호출해 Polar 결제 페이지로 이동한다.
 * 대시보드/결과 페이지의 "Pro 업그레이드" 버튼에서 공유하는 클라이언트 헬퍼.
 */
export async function startCheckout(): Promise<{ error?: string }> {
  try {
    const res = await fetch("/api/checkout", { method: "POST" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.url) {
      return { error: data.error || "결제 페이지 생성에 실패했습니다" };
    }

    window.location.href = data.url;
    return {};
  } catch {
    return { error: "결제 페이지 생성 중 오류가 발생했습니다" };
  }
}
