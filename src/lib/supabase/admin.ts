import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase 클라이언트.
 *
 * service role 키는 RLS(Row Level Security)를 우회한다.
 * 웹훅 등 사용자 세션이 없는 서버 전용 컨텍스트에서만 사용하고,
 * 절대 클라이언트 번들에 노출해서는 안 된다.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
