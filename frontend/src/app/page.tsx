"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    router.replace(user.role === "ADMIN" ? "/admin" : "/dashboard");
  }, [user, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      Redirecionando...
    </div>
  );
}
