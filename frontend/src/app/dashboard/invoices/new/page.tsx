"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, Trash2, Search, ChevronDown, ArrowLeft,
  Package, IndianRupee, Save, Loader2,
} from "lucide-react";
import { invoicesApi, customersApi, productsApi } from "@/lib/api";
import { Customer, Product } from "@/types";
import { formatCurrency, cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";

// ── Item Schema ───────────────────────────────────────────
const itemSchema = z.object({
  product_id: z.string().optional(),
  product_name: z.string().min(1, "Item name required"),
  hsn_code: z.string().optional(),
  unit: z.string().default("pcs"),
  quantity: z.coerce.number().positive("Qty must be > 0"),
  unit_price: z.coerce.number().positive("Price must be > 0"),
  discount_percentage: z.coerce.number().min(0).max(100).default(0),
  gst_percentage: z.coerce.number().min(0).max(100).default(0),
  is_igst: z.boolean().default(false),
});

const schema = z.object({
  customer_id: z.string().optional(),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  customer_address: z.string().optional(),
  customer_gst: z.string().optional(),
  due_date: z.string().optional(),
  discount_percentage: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(itemSchema).min(1, "Add at least one item"),
});
type FormData = z.infer<typeof schema>;

// ── Item calculations ─────────────────────────────────────
function calcItem(item: { quantity: number; unit_price: number; discount_percentage: number; gst_percentage: number; is_igst: boolean }) {
  const gross = item.quantity * item.unit_price;
  const discAmt = gross * (item.discount_percentage / 100);
  const taxable = gross - discAmt;
  const taxAmt = taxable * (item.gst_percentage / 100);
  return { taxable, taxAmt, total: taxable + taxAmt, discAmt };
}

export default function NewInvoicePage() {
  const router = useRouter();
  const { business } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);
  const [showProductDrop, setShowProductDrop] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      discount_percentage: 0,
      items: [{ product_name: "", unit: "pcs", quantity: 1, unit_price: 0, discount_percentage: 0, gst_percentage: 18, is_igst: false }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items");
  const watchedDiscount = watch("discount_percentage") || 0;

  // Load customers & products
  useEffect(() => {
    customersApi.list({ per_page: 100 })
      .then(r => setCustomers(r.data.items))
      .catch((err) => toast.error("Failed to load customers"));
      
    setLoadingProducts(true);
    productsApi.list({ per_page: 500 })
      .then(r => setProducts(r.data.items))
      .catch((err) => toast.error("Failed to load products"))
      .finally(() => setLoadingProducts(false));
  }, []);

  // Filter helpers
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone && c.phone.includes(customerSearch))
  );
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  );

  // Totals
  const itemTotals = watchedItems.map(item => calcItem({
    quantity: Number(item.quantity) || 0,
    unit_price: Number(item.unit_price) || 0,
    discount_percentage: Number(item.discount_percentage) || 0,
    gst_percentage: Number(item.gst_percentage) || 0,
    is_igst: item.is_igst || false,
  }));
  const subtotal = itemTotals.reduce((s, i) => s + i.taxable, 0);
  const totalTax = itemTotals.reduce((s, i) => s + i.taxAmt, 0);
  const invDiscount = subtotal * (Number(watchedDiscount) / 100);
  const grandTotal = subtotal + totalTax - invDiscount;

  const selectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setValue("customer_id", c.id);
    setValue("customer_name", c.name);
    setValue("customer_phone", c.phone || "");
    setValue("customer_address", [c.address_line1, c.city, c.state].filter(Boolean).join(", "));
    setValue("customer_gst", c.gst_number || "");
    setShowCustomerDrop(false);
    setCustomerSearch(c.name);
  };

  // Auto-fill customer if name matches exactly
  useEffect(() => {
    if (customerSearch && !selectedCustomer) {
      const match = customers.find(c => c.name.toLowerCase() === customerSearch.trim().toLowerCase());
      if (match) {
        selectCustomer(match);
      }
    }
  }, [customerSearch, customers, selectedCustomer]);

  const selectProduct = (index: number, p: Product) => {
    setValue(`items.${index}.product_id`, p.id);
    setValue(`items.${index}.product_name`, p.name);
    setValue(`items.${index}.unit_price`, parseFloat(p.price));
    setValue(`items.${index}.gst_percentage`, parseFloat(p.gst_percentage));
    setValue(`items.${index}.hsn_code`, p.hsn_code || "");
    setValue(`items.${index}.unit`, p.unit);
    setShowProductDrop(null);
    setProductSearch("");
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const payload = {
        ...data,
        status: "sent",
        due_date: data.due_date ? new Date(data.due_date).toISOString() : undefined,
        items: data.items.map(item => ({
          ...item,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          discount_percentage: Number(item.discount_percentage) || 0,
          gst_percentage: Number(item.gst_percentage) || 0,
        })),
      };
      const res = await invoicesApi.create(payload);
      toast.success(`Invoice ${res.data.invoice_number} created!`);
      router.push(`/dashboard/invoices/${res.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to create invoice");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.back()}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="page-title">New Invoice</h1>
          <p className="text-sm text-slate-500">Preview: {business?.invoice_prefix}-{String(business?.invoice_counter || 1).padStart(4, "0")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left: Main form */}
        <div className="xl:col-span-2 space-y-5">
          {/* Customer */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">1</span>
              Customer
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input value={customerSearch}
                onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true); }}
                onFocus={() => setShowCustomerDrop(true)}
                placeholder="Search or type customer name..."
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {showCustomerDrop && filteredCustomers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredCustomers.map(c => (
                    <button key={c.id} type="button" onClick={() => selectCustomer(c)}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors">
                      <p className="text-sm font-medium text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-400">{c.phone} {c.gst_number ? `• GST: ${c.gst_number}` : ""}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedCustomer ? (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-900">{selectedCustomer.name}</p>
                  <p className="text-xs text-blue-600">{selectedCustomer.phone} {selectedCustomer.gst_number && `• ${selectedCustomer.gst_number}`}</p>
                </div>
                <button type="button" onClick={() => {
                  setSelectedCustomer(null);
                  setCustomerSearch("");
                  setValue("customer_id", "");
                }} className="text-blue-400 hover:text-blue-600 text-xs">Change</button>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                  <input {...register("customer_name")} placeholder="Walk-in Customer"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                  <input {...register("customer_phone")} placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
                  <input {...register("customer_address")} placeholder="City, State"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
              Items
            </h3>

            <div className="space-y-3">
              {fields.map((field, idx) => {
                const tot = itemTotals[idx];
                return (
                  <div key={field.id} className="border border-slate-200 rounded-xl p-4 space-y-3 hover:border-blue-200 transition-colors">
                    {/* Product name with search */}
                      <div className="relative group">
                        <Package className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search or type product name..."
                          {...register(`items.${idx}.product_name`, {
                            onChange: (e) => {
                              const val = e.target.value;
                              setProductSearch(val);
                              setShowProductDrop(idx);
                            }
                          })}
                          onFocus={() => { 
                            const currentVal = watch(`items.${idx}.product_name`);
                            setProductSearch(currentVal || "");
                            setShowProductDrop(idx); 
                          }}
                          onBlur={() => {
                            setTimeout(() => setShowProductDrop(null), 200);
                          }}
                          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      {showProductDrop === idx && (
                        <div className="absolute z-[100] w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-2xl max-h-60 overflow-y-auto ring-1 ring-black ring-opacity-5">
                          {filteredProducts.length > 0 ? (
                            filteredProducts.slice(0, 15).map(p => (
                              <button key={p.id} type="button" 
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => selectProduct(idx, p)}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0">
                                <div className="flex items-center justify-between font-medium">
                                  <p className="text-sm text-slate-800">{p.name}</p>
                                  <p className="text-sm text-blue-600 font-bold">{formatCurrency(p.price)}</p>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase font-bold">{p.unit}</span>
                                  <p className="text-xs text-slate-400">GST: {p.gst_percentage}% {p.sku ? `• SKU: ${p.sku}` : ""}</p>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-6 text-center">
                              {loadingProducts ? (
                                <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto mb-2" />
                              ) : (
                                <>
                                  <p className="text-sm text-slate-500 italic">No products found.</p>
                                  <p className="text-[10px] text-slate-400 uppercase font-bold mt-1 tracking-tight">
                                    {products.length === 0 ? "Your product catalog is empty" : "Type to use as custom item"}
                                  </p>
                                  {products.length === 0 && (
                                    <button type="button" 
                                      onClick={() => {
                                        setLoadingProducts(true);
                                        productsApi.list({ per_page: 100 })
                                          .then((r: any) => setProducts(r.data.items))
                                          .catch(() => toast.error("Failed to refresh products"))
                                          .finally(() => setLoadingProducts(false));
                                      }}
                                      className="text-xs text-blue-600 font-semibold mt-3 hover:underline">
                                      Click to Refresh
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {errors.items?.[idx]?.product_name && (
                        <p className="text-red-500 text-xs mt-1">{errors.items[idx]?.product_name?.message}</p>
                      )}
                    </div>

                    {/* Row: qty, price, discount, gst */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Qty</label>
                        <input {...register(`items.${idx}.quantity`)} type="number" min="0.001" step="0.001"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        {errors.items?.[idx]?.quantity && (
                          <p className="text-red-500 text-xs mt-0.5">{errors.items[idx]?.quantity?.message}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Price (₹)</label>
                        <input {...register(`items.${idx}.unit_price`)} type="number" min="0" step="0.01"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        {errors.items?.[idx]?.unit_price && (
                          <p className="text-red-500 text-xs mt-0.5">{errors.items[idx]?.unit_price?.message}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Disc%</label>
                        <input {...register(`items.${idx}.discount_percentage`)} type="number" min="0" max="100" step="0.01"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">GST%</label>
                        <select {...register(`items.${idx}.gst_percentage`)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                          {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Item total + delete */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>Taxable: {formatCurrency(tot?.taxable || 0)}</span>
                        <span>Tax: {formatCurrency(tot?.taxAmt || 0)}</span>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" {...register(`items.${idx}.is_igst`)} className="rounded" />
                          IGST
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{formatCurrency(tot?.total || 0)}</span>
                        {fields.length > 1 && (
                          <button type="button" onClick={() => remove(idx)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button type="button"
              onClick={() => append({ product_name: "", unit: "pcs", quantity: 1, unit_price: 0, discount_percentage: 0, gst_percentage: 18, is_igst: false })}
              className="mt-3 w-full border-2 border-dashed border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Add Item
            </button>
            {errors.items?.root && <p className="text-red-500 text-xs mt-2">{errors.items.root.message}</p>}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">3</span>
              Notes & Terms
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Notes</label>
                <textarea {...register("notes")} rows={3} placeholder="Thank you for your business!"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Terms & Conditions</label>
                <textarea {...register("terms")} rows={3} placeholder="Payment due within 30 days..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Summary */}
        <div className="space-y-5">
          {/* Due date */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4">Invoice Details</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Due Date</label>
                <input {...register("due_date")} type="date"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Invoice Discount %</label>
                <input {...register("discount_percentage")} type="number" min="0" max="100" step="0.01"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm sticky top-4">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-blue-600" />
              Summary
            </h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              {invDiscount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount ({watchedDiscount}%)</span>
                  <span>-{formatCurrency(invDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Total Tax (GST)</span>
                <span className="font-medium">{formatCurrency(totalTax)}</span>
              </div>
              <div className="border-t border-slate-100 pt-2.5 flex justify-between">
                <span className="font-bold text-slate-900">Grand Total</span>
                <span className="font-bold text-blue-600 text-base">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="mt-5 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
              ) : (
                <><Save className="w-4 h-4" /> Create Invoice</>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
