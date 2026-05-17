"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Package, Users, FileText,
  Settings, LogOut, Receipt, ChevronRight, Bell, FileText as FT,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { authApi, businessApi } from "@/lib/api";
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/invoices", label: "Invoices", icon: FileText },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/products", label: "Products", icon: Package },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, hasBusiness, user, business, logout, setBusiness } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/auth/login");
      return;
    }
    if (user?.role === "super_admin") {
      router.replace("/admin");
      return;
    }

    if (hasBusiness && business) {
      // Already have business loaded — no need to fetch
      setChecking(false);
      return;
    }

    // Try to fetch business from API
    businessApi.getMe()
      .then(r => {
        setBusiness(r.data);
        setChecking(false);
      })
      .catch(() => {
        // No business yet — go to onboarding
        router.replace("/onboarding");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user]);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    logout();
    // FIX: Toast must fire before router.push() or it won't render
    toast.success("Logged out successfully");
    router.push("/auth/login");
  };

  // Show spinner only while checking business
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* ─── Sidebar ──────────────────────────────── */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 no-print">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-slate-900 text-sm">BillFlow</span>
              {business && (
                <p className="text-xs text-slate-400 truncate max-w-[140px]">{business.name}</p>
              )}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link key={href} href={href}
                className={`sidebar-item ${active ? "active" : ""}`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 group cursor-default">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
              {getInitials(user?.full_name || user?.email)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{user?.full_name || "User"}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
            <button onClick={handleLogout}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 no-print">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-slate-900">
              {NAV_ITEMS.find(n => pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href)))?.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/invoices/new"
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition-colors">
              <FileText className="w-3.5 h-3.5" />
              New Invoice
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
