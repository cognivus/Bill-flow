"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Building2, FileText, Save, Upload, Loader2,
  Shield, Globe, Receipt, Trash2,
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
    </div>
  );
}
