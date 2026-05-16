"use client";
import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, Search, Edit2, Trash2, Package, X,
  ChevronLeft, ChevronRight, Tag, AlertTriangle,
} from "lucide-react";
import { productsApi } from "@/lib/api";
import { Product, ProductListResponse } from "@/types";
import { formatCurrency, cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1, "Name required"),
  description: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  unit: z.string().default("pcs"),
  price: z.coerce.number().positive("Price must be positive"),
  cost_price: z.coerce.number().min(0).optional(),
  gst_percentage: z.coerce.number().min(0).max(100).default(18),
  hsn_code: z.string().optional(),
  stock_quantity: z.coerce.number().int().min(0).default(0),
  low_stock_threshold: z.coerce.number().int().min(0).default(5),
  track_inventory: z.boolean().default(true),
});
type FormData = z.infer<typeof schema>;

const GST_RATES = [0, 5, 12, 18, 28];
const UNITS = ["pcs", "kg", "g", "l", "ml", "m", "cm", "box", "set", "pair", "dozen"];

export default function ProductsPage() {
  const [data, setData] = useState<ProductListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { gst_percentage: 18, stock_quantity: 0, low_stock_threshold: 5, unit: "pcs", track_inventory: true },
  });

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, per_page: 12 };
      if (search) params.search = search;
      const res = await productsApi.list(params);
      setData(res.data);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openCreate = () => {
    setEditProduct(null);
    reset({ gst_percentage: 18, stock_quantity: 0, low_stock_threshold: 5, unit: "pcs", track_inventory: true });
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    reset({
      name: p.name,
      description: p.description || "",
      sku: p.sku || "",
      barcode: p.barcode || "",
      unit: p.unit,
      price: parseFloat(p.price),
      cost_price: p.cost_price ? parseFloat(p.cost_price) : undefined,
      gst_percentage: parseFloat(p.gst_percentage),
      hsn_code: p.hsn_code || "",
      stock_quantity: p.stock_quantity,
      low_stock_threshold: p.low_stock_threshold,
      track_inventory: p.track_inventory,
    });
    setShowModal(true);
  };

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      if (editProduct) {
        await productsApi.update(editProduct.id, data);
        toast.success("Product updated");
      } else {
        await productsApi.create(data);
        toast.success("Product created");
      }
      setShowModal(false);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await productsApi.delete(id);
      toast.success("Product deleted");
      fetchProducts();
    } catch {
      toast.error("Failed to delete product");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="text-sm text-slate-500 mt-0.5">{data ? `${data.total} products` : "Loading..."}</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, SKU or barcode..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
              <div className="w-12 h-12 bg-slate-200 rounded-xl mb-3" />
              <div className="h-4 bg-slate-200 rounded w-32 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-20" />
            </div>
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No products yet</p>
          <p className="text-slate-400 text-sm mt-1">Add products to start creating invoices</p>
          <button onClick={openCreate}
            className="mt-4 inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> Add First Product
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.items.map(p => (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Package className="w-6 h-6 text-blue-500" />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(p)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(p.id, p.name)} disabled={deletingId === p.id}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-slate-900 text-sm mb-0.5 truncate">{p.name}</h3>
                {p.sku && <p className="text-xs text-slate-400 mb-2">SKU: {p.sku}</p>}

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                  <div>
                    <p className="text-base font-bold text-blue-600">{formatCurrency(p.price)}</p>
                    <p className="text-xs text-slate-400">GST {p.gst_percentage}%</p>
                  </div>
                  <div className="text-right">
                    {p.track_inventory ? (
                      <div className={cn(
                        "flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium",
                        p.stock_quantity <= p.low_stock_threshold
                          ? "bg-amber-50 text-amber-700"
                          : "bg-emerald-50 text-emerald-700"
                      )}>
                        {p.stock_quantity <= p.low_stock_threshold && <AlertTriangle className="w-3 h-3" />}
                        {p.stock_quantity} {p.unit}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">Service</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-600 px-2">{page} / {data.pages}</span>
              <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">{editProduct ? "Edit Product" : "Add Product"}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Product Name *</label>
                  <input {...register("name")} placeholder="Product name"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Description</label>
                  <textarea {...register("description")} rows={2} placeholder="Optional description"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">SKU</label>
                  <input {...register("sku")} placeholder="SKU-001"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Barcode</label>
                  <input {...register("barcode")} placeholder="123456789"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Selling Price (₹) *</label>
                  <input {...register("price")} type="number" step="0.01" min="0" placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Cost Price (₹)</label>
                  <input {...register("cost_price")} type="number" step="0.01" min="0" placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">GST Rate</label>
                  <select {...register("gst_percentage")}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Unit</label>
                  <select {...register("unit")}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">HSN Code</label>
                  <input {...register("hsn_code")} placeholder="HSN code"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Stock Qty</label>
                  <input {...register("stock_quantity")} type="number" min="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Low Stock Alert</label>
                  <input {...register("low_stock_threshold")} type="number" min="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input {...register("track_inventory")} type="checkbox" id="track_inv" className="rounded" />
                  <label htmlFor="track_inv" className="text-sm text-slate-700 cursor-pointer">Track inventory for this product</label>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60">
                  {saving ? "Saving..." : editProduct ? "Update Product" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
