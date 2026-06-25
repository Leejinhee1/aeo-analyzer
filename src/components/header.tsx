"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";

export function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log(`[Auth] ${event}:`, session?.user?.email ?? "no user");
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <header className="border-b bg-white dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl">
          AEO Analyzer
        </Link>

        <nav className="flex items-center gap-4">
          {loading ? (
            <div className="h-9 w-20 bg-gray-200 animate-pulse rounded" />
          ) : user ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost">대시보드</Button>
              </Link>
              <Button variant="outline" onClick={handleLogout}>
                로그아웃
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button>로그인</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
