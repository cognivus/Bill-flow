"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Receipt, Mail, ArrowRight, RefreshCw } from "lucide-react";
import { authApi, businessApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, setBusiness } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const form = useForm<LoginForm>({ 
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" }
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const res = await authApi.login(data);
      const { access_token, refresh_token, user } = res.data;
      setAuth(user, access_token, refresh_token);

      if (user.role === "super_admin") {
        toast.success(`Welcome back, ${user.full_name || "Admin"}!`);
        router.push("/admin");
        return;
      }

      // Try to load business
      try {
        const bizRes = await businessApi.getMe();
        setBusiness(bizRes.data);
        toast.success(`Welcome back, ${user.full_name || user.email}!`);
        router.push("/dashboard");
      } catch {
        setBusiness(null);
        router.push("/onboarding");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-11 h-11 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">BillFlow</span>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
            <p className="text-slate-500 text-sm mt-1">Access your business dashboard</p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
              <input
                {...form.register("email")}
                type="email"
                placeholder="you@company.com"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
              {form.formState.errors.email && (
                <p className="text-red-500 text-xs mt-1.5">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input
                {...form.register("password")}
                type="password"
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
              {form.formState.errors.password && (
                <p className="text-red-500 text-xs mt-1.5">{form.formState.errors.password.message}</p>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Signing in...</>
              ) : (
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center">
            <p className="text-sm text-slate-500">
              Don't have an account?{" "}
              <button onClick={() => router.push("/auth/signup")} className="text-blue-600 font-semibold hover:underline">
                Create one for free
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
