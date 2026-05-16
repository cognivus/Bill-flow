"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Building2, FileText, ArrowUpRight, UserCheck } from "lucide-react";
import { adminApi } from "@/lib/api";
import { toast } from "sonner";

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getStats()
      .then(r => setStats(r.data))
      .catch(() => toast.error("Failed to load stats"))
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: "Total Users", value: stats?.total_users ?? "—", icon: Users, href: "/admin/users", color: "blue" },
    { label: "Total Businesses", value: stats?.total_businesses ?? "—", icon: Building2, href: "/admin/businesses", color: "violet" },
    { label: "Total Invoices", value: stats?.total_invoices ?? "—", icon: FileText, href: "/admin/invoices", color: "emerald" },
    { label: "New Users Today", value: stats?.new_users_today ?? "—", icon: UserCheck, href: "/admin/users", color: "amber" },
  ];

  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    violet: "bg-violet-50 text-violet-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Overview</h1>
        <p className="text-sm text-slate-500 mt-0.5">Platform-level management</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
              <div className="w-10 h-10 bg-slate-100 rounded-xl mb-4" />
              <div className="h-7 bg-slate-100 rounded w-16 mb-1" />
              <div className="h-4 bg-slate-50 rounded w-24" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {cards.map(({ label, value, icon: Icon, href, color }) => (
            <Link key={label} href={href}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all group">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${colorMap[color]}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-sm text-slate-500">{label}</p>
                <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/admin/users"
          className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900">Manage Users</h3>
              <p className="text-sm text-slate-500 mt-0.5">Create, deactivate, change roles</p>
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
          </div>
        </Link>
        <Link href="/admin/businesses"
          className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900">Manage Businesses</h3>
              <p className="text-sm text-slate-500 mt-0.5">Activate, deactivate, delete</p>
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-violet-500 transition-colors" />
          </div>
        </Link>
      </div>
    </div>
  );
}
