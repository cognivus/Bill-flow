"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Receipt, Mail, Lock, ArrowRight, ArrowLeft, RefreshCw, Eye, EyeOff } from "lucide-react";
import { authApi, businessApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

// ── Schemas ───────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const forgotEmailSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

const otpSchema = z.object({
  otp: z.string().length(6, "Enter the 6-digit code").regex(/^\d+$/, "Numbers only"),
});

const newPasswordSchema = z.object({
  new_password: z.string().min(8, "Password must be at least 8 characters"),
  confirm_password: z.string().min(1, "Please confirm your password"),
}).refine(d => d.new_password === d.confirm_password, {
  message: "Passwords do not match",
  path: ["confirm_password"],
});

type LoginForm = z.infer<typeof loginSchema>;
type ForgotEmailForm = z.infer<typeof forgotEmailSchema>;
type OtpForm = z.infer<typeof otpSchema>;
type NewPasswordForm = z.infer<typeof newPasswordSchema>;

type Mode = "login" | "forgot_email" | "forgot_otp" | "forgot_newpass";

const RESEND_COOLDOWN = 60;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, setBusiness } = useAuthStore();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const forgotEmailForm = useForm<ForgotEmailForm>({
    resolver: zodResolver(forgotEmailSchema),
    defaultValues: { email: "" },
  });

  const otpForm = useForm<OtpForm>({ resolver: zodResolver(otpSchema) });
  const newPassForm = useForm<NewPasswordForm>({ resolver: zodResolver(newPasswordSchema) });

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  // ── Login ─────────────────────────────────────────────────
  const onLogin = async (data: LoginForm) => {
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
      try {
        const bizRes = await businessApi.getMe();
        setBusiness(bizRes.data);
        toast.success(`Welcome back, ${user.full_name || user.email}!`);
        router.push("/dashboard");
      } catch (bizErr: any) {
        // Only redirect to onboarding if business genuinely doesn't exist
        // A network/server error should NOT send user to onboarding
        if (bizErr.response?.status === 404) {
          setBusiness(null);
          router.push("/onboarding");
        } else {
          // Unknown error — go to dashboard anyway, layout will retry
          toast.success(`Welcome back, ${user.full_name || user.email}!`);
          router.push("/dashboard");
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot: Step 1 — Send OTP ────────────────────────────
  const onForgotEmail = async (data: ForgotEmailForm) => {
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(data.email);
      setResetEmail(data.email);

      const msg: string = res.data?.message || "";
      const otpMatch = msg.match(/OTP:\s*(\d{6})/);
      if (otpMatch) {
        setDevOtp(otpMatch[1]);
        toast.warning("Dev mode — OTP shown on screen");
      } else {
        setDevOtp(null);
        toast.success(`Reset code sent to ${data.email}`);
      }
      startCooldown();
      setMode("forgot_otp");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot: Step 2 — Verify OTP ─────────────────────────
  const onVerifyOtp = async (data: OtpForm) => {
    setLoading(true);
    try {
      await authApi.verifyResetOtp({ email: resetEmail, otp: data.otp });
      setResetOtp(data.otp);
      toast.success("Code verified! Set your new password.");
      setMode("forgot_newpass");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot: Step 3 — Reset Password ─────────────────────
  const onResetPassword = async (data: NewPasswordForm) => {
    setLoading(true);
    try {
      await authApi.resetPassword({
        email: resetEmail,
        otp: resetOtp,
        new_password: data.new_password,
      });
      toast.success("Password reset! Please sign in with your new password.");
      setMode("login");
      loginForm.setValue("email", resetEmail);
      setResetEmail("");
      setResetOtp("");
      newPassForm.reset();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ────────────────────────────────────────────
  const onResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      const res = await authApi.forgotPassword(resetEmail);
      const msg: string = res.data?.message || "";
      const otpMatch = msg.match(/OTP:\s*(\d{6})/);
      if (otpMatch) {
        setDevOtp(otpMatch[1]);
        toast.warning("New OTP shown on screen (dev mode)");
      } else {
        toast.success("New reset code sent!");
      }
      startCooldown();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to resend code");
    } finally {
      setResending(false);
    }
  };

  const goBack = () => {
    if (mode === "forgot_email") setMode("login");
    else if (mode === "forgot_otp") setMode("forgot_email");
    else if (mode === "forgot_newpass") setMode("forgot_otp");
    setDevOtp(null);
  };

  // ── Render ─────────────────────────────────────────────────
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

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Progress bar for forgot password steps */}
          {mode !== "login" && (
            <div className="flex">
              <div className="flex-1 h-1 bg-blue-500" />
              <div className={`flex-1 h-1 transition-colors ${mode === "forgot_otp" || mode === "forgot_newpass" ? "bg-blue-500" : "bg-slate-100"}`} />
              <div className={`flex-1 h-1 transition-colors ${mode === "forgot_newpass" ? "bg-blue-500" : "bg-slate-100"}`} />
            </div>
          )}

          <div className="p-8">

            {/* ── LOGIN ── */}
            {mode === "login" && (
              <>
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
                  <p className="text-slate-500 text-sm mt-1">Access your business dashboard</p>
                </div>

                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        {...loginForm.register("email")}
                        type="email"
                        placeholder="you@company.com"
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                    {loginForm.formState.errors.email && (
                      <p className="text-red-500 text-xs mt-1.5">{loginForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-slate-700">Password</label>
                      <button
                        type="button"
                        onClick={() => { setMode("forgot_email"); forgotEmailForm.setValue("email", loginForm.getValues("email")); }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        {...loginForm.register("password")}
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-11 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                      <button type="button" onClick={() => setShowPassword(p => !p)}
                        className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {loginForm.formState.errors.password && (
                      <p className="text-red-500 text-xs mt-1.5">{loginForm.formState.errors.password.message}</p>
                    )}
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                    {loading
                      ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Signing in...</>
                      : <>Sign In <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                  <p className="text-sm text-slate-500">
                    Don't have an account?{" "}
                    <button onClick={() => router.push("/auth/signup")} className="text-blue-600 font-semibold hover:underline">
                      Create one for free
                    </button>
                  </p>
                </div>
              </>
            )}

            {/* ── FORGOT: Step 1 — Enter Email ── */}
            {mode === "forgot_email" && (
              <>
                <button onClick={goBack} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm mb-6 transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back to sign in
                </button>
                <div className="mb-6">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 text-2xl">🔑</div>
                  <h1 className="text-2xl font-bold text-slate-900">Forgot password?</h1>
                  <p className="text-slate-500 text-sm mt-1">Enter your registered email and we'll send a reset code.</p>
                </div>

                <form onSubmit={forgotEmailForm.handleSubmit(onForgotEmail)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        {...forgotEmailForm.register("email")}
                        type="email"
                        placeholder="you@company.com"
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                    {forgotEmailForm.formState.errors.email && (
                      <p className="text-red-500 text-xs mt-1.5">{forgotEmailForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                    {loading
                      ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending...</>
                      : <>Send Reset Code <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>
              </>
            )}

            {/* ── FORGOT: Step 2 — Enter OTP ── */}
            {mode === "forgot_otp" && (
              <>
                <button onClick={goBack} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm mb-6 transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <div className="mb-6">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 text-2xl">✉️</div>
                  <h1 className="text-2xl font-bold text-slate-900">Check your email</h1>
                  <p className="text-slate-500 text-sm mt-1">
                    We sent a 6-digit code to <span className="font-semibold text-slate-700">{resetEmail}</span>
                  </p>
                </div>

                <form onSubmit={otpForm.handleSubmit(onVerifyOtp)} className="space-y-6">
                  {/* Dev mode OTP banner */}
                  {devOtp && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">⚠️ Dev Mode</p>
                      <p className="text-sm text-amber-800">Reset OTP: <span className="font-mono font-bold text-lg tracking-widest">{devOtp}</span></p>
                    </div>
                  )}

                  <div>
                    <input
                      {...otpForm.register("otp")}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      autoFocus
                      className="w-full px-4 py-4 border border-slate-200 rounded-xl text-3xl font-bold text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                    />
                    {otpForm.formState.errors.otp && (
                      <p className="text-red-500 text-xs mt-1.5 text-center">{otpForm.formState.errors.otp.message}</p>
                    )}
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                    {loading ? "Verifying..." : <>Verify Code <ArrowRight className="w-4 h-4" /></>}
                  </button>

                  <div className="flex items-center justify-center">
                    {cooldown > 0 ? (
                      <p className="text-sm text-slate-400">Resend in <span className="font-semibold text-slate-600">{cooldown}s</span></p>
                    ) : (
                      <button type="button" onClick={onResend} disabled={resending}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 disabled:opacity-50 transition-colors">
                        <RefreshCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
                        {resending ? "Sending..." : "Resend code"}
                      </button>
                    )}
                  </div>
                </form>
              </>
            )}

            {/* ── FORGOT: Step 3 — New Password ── */}
            {mode === "forgot_newpass" && (
              <>
                <button onClick={goBack} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm mb-6 transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <div className="mb-6">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-4 text-2xl">🔒</div>
                  <h1 className="text-2xl font-bold text-slate-900">Set new password</h1>
                  <p className="text-slate-500 text-sm mt-1">Choose a strong password for your account.</p>
                </div>

                <form onSubmit={newPassForm.handleSubmit(onResetPassword)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        {...newPassForm.register("new_password")}
                        type={showNewPass ? "text" : "password"}
                        placeholder="Min. 8 characters"
                        className="w-full pl-10 pr-11 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                      <button type="button" onClick={() => setShowNewPass(p => !p)}
                        className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600">
                        {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {newPassForm.formState.errors.new_password && (
                      <p className="text-red-500 text-xs mt-1.5">{newPassForm.formState.errors.new_password.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        {...newPassForm.register("confirm_password")}
                        type={showNewPass ? "text" : "password"}
                        placeholder="Re-enter your password"
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                    {newPassForm.formState.errors.confirm_password && (
                      <p className="text-red-500 text-xs mt-1.5">{newPassForm.formState.errors.confirm_password.message}</p>
                    )}
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
                    {loading
                      ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Resetting...</>
                      : <>Reset Password <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
