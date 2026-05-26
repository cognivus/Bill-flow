"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Building2, FileText, Save, Upload, Loader2,
  Shield, Globe, Receipt, Trash2, HeadphonesIcon,
} from "lucide-react";
import { businessApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const profileSchema = z.object({
  name: z.string().min(2, "Business name required"),
  gst_number: z.string().optional(),
  pan_number: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  country: z.string().default("India"),
});

const invoiceSchema = z.object({
  invoice_prefix: z.string().min(1).max(8),
  invoice_notes: z.string().optional(),
  invoice_terms: z.string().optional(),
  currency: z.string().default("INR"),
});

type ProfileData = z.infer<typeof profileSchema>;
type InvoiceData = z.infer<typeof invoiceSchema>;

const TABS = [
  { id: "profile", label: "Business Profile", icon: Building2 },
  { id: "invoice", label: "Invoice Settings", icon: FileText },
  { id: "account", label: "Account & Security", icon: Shield },
  { id: "support", label: "Support", icon: HeadphonesIcon },
];

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan",
  "Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Delhi","Jammu & Kashmir","Ladakh","Chandigarh","Puducherry",
];

export default function SettingsPage() {
  const { business, setBusiness, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState("profile");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);

  const profileForm = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: business?.name || "",
      gst_number: business?.gst_number || "",
      pan_number: business?.pan_number || "",
      email: business?.email || "",
      phone: business?.phone || "",
      address_line1: business?.address_line1 || "",
      address_line2: business?.address_line2 || "",
      city: business?.city || "",
      state: business?.state || "",
      pincode: business?.pincode || "",
      country: business?.country || "India",
    },
  });

  const invoiceForm = useForm<InvoiceData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      invoice_prefix: business?.invoice_prefix || "INV",
      invoice_notes: business?.invoice_notes || "",
      invoice_terms: business?.invoice_terms || "",
      currency: business?.currency || "INR",
    },
  });

  // Sync forms when business loads
  useEffect(() => {
    if (business) {
      profileForm.reset({
        name: business.name, gst_number: business.gst_number || "",
        pan_number: business.pan_number || "", email: business.email || "",
        phone: business.phone || "", address_line1: business.address_line1 || "",
        address_line2: business.address_line2 || "", city: business.city || "",
        state: business.state || "", pincode: business.pincode || "",
        country: business.country || "India",
      });
      invoiceForm.reset({
        invoice_prefix: business.invoice_prefix,
        invoice_notes: business.invoice_notes || "",
        invoice_terms: business.invoice_terms || "",
        currency: business.currency || "INR",
      });
    }
  }, [business]);

  const onSaveProfile = async (data: ProfileData) => {
    setSavingProfile(true);
    try {
      const res = await businessApi.update(data);
      setBusiness(res.data);
      toast.success("Business profile updated!");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const onSaveInvoice = async (data: InvoiceData) => {
    setSavingInvoice(true);
    try {
      const res = await businessApi.update(data);
      setBusiness(res.data);
      toast.success("Invoice settings saved!");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to update invoice settings");
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!confirm("Are you sure you want to remove the logo?")) return;
    setRemovingLogo(true);
    const toastId = toast.loading("Removing logo...");
    try {
      const res = await businessApi.removeLogo();
      setBusiness(res.data);
      toast.success("Logo removed!", { id: toastId });
    } catch {
      toast.error("Failed to remove logo", { id: toastId });
    } finally {
      setRemovingLogo(false);
    }
  };

  const inputClass = "w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
  const labelClass = "block text-xs font-medium text-slate-600 mb-1.5";

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your business profile and invoice preferences</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center",
              activeTab === tab.id
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            )}>
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <form onSubmit={profileForm.handleSubmit(onSaveProfile)}
          className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Business Information</h2>
            <p className="text-sm text-slate-500 mt-0.5">This information appears on your invoices</p>
          </div>

          {/* Logo */}
          <div className="p-5 border-b border-slate-100">
            <label className={labelClass}>Business Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-blue-50 border-2 border-dashed border-blue-200 flex items-center justify-center overflow-hidden">
                {business?.logo_url ? (
                  <img src={business.logo_url} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="w-6 h-6 text-blue-400" />
                )}
              </div>
              <div>
                <input
                  type="file"
                  id="logo-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    const formData = new FormData();
                    formData.append("file", file);
                    
                    const toastId = toast.loading("Uploading logo...");
                    try {
                      const res = await businessApi.uploadLogo(formData);
                      setBusiness(res.data);
                      toast.success("Logo uploaded!", { id: toastId });
                    } catch (err) {
                      toast.error("Failed to upload logo", { id: toastId });
                    }
                  }}
                />
                <div className="flex items-center gap-2">
                  <button type="button"
                    onClick={() => document.getElementById("logo-upload")?.click()}
                    className="flex items-center gap-2 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                    <Upload className="w-4 h-4" /> Upload Logo
                  </button>
                  {business?.logo_url && (
                    <button type="button"
                      onClick={handleRemoveLogo}
                      disabled={removingLogo}
                      className="flex items-center gap-2 text-red-500 hover:text-red-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                      {removingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 5MB</p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelClass}>Business Name *</label>
                <input {...profileForm.register("name")} className={inputClass} />
                {profileForm.formState.errors.name && (
                  <p className="text-red-500 text-xs mt-1">{profileForm.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>GST Number</label>
                <input {...profileForm.register("gst_number")} className={`${inputClass} uppercase`} placeholder="29AAAAA0000A1Z5" />
              </div>
              <div>
                <label className={labelClass}>PAN Number</label>
                <input {...profileForm.register("pan_number")} className={`${inputClass} uppercase`} placeholder="AAAAA0000A" />
              </div>
              <div>
                <label className={labelClass}>Business Email</label>
                <input {...profileForm.register("email")} type="email" className={inputClass} placeholder="billing@company.com" />
                {profileForm.formState.errors.email && (
                  <p className="text-red-500 text-xs mt-1">{profileForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Business Phone</label>
                <input {...profileForm.register("phone")} className={inputClass} placeholder="+91 98765 43210" />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Address Line 1</label>
                <input {...profileForm.register("address_line1")} className={inputClass} placeholder="Street, Building" />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Address Line 2</label>
                <input {...profileForm.register("address_line2")} className={inputClass} placeholder="Area, Landmark" />
              </div>
              <div>
                <label className={labelClass}>City</label>
                <input {...profileForm.register("city")} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>State</label>
                <select {...profileForm.register("state")} className={inputClass}>
                  <option value="">Select state</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Pincode</label>
                <input {...profileForm.register("pincode")} className={inputClass} placeholder="560001" />
              </div>
              <div>
                <label className={labelClass}>Country</label>
                <input {...profileForm.register("country")} className={inputClass} />
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-slate-100 bg-slate-50/50">
            <button type="submit" disabled={savingProfile}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60">
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savingProfile ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      )}

      {/* Invoice Settings Tab */}
      {activeTab === "invoice" && (
        <form onSubmit={invoiceForm.handleSubmit(onSaveInvoice)}
          className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Invoice Customization</h2>
            <p className="text-sm text-slate-500 mt-0.5">Customize how your invoices look and feel</p>
          </div>
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Invoice Prefix</label>
                <div className="flex items-center gap-2">
                  <input {...invoiceForm.register("invoice_prefix")} maxLength={8}
                    className={`${inputClass} uppercase font-mono w-32`} />
                  <span className="text-slate-400 text-sm">
                    → {invoiceForm.watch("invoice_prefix") || "INV"}-{String(business?.invoice_counter || 1).padStart(4, "0")}
                  </span>
                </div>
                {invoiceForm.formState.errors.invoice_prefix && (
                  <p className="text-red-500 text-xs mt-1">{invoiceForm.formState.errors.invoice_prefix.message}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Currency</label>
                <select {...invoiceForm.register("currency")} className={inputClass}>
                  <option value="INR">INR – Indian Rupee (₹)</option>
                  <option value="USD">USD – US Dollar ($)</option>
                  <option value="EUR">EUR – Euro (€)</option>
                  <option value="GBP">GBP – British Pound (£)</option>
                  <option value="AED">AED – UAE Dirham</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Default Invoice Notes</label>
              <textarea {...invoiceForm.register("invoice_notes")} rows={3}
                placeholder="e.g. Thank you for your business! Payment due within 30 days."
                className={`${inputClass} resize-none`} />
              <p className="text-xs text-slate-400 mt-1">This text appears at the bottom of every invoice</p>
            </div>

            <div>
              <label className={labelClass}>Default Terms & Conditions</label>
              <textarea {...invoiceForm.register("invoice_terms")} rows={4}
                placeholder="e.g. 1. Goods once sold will not be returned&#10;2. Subject to local jurisdiction&#10;3. E&OE"
                className={`${inputClass} resize-none`} />
              <p className="text-xs text-slate-400 mt-1">Standard T&C printed on every invoice</p>
            </div>

            {/* Preview */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="w-4 h-4 text-slate-500" />
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoice Number Preview</p>
              </div>
              <p className="font-mono text-lg font-bold text-slate-900">
                {invoiceForm.watch("invoice_prefix") || "INV"}-{String(business?.invoice_counter || 1).padStart(4, "0")}
              </p>
              <p className="text-xs text-slate-400 mt-1">Next invoice will use this number</p>
            </div>
          </div>

          <div className="p-5 border-t border-slate-100 bg-slate-50/50">
            <button type="submit" disabled={savingInvoice}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60">
              {savingInvoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savingInvoice ? "Saving..." : "Save Invoice Settings"}
            </button>
          </div>
        </form>
      )}

      {/* Account Tab */}
      {activeTab === "account" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Account Information</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-700">Email</p>
                  <p className="text-sm text-slate-500">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-700">Full Name</p>
                  <p className="text-sm text-slate-500">{user?.full_name || "Not set"}</p>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-700">Role</p>
                  <p className="text-sm text-slate-500 capitalize">{user?.role?.replace("_", " ")}</p>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}
      {/* Support Tab */}
      {activeTab === "support" && (
        <div className="space-y-4">
          {/* Contact card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Get Support</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Need help, found a bug, or want to request a feature? Reach out to us — we're happy to help!
              </p>
            </div>
            <div className="p-5 space-y-3">
              <a href="https://wa.me/919384019167" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors group">
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800">WhatsApp Support</p>
                  <p className="text-xs text-emerald-600">+91 93840 19167 — Fastest response</p>
                </div>
              </a>

              <a href="https://www.instagram.com/cogni_vus/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl border border-pink-200 bg-pink-50 hover:bg-pink-100 transition-colors">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-pink-800">Instagram</p>
                  <p className="text-xs text-pink-600">@cogni_vus</p>
                </div>
              </a>

              <a href="https://www.linkedin.com/company/116544347/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-800">LinkedIn</p>
                  <p className="text-xs text-blue-600">Cognivus</p>
                </div>
              </a>

              <a href="https://www.facebook.com/profile.php?id=61589537544502" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-indigo-800">Facebook</p>
                  <p className="text-xs text-indigo-600">Cognivus</p>
                </div>
              </a>

              <a href="https://github.com/cognivus" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">GitHub</p>
                  <p className="text-xs text-slate-500">github.com/cognivus</p>
                </div>
              </a>
            </div>
          </div>

          {/* About card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">BillFlow</p>
                <p className="text-xs text-slate-400">by Cognivus</p>
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-3">
              BillFlow is built and maintained by Cognivus. We're constantly improving the product — if you have a feature request or run into any issues, reach out!
            </p>
            <a href="https://cognivus-ai.netlify.app/" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline font-medium">
              Visit cognivus-ai.netlify.app →
            </a>
          </div>
        </div>
      )}

    </div>
  );
}
