"use client";
import { useEffect, useState, useCallback } from "react";
import { Search, Building2, ToggleLeft, ToggleRight, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { adminApi } from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";

export default function AdminBusinessesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, per_page: 15 };
      if (search) params.search = search;
      const res = await adminApi.listBusinesses(params);
      setData(res.data);
    } catch {
      toast.error("Failed to load businesses");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggle = async (id: string, name: string, isActive: boolean) => {
    setActionId(id);
    try {
      const res = await adminApi.toggleBusiness(id);
      toast.success(res.data.message);
      fetchData();
    } catch { toast.error("Failed to update"); }
    finally { setActionId(null); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Permanently delete "${name}" and ALL its data? This cannot be undone.`)) return;
    setActionId(id);
    try {
      await adminApi.deleteBusiness(id);
      toast.success("Business deleted");
      fetchData();
    } catch { toast.error("Failed to delete"); }
    finally { setActionId(null); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Businesses</h1>
        <p className="text-sm text-slate-500">{data ? `${data.total} total` : "Loading..."}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search business name..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : !data?.items?.length ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500">No businesses found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {["Business", "Owner", "Location", "Invoices", "Joined", "Status", "Actions"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.items.map((b: any) => (
                    <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-900 text-sm">{b.name}</p>
                        {b.gst_number && <p className="text-xs text-slate-400">GST: {b.gst_number}</p>}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm text-slate-700">{b.owner_name || "—"}</p>
                        <p className="text-xs text-slate-400">{b.owner_email}</p>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        {[b.city, b.state].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-700 text-center">{b.invoice_count}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{formatDate(b.created_at)}</td>
                      <td className="px-5 py-3.5">
                        <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium",
                          b.is_active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                          {b.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggle(b.id, b.name, b.is_active)}
                            disabled={actionId === b.id}
                            title={b.is_active ? "Deactivate" : "Activate"}
                            className={cn("p-1.5 rounded-lg transition-colors disabled:opacity-40",
                              b.is_active ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-100")}>
                            {b.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleDelete(b.id, b.name)}
                            disabled={actionId === b.id}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                <p className="text-sm text-slate-500">{data.total} businesses</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 text-sm text-slate-600">{page} / {data.pages}</span>
                  <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
