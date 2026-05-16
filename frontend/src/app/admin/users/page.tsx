"use client";
import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Users, Plus, X, Trash2, Shield, ChevronLeft, ChevronRight } from "lucide-react";
import { adminApi } from "@/lib/api";
import { formatDate, getInitials, cn } from "@/lib/utils";
import { toast } from "sonner";

const createSchema = z.object({
  email: z.string().email("Enter a valid email"),
  full_name: z.string().min(2, "Name required"),
  phone: z.string().optional(),
  role: z.enum(["business_owner", "staff", "super_admin"]),
});
type CreateForm = z.infer<typeof createSchema>;

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-red-100 text-red-700",
  business_owner: "bg-blue-100 text-blue-700",
  staff: "bg-slate-100 text-slate-600",
};

export default function AdminUsersPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: "business_owner" },
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, per_page: 15 };
      if (search) params.search = search;
      const res = await adminApi.listUsers(params);
      setData(res.data);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const onCreateUser = async (formData: CreateForm) => {
    setSaving(true);
    try {
      await adminApi.createUser(formData);
      toast.success("User created — they can log in with OTP");
      setShowModal(false);
      reset();
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user: any) => {
    setActionId(user.id);
    try {
      await adminApi.updateUser(user.id, { is_active: !user.is_active });
      toast.success(`User ${user.is_active ? "deactivated" : "activated"}`);
      fetchUsers();
    } catch { toast.error("Failed to update"); }
    finally { setActionId(null); }
  };

  const handleRoleChange = async (user: any, role: string) => {
    if (user.role === "super_admin") return;
    try {
      await adminApi.updateUser(user.id, { role });
      toast.success("Role updated");
      fetchUsers();
    } catch { toast.error("Failed to update role"); }
  };

  const handleDelete = async (user: any) => {
    if (!confirm(`Deactivate "${user.email}"?`)) return;
    setActionId(user.id);
    try {
      await adminApi.deleteUser(user.id);
      toast.success("User deactivated");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally { setActionId(null); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500">{data ? `${data.total} total` : "Loading..."}</p>
        </div>
        <button onClick={() => { reset(); setShowModal(true); }}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by email or name..."
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
            <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500">No users found</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["User", "Business", "Role", "Status", "Last Login", "Actions"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.items.map((u: any) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                          u.role === "super_admin" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                        )}>
                          {getInitials(u.full_name || u.email)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{u.full_name || "—"}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{u.business_name || <span className="text-slate-300">—</span>}</td>
                    <td className="px-5 py-3.5">
                      {u.role === "super_admin" ? (
                        <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", ROLE_COLORS[u.role])}>
                          super_admin
                        </span>
                      ) : (
                        <select value={u.role} onChange={e => handleRoleChange(u, e.target.value)}
                          className={cn("text-xs px-2 py-1 rounded-full font-semibold border-0 outline-none cursor-pointer", ROLE_COLORS[u.role])}>
                          <option value="business_owner">business_owner</option>
                          <option value="staff">staff</option>
                        </select>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn("text-xs px-2 py-1 rounded-full font-medium",
                        u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {u.last_login_at ? formatDate(u.last_login_at) : "Never"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        {u.role !== "super_admin" && (
                          <>
                            <button onClick={() => handleToggleActive(u)}
                              disabled={actionId === u.id}
                              className={cn("px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40",
                                u.is_active
                                  ? "text-red-500 hover:bg-red-50"
                                  : "text-emerald-600 hover:bg-emerald-50")}>
                              {u.is_active ? "Deactivate" : "Activate"}
                            </button>
                            <button onClick={() => handleDelete(u)}
                              disabled={actionId === u.id}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                <p className="text-sm text-slate-500">{data.total} users</p>
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

      {/* Create User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-red-500" /> Create User
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onCreateUser)} className="p-5 space-y-4">
              <p className="text-sm text-slate-500 bg-blue-50 rounded-lg p-3">
                📧 The user will log in using Email OTP — no password needed.
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Full Name *</label>
                <input {...register("full_name")} placeholder="Raj Kumar"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Email *</label>
                <input {...register("email")} type="email" placeholder="user@example.com"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Phone</label>
                <input {...register("phone")} placeholder="+91 98765 43210"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Role *</label>
                <select {...register("role")} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white">
                  <option value="business_owner">Business Owner</option>
                  <option value="staff">Staff</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60">
                  {saving ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
