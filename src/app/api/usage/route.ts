import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsageStatus } from "@/lib/dashboard-data";

export async function GET() {
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

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getUsageStatus(supabase, user.id);
  return NextResponse.json(status);
}
