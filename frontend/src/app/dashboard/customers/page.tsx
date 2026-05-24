"use client";
import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, Search, Edit2, Trash2, Users, X,
  ChevronLeft, ChevronRight, Phone, Mail,
  MapPin, FileText, ArrowUpRight, IndianRupee,
} from "lucide-react";
import { customersApi } from "@/lib/api";
import { Customer, CustomerListResponse } from "@/types";
import { formatCurrency, formatDate, getInitials, cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  gst_number: z.string().optional(),
  address_line1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function CustomersPage() {
  const [data, setData] = useState<CustomerListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // FIX: Debounced search — 300ms delay before API call
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, per_page: 10 };
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await customersApi.list(params);
      setData(res.data);
    } catch {
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const openCreate = () => {
    setEditCustomer(null);
    reset({});
    setShowModal(true);
  };

  const openEdit = (c: Customer) => {
    setEditCustomer(c);
    reset({
      name: c.name, email: c.email || "", phone: c.phone || "",
      gst_number: c.gst_number || "", address_line1: c.address_line1 || "",
      city: c.city || "", state: c.state || "", pincode: c.pincode || "",
      notes: c.notes || "",
    });
    setViewCustomer(null);
    setShowModal(true);
  };

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      if (editCustomer) {
        await customersApi.update(editCustomer.id, data);
        toast.success("Customer updated");
      } else {
        await customersApi.create(data);
        toast.success("Customer added");
      }
      setShowModal(false);
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to save customer");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete customer "${name}"?`)) return;
    setDeletingId(id);
    try {
      await customersApi.delete(id);
      toast.success("Customer deleted");
      if (viewCustomer?.id === id) setViewCustomer(null);
      fetchCustomers();
    } catch {
      toast.error("Failed to delete customer");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="text-sm text-slate-500 mt-0.5">{data ? `${data.total} customers` : "Loading..."}</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, phone or email..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
            <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No customers yet</p>
            <button onClick={openCreate}
              className="mt-4 inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              <Plus className="w-4 h-4" /> Add First Customer
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="w-full hidden md:table">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoices</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Purchases</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.items.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => setViewCustomer(c)}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {getInitials(c.name)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                          {c.gst_number && <p className="text-xs text-slate-400">GSTIN: {c.gst_number}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="space-y-0.5">
                        {c.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <Phone className="w-3 h-3 text-slate-400" />{c.phone}
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <Mail className="w-3 h-3 text-slate-400" />{c.email}
                          </div>
                        )}
                        {c.city && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <MapPin className="w-3 h-3" />{c.city}{c.state ? `, ${c.state}` : ""}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-medium text-slate-700">{c.invoice_count}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(c.total_purchases)}</span>
                    </td>
                    <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(c)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(c.id, c.name)} disabled={deletingId === c.id}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {data.items.map(c => (
                <div key={c.id} className="p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => setViewCustomer(c)}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {getInitials(c.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                      {c.city && <p className="text-xs text-slate-400">{c.city}{c.state ? `, ${c.state}` : ""}</p>}
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(c)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(c.id, c.name)} disabled={deletingId === c.id}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500 ml-12">
                    {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                    {c.email && <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3" />{c.email}</span>}
                    <span>{c.invoice_count} invoices • {formatCurrency(c.total_purchases)}</span>
                  </div>
                </div>
              ))}
            </div>

            {data.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                <p className="text-sm text-slate-500">
                  {(page - 1) * 10 + 1}–{Math.min(page * 10, data.total)} of {data.total}
                </p>
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

      {/* Customer Detail Drawer */}
      {viewCustomer && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setViewCustomer(null)}>
          <div className="absolute right-0 top-0 bottom-0 w-96 bg-white shadow-2xl overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">Customer Details</h2>
              <button onClick={() => setViewCustomer(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              {/* Avatar + name */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xl font-bold">
                  {getInitials(viewCustomer.name)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{viewCustomer.name}</h3>
                  {viewCustomer.gst_number && (
                    <p className="text-sm text-slate-500">GSTIN: {viewCustomer.gst_number}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5">
                    Customer since {formatDate(viewCustomer.created_at, "MMM yyyy")}
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-blue-600 font-medium">Invoices</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-700">{viewCustomer.invoice_count}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <IndianRupee className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs text-emerald-600 font-medium">Total</span>
                  </div>
                  <p className="text-lg font-bold text-emerald-700">{formatCurrency(viewCustomer.total_purchases)}</p>
                </div>
              </div>

              {/* Contact info */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Contact Information</p>
                {viewCustomer.phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Phone className="w-4 h-4 text-slate-400" /> {viewCustomer.phone}
                  </div>
                )}
                {viewCustomer.email && (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Mail className="w-4 h-4 text-slate-400" /> {viewCustomer.email}
                  </div>
                )}
                {(viewCustomer.address_line1 || viewCustomer.city) && (
                  <div className="flex items-start gap-2 text-sm text-slate-700">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <span>
                      {[viewCustomer.address_line1, viewCustomer.city, viewCustomer.state, viewCustomer.pincode]
                        .filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
              </div>

              {viewCustomer.notes && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Notes</p>
                  <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{viewCustomer.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button onClick={() => openEdit(viewCustomer)}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-slate-200 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
                <a href={`/dashboard/invoices/new?customer_id=${viewCustomer.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                  <FileText className="w-4 h-4" /> New Invoice
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">{editCustomer ? "Edit Customer" : "Add Customer"}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Full Name *</label>
                <input {...register("name")} placeholder="Customer name"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Phone</label>
                  <input {...register("phone")} placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Email</label>
                  <input {...register("email")} type="email" placeholder="email@example.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">GST Number</label>
                <input {...register("gst_number")} placeholder="29AAAAA0000A1Z5"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Address</label>
                <input {...register("address_line1")} placeholder="Street address"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">City</label>
                  <input {...register("city")} placeholder="City"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">State</label>
                  <input {...register("state")} placeholder="State"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Pincode</label>
                  <input {...register("pincode")} placeholder="560001"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Notes</label>
                <textarea {...register("notes")} rows={2} placeholder="Internal notes..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60">
                  {saving ? "Saving..." : editCustomer ? "Update" : "Add Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
