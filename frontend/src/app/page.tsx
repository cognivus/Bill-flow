"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, hasBusiness, user } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/auth/login");
    } else if (user?.role === "super_admin") {
      router.replace("/admin");
    } else if (!hasBusiness) {
      router.replace("/dashboard");
    } else {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, hasBusiness, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
          <span className="text-white font-bold text-lg">B</span>
        </div>
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}
