"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plus, Search, Download, Eye, Trash2, FileText,
  Filter, ChevronLeft, ChevronRight,
} from "lucide-react";
import { invoicesApi } from "@/lib/api";
import { Invoice, InvoiceListResponse, PaymentStatus, InvoiceStatus } from "@/types";
import { formatCurrency, formatDate, STATUS_COLORS, cn, downloadBlob } from "@/lib/utils";
import { toast } from "sonner";

const PAYMENT_STATUSES: { label: string; value: PaymentStatus | "" }[] = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Paid", value: "paid" },
  { label: "Partially Paid", value: "partially_paid" },
  { label: "Overdue", value: "overdue" },
];

export default function InvoicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<InvoiceListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "">( (searchParams.get("payment_status") as PaymentStatus) || "");
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, per_page: 15 };
      if (search) params.search = search;
      if (paymentStatus) params.payment_status = paymentStatus;
      const res = await invoicesApi.list(params);
      setData(res.data);
    } catch {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [page, search, paymentStatus]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handleDelete = async (id: string, num: string) => {
    if (!confirm(`Delete invoice ${num}? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await invoicesApi.delete(id);
      toast.success("Invoice deleted");
      fetchInvoices();
    } catch {
      toast.error("Failed to delete invoice");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadPdf = async (id: string, num: string) => {
    try {
      const res = await invoicesApi.downloadPdf(id);
      downloadBlob(res.data, `invoice-${num}.pdf`);
      toast.success("PDF downloaded");
    } catch {
      toast.error("Failed to download PDF");
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data ? `${data.total} total invoices` : "Loading..."}
          </p>
        </div>
        <Link href="/dashboard/invoices/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Invoice
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search invoice number or customer..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {PAYMENT_STATUSES.map(s => (
              <button key={s.value} onClick={() => { setPaymentStatus(s.value); setPage(1); }}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-medium border transition-colors",
                  paymentStatus === s.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                )}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No invoices found</p>
            <p className="text-slate-400 text-sm mt-1">Create your first invoice to get started</p>
            <Link href="/dashboard/invoices/new"
              className="inline-flex items-center gap-1.5 mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              <Plus className="w-4 h-4" /> Create Invoice
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoice #</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Due</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.items.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-sm font-semibold text-blue-600">{inv.invoice_number}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium text-slate-800">{inv.customer_name || "—"}</p>
                        {inv.customer_phone && <p className="text-xs text-slate-400">{inv.customer_phone}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{formatDate(inv.invoice_date)}</td>
                      <td className="px-5 py-3.5">
                        <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", STATUS_COLORS[inv.payment_status])}>
                          {inv.payment_status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-sm font-semibold text-slate-900">{formatCurrency(inv.grand_total)}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={cn("text-sm font-medium",
                          parseFloat(inv.amount_due) > 0 ? "text-red-600" : "text-emerald-600")}>
                          {formatCurrency(inv.amount_due)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/dashboard/invoices/${inv.id}`}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button onClick={() => handleDownloadPdf(inv.id, inv.invoice_number)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                            <Download className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(inv.id, inv.invoice_number)}
                            disabled={deletingId === inv.id}
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

            {/* Pagination */}
            {data.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                <p className="text-sm text-slate-500">
                  Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, data.total)} of {data.total}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 text-sm font-medium text-slate-700">{page} / {data.pages}</span>
                  <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40 transition-colors">
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
