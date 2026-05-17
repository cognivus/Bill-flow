"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Receipt, User, Mail, Lock, Phone, ArrowRight, RefreshCw } from "lucide-react";
import { authApi, businessApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

const signupSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(10, "Enter a valid phone number").max(15, "Phone number too long"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits").regex(/^\d+$/, "Numbers only"),
});

type SignupForm = z.infer<typeof signupSchema>;
type OtpForm = z.infer<typeof otpSchema>;

const RESEND_COOLDOWN = 60; // seconds

export default function SignupPage() {
  const router = useRouter();
  const { setAuth, setBusiness } = useAuthStore();
  const [step, setStep] = useState<"signup" | "otp">("signup");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  // Cooldown timer: counts down from 60 to 0
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const signupForm = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { full_name: "", email: "", phone: "", password: "" },
  });

  const otpForm = useForm<OtpForm>({ resolver: zodResolver(otpSchema) });

  // Start cooldown timer
  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Clean up timer on unmount
  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  const onSignup = async (data: SignupForm) => {
    setLoading(true);
    try {
      await authApi.signup({
        email: data.email,
        password: data.password,
        full_name: data.full_name,
        phone: data.phone,
      });
      setEmail(data.email);
      setStep("otp");
      startCooldown();
      toast.success(`Verification code sent to ${data.email}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOtp = async (data: OtpForm) => {
    setLoading(true);
    try {
      const res = await authApi.verifyOtp({ email, otp: data.otp });
      const { access_token, refresh_token, user } = res.data;
      setAuth(user, access_token, refresh_token);
      toast.success("Account verified successfully!");
      try {
        const bizRes = await businessApi.getMe();
        setBusiness(bizRes.data);
        router.push("/dashboard");
      } catch {
        setBusiness(null);
        router.push("/onboarding");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  // FIX: Use dedicated /resend-otp endpoint (not full /signup)
  // FIX: Enforce 60-second client-side cooldown
  const onResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      await authApi.resendOtp(email);
      toast.success("New code sent!");
      startCooldown();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to resend code");
    } finally {
      setResending(false);
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

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Step indicator */}
          <div className="flex">
            <div className={`flex-1 h-1 transition-colors ${step === "signup" ? "bg-blue-500" : "bg-blue-200"}`} />
            <div className={`flex-1 h-1 transition-colors ${step === "otp" ? "bg-blue-500" : "bg-slate-100"}`} />
          </div>

          <div className="p-8">
            {step === "signup" ? (
              <>
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-slate-900">Create account</h1>
                  <p className="text-slate-500 text-sm mt-1">Start your free trial</p>
                </div>

                <form onSubmit={signupForm.handleSubmit(onSignup)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        {...signupForm.register("full_name")}
                        placeholder="John Doe"
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                    {signupForm.formState.errors.full_name && (
                      <p className="text-red-500 text-xs mt-1.5">{signupForm.formState.errors.full_name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        {...signupForm.register("email")}
                        type="email"
                        placeholder="you@company.com"
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                    {signupForm.formState.errors.email && (
                      <p className="text-red-500 text-xs mt-1.5">{signupForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone number</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        {...signupForm.register("phone")}
                        type="tel"
                        placeholder="+91 9876543210"
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                    {signupForm.formState.errors.phone && (
                      <p className="text-red-500 text-xs mt-1.5">{signupForm.formState.errors.phone.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        {...signupForm.register("password")}
                        type="password"
                        placeholder="Min. 8 characters"
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                    {signupForm.formState.errors.password && (
                      <p className="text-red-500 text-xs mt-1.5">{signupForm.formState.errors.password.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating account...</>
                    ) : (
                      <>Create Account <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center">
                  <p className="text-sm text-slate-500">
                    Already have an account?{" "}
                    <button onClick={() => router.push("/auth/login")} className="text-blue-600 font-semibold hover:underline">
                      Sign in
                    </button>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="mb-6">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-4 text-2xl">✉️</div>
                  <h1 className="text-2xl font-bold text-slate-900">Verify your email</h1>
                  <p className="text-slate-500 text-sm mt-1">
                    We've sent a code to <span className="font-semibold text-slate-700">{email}</span>
                  </p>
                </div>

                <form onSubmit={otpForm.handleSubmit(onVerifyOtp)} className="space-y-6">
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

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {loading ? "Verifying..." : "Verify Code"}
                  </button>

                  {/* FIX: Cooldown timer prevents spam; dedicated resend-otp endpoint */}
                  <div className="flex items-center justify-center">
                    {cooldown > 0 ? (
                      <p className="text-sm text-slate-400">
                        Resend in <span className="font-semibold text-slate-600">{cooldown}s</span>
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={onResend}
                        disabled={resending}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 disabled:opacity-50 transition-colors"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
                        {resending ? "Sending..." : "Resend code"}
                      </button>
                    )}
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
