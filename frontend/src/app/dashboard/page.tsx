"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, IndianRupee, FileText,
  Users, Package, AlertTriangle, ArrowUpRight, Clock
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar
} from "recharts";
import { dashboardApi } from "@/lib/api";
import { DashboardResponse } from "@/types";
import { formatCurrency, formatDate, STATUS_COLORS, cn } from "@/lib/utils";
import { toast } from "sonner";

function StatCard({
  title, value, sub, icon: Icon, trend, color = "blue",
}: {
  title: string; value: string; sub?: string;
  icon: React.ElementType; trend?: number; color?: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    red: "bg-red-50 text-red-600",
  };
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full
            ${trend >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 mb-1">{value}</p>
      <p className="text-sm text-slate-500">{title}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.get()
      .then(r => setData(r.data))
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card animate-pulse">
              <div className="w-10 h-10 bg-slate-200 rounded-xl mb-4" />
              <div className="h-7 bg-slate-200 rounded w-32 mb-2" />
              <div className="h-4 bg-slate-100 rounded w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { stats, recent_invoices, monthly_revenue } = data;

  const chartData = monthly_revenue.map(m => ({
    name: m.month.split(" ")[0],
    revenue: parseFloat(m.revenue),
    invoices: m.invoice_count,
  }));

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Here's what's happening with your business today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.total_revenue)}
          sub={`This month: ${formatCurrency(stats.revenue_this_month)}`}
          icon={IndianRupee}
          trend={stats.revenue_growth_percent}
          color="blue"
        />
        <StatCard
          title="Total Invoices"
          value={stats.total_invoices.toString()}
          sub={`${stats.invoices_this_month} this month`}
          icon={FileText}
          color="violet"
        />
        <StatCard
          title="Customers"
          value={stats.total_customers.toString()}
          sub={`${stats.new_customers_this_month} new this month`}
          icon={Users}
          color="emerald"
        />
        <StatCard
          title="Products"
          value={stats.total_products.toString()}
          sub={`${stats.low_stock_products} low stock`}
          icon={Package}
          color={stats.low_stock_products > 0 ? "amber" : "blue"}
        />
      </div>

      {/* Alert row */}
      {(stats.overdue_invoices > 0 || stats.low_stock_products > 0) && (
        <div className="flex flex-wrap gap-3">
          {stats.overdue_invoices > 0 && (
            <Link href="/dashboard/invoices?payment_status=overdue"
              className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm hover:bg-red-100 transition-colors">
              <AlertTriangle className="w-4 h-4" />
              {stats.overdue_invoices} overdue invoice{stats.overdue_invoices > 1 ? "s" : ""}
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          )}
          {stats.pending_invoices > 0 && (
            <Link href="/dashboard/invoices?payment_status=pending"
              className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2.5 rounded-lg text-sm hover:bg-amber-100 transition-colors">
              <Clock className="w-4 h-4" />
              {stats.pending_invoices} pending payment{stats.pending_invoices > 1 ? "s" : ""}
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Revenue Area Chart */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-slate-900">Revenue Overview</h3>
              <p className="text-xs text-slate-400 mt-0.5">Last 6 months</p>
            </div>
            <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">Monthly</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v), "Revenue"]}
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2}
                fill="url(#revGrad)" dot={{ fill: "#3b82f6", r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Invoice count bar chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="font-semibold text-slate-900">Invoices</h3>
            <p className="text-xs text-slate-400 mt-0.5">Count per month</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
              />
              <Bar dataKey="invoices" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Recent Invoices</h3>
          <Link href="/dashboard/invoices"
            className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            View all <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="divide-y divide-slate-50">
          {recent_invoices.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No invoices yet.</p>
              <Link href="/dashboard/invoices/new"
                className="text-blue-600 text-sm hover:underline mt-1 inline-block">
                Create your first invoice →
              </Link>
            </div>
          ) : recent_invoices.map((inv) => (
            <Link key={inv.id} href={`/dashboard/invoices/${inv.id}`}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-slate-900">{inv.invoice_number}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[inv.payment_status]}`}>
                    {inv.payment_status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {inv.customer_name || "Walk-in Customer"} • {formatDate(inv.invoice_date)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-900">{formatCurrency(inv.grand_total)}</p>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 ml-auto mt-0.5 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
