// 비로그인 사용자 식별용 디바이스 ID (localStorage 기반)
// 일 3회 분석 제한을 위해 브라우저별로 영구 UUID를 발급/재사용한다.
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";

  let id = localStorage.getItem("aeo_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("aeo_device_id", id);
  }
  return id;
}
