"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Download, Printer, Edit2, CheckCircle,
  Clock, AlertTriangle, XCircle, Building2, User,
} from "lucide-react";
import { invoicesApi } from "@/lib/api";
import { Invoice } from "@/types";
import { formatCurrency, formatDate, STATUS_COLORS, cn, downloadBlob } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { toast } from "sonner";

const STATUS_ICONS: Record<string, React.ElementType> = {
  paid: CheckCircle,
  pending: Clock,
  overdue: AlertTriangle,
  cancelled: XCircle,
  partially_paid: Clock,
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { business } = useAuthStore();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);

  useEffect(() => {
    invoicesApi.get(id)
      .then(r => setInvoice(r.data))
      .catch(() => toast.error("Invoice not found"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    setPdfLoading(true);
    try {
      const res = await invoicesApi.downloadPdf(id);
      downloadBlob(res.data, `invoice-${invoice.invoice_number}.pdf`);
      toast.success("PDF downloaded");
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!invoice) return;
    setMarkingPaid(true);
    try {
      const res = await invoicesApi.update(id, {
        payment_status: "paid",
        amount_paid: invoice.grand_total,
      });
      setInvoice(res.data);
      toast.success("Invoice marked as paid!");
    } catch {
      toast.error("Failed to update invoice");
    } finally {
      setMarkingPaid(false);
    }
  };

  const handlePrint = async () => {
    if (!invoice) return;
    setPrinting(true);
    const toastId = toast.loading("Preparing clean print...");
    try {
      const res = await invoicesApi.downloadPdf(id);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      
      iframe.onload = () => {
        iframe.contentWindow?.print();
        toast.dismiss(toastId);
        // Cleanup
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
        }, 3000);
      };
    } catch {
      toast.error("Failed to generate professional print", { id: toastId });
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Invoice not found.</p>
        <Link href="/dashboard/invoices" className="text-blue-600 hover:underline mt-2 inline-block">← Back to invoices</Link>
      </div>
    );
  }

  const StatusIcon = STATUS_ICONS[invoice.payment_status] || Clock;

  return (
    <div className="max-w-4xl space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{invoice.invoice_number}</h1>
            <p className="text-sm text-slate-500">{formatDate(invoice.invoice_date)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {invoice.payment_status !== "paid" && invoice.payment_status !== "cancelled" && (
            <button onClick={handleMarkPaid} disabled={markingPaid}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
              <CheckCircle className="w-4 h-4" />
              {markingPaid ? "Updating..." : "Mark Paid"}
            </button>
          )}
          <button onClick={handleDownloadPdf} disabled={pdfLoading}
            className="flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
            <Download className="w-4 h-4" />
            {pdfLoading ? "Generating..." : "PDF"}
          </button>
          <button onClick={handlePrint} disabled={printing}
            className="flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
            <Printer className={cn("w-4 h-4", printing && "animate-pulse")} />
            {printing ? "Preparing..." : "Print"}
          </button>
        </div>
      </div>

      {/* Invoice Document */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden invoice-print">
        {/* Header band */}
        <div className="bg-gradient-to-r from-slate-900 to-blue-900 text-white p-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {business?.logo_url ? (
                  <img src={business.logo_url} alt="Logo" className="w-10 h-10 object-contain rounded-lg" />
                ) : null}
                <span className="text-xl font-bold">{business?.name}</span>
              </div>
              {business?.gst_number && (
                <p className="text-blue-200 text-sm">GST: {business.gst_number}</p>
              )}
              {business?.address_line1 && (
                <p className="text-blue-200 text-sm mt-1">
                  {[business.address_line1, business.city, business.state].filter(Boolean).join(", ")}
                </p>
              )}
              {business?.phone && <p className="text-blue-200 text-sm">{business.phone}</p>}
            </div>
            <div className="text-right">
              <p className="text-blue-200 text-xs font-semibold tracking-widest uppercase mb-1">Tax Invoice</p>
              <p className="text-3xl font-bold text-white">{invoice.invoice_number}</p>
              <div className={cn(
                "inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-semibold",
                invoice.payment_status === "paid" ? "bg-emerald-500/20 text-emerald-200" :
                invoice.payment_status === "overdue" ? "bg-red-500/20 text-red-200" :
                "bg-amber-500/20 text-amber-200"
              )}>
                <StatusIcon className="w-3 h-3" />
                {invoice.payment_status.replace("_", " ").toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Dates row */}
        <div className="grid grid-cols-3 gap-px bg-slate-100">
          {[
            { label: "Invoice Date", value: formatDate(invoice.invoice_date) },
            { label: "Due Date", value: invoice.due_date ? formatDate(invoice.due_date) : "On Receipt" },
            { label: "Status", value: invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white px-5 py-3">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* Bill to / From */}
        <div className="grid grid-cols-2 gap-6 p-8 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-slate-400" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Bill From</p>
            </div>
            <p className="font-semibold text-slate-900">{business?.name}</p>
            {business?.gst_number && <p className="text-sm text-slate-500">GSTIN: {business.gst_number}</p>}
            {business?.phone && <p className="text-sm text-slate-500">{business.phone}</p>}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-slate-400" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Bill To</p>
            </div>
            <p className="font-semibold text-slate-900">{invoice.customer_name || "Walk-in Customer"}</p>
            {invoice.customer_gst && <p className="text-sm text-slate-500">GSTIN: {invoice.customer_gst}</p>}
            {invoice.customer_phone && <p className="text-sm text-slate-500">{invoice.customer_phone}</p>}
            {invoice.customer_address && <p className="text-sm text-slate-500">{invoice.customer_address}</p>}
          </div>
        </div>

        {/* Items table */}
        <div className="p-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">#</th>
                <th className="text-left pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Item</th>
                <th className="text-center pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">HSN</th>
                <th className="text-center pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Qty</th>
                <th className="text-right pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Rate</th>
                <th className="text-right pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Disc%</th>
                <th className="text-right pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">GST%</th>
                <th className="text-right pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {invoice.items.map((item, i) => (
                <tr key={item.id} className="group">
                  <td className="py-3.5 text-slate-400 text-sm">{i + 1}</td>
                  <td className="py-3.5">
                    <p className="font-medium text-slate-800">{item.product_name}</p>
                    {item.product_description && (
                      <p className="text-xs text-slate-400 mt-0.5">{item.product_description}</p>
                    )}
                  </td>
                  <td className="py-3.5 text-center text-slate-500">{item.hsn_code || "—"}</td>
                  <td className="py-3.5 text-center text-slate-700">{item.quantity} {item.unit}</td>
                  <td className="py-3.5 text-right text-slate-700">{formatCurrency(item.unit_price)}</td>
                  <td className="py-3.5 text-right text-slate-500">{item.discount_percentage}%</td>
                  <td className="py-3.5 text-right text-slate-500">{item.gst_percentage}%</td>
                  <td className="py-3.5 text-right font-semibold text-slate-900">{formatCurrency(item.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-8 pb-8">
          <div className="ml-auto max-w-xs space-y-2 bg-slate-50 rounded-xl p-5">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
            </div>
            {parseFloat(invoice.discount_amount) > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Discount ({invoice.discount_percentage}%)</span>
                <span>-{formatCurrency(invoice.discount_amount)}</span>
              </div>
            )}
            {parseFloat(invoice.cgst_amount) > 0 && (
              <div className="flex justify-between text-sm text-slate-600">
                <span>CGST</span>
                <span>{formatCurrency(invoice.cgst_amount)}</span>
              </div>
            )}
            {parseFloat(invoice.sgst_amount) > 0 && (
              <div className="flex justify-between text-sm text-slate-600">
                <span>SGST</span>
                <span>{formatCurrency(invoice.sgst_amount)}</span>
              </div>
            )}
            {parseFloat(invoice.igst_amount) > 0 && (
              <div className="flex justify-between text-sm text-slate-600">
                <span>IGST</span>
                <span>{formatCurrency(invoice.igst_amount)}</span>
              </div>
            )}
            <div className="border-t border-slate-200 pt-2 flex justify-between">
              <span className="font-bold text-slate-900">Grand Total</span>
              <span className="font-bold text-blue-600 text-lg">{formatCurrency(invoice.grand_total)}</span>
            </div>
            {parseFloat(invoice.amount_paid) > 0 && (
              <>
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Amount Paid</span>
                  <span>-{formatCurrency(invoice.amount_paid)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-red-600">
                  <span>Balance Due</span>
                  <span>{formatCurrency(invoice.amount_due)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Notes / Terms */}
        {(invoice.notes || invoice.terms) && (
          <div className="px-8 pb-8 grid grid-cols-2 gap-6 border-t border-slate-100 pt-6">
            {invoice.notes && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Notes</p>
                <p className="text-sm text-slate-600 whitespace-pre-line">{invoice.notes}</p>
              </div>
            )}
            {invoice.terms && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Terms & Conditions</p>
                <p className="text-sm text-slate-600 whitespace-pre-line">{invoice.terms}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="bg-slate-50 px-8 py-4 border-t border-slate-100">
          <p className="text-xs text-center text-slate-400">
            Generated by BillFlow • This is a computer-generated invoice
          </p>
        </div>
      </div>
    </div>
  );
}
