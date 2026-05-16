"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Users, Building2, LogOut, Shield, ChevronRight } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/businesses", label: "Businesses", icon: Building2 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) { router.replace("/auth/login"); return; }
    if (user?.role !== "super_admin") { router.replace("/dashboard"); }
  }, [isAuthenticated, user]);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    logout();
    router.push("/auth/login");
    toast.success("Logged out");
  };

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Dark admin sidebar */}
      <aside className="w-60 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0">
        <div className="h-16 flex items-center px-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">BillFlow</p>
              <p className="text-xs text-red-400 font-semibold">Super Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${active ? "bg-red-500/20 text-red-400" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg group cursor-default">
            <div className="w-8 h-8 rounded-full bg-red-900 flex items-center justify-center text-red-300 text-xs font-bold flex-shrink-0">
              {getInitials(user?.full_name || user?.email)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{user?.full_name || "Admin"}</p>
              <p className="text-xs text-red-400">Super Admin</p>
            </div>
            <button onClick={handleLogout}
              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
          <span className="text-sm font-semibold text-slate-700">
            {ADMIN_NAV.find(n => pathname === n.href || (n.href !== "/admin" && pathname.startsWith(n.href)))?.label || "Admin"}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-red-50 text-red-600 px-2.5 py-1 rounded-full font-semibold border border-red-100">
              🔐 Admin Mode
            </span>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-500 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
