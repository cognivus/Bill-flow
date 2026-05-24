import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// ── Request interceptor: attach JWT ───────────────────────
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token")
        : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: handle 401 ─────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      const refresh_token = localStorage.getItem("refresh_token");
      if (refresh_token) {
        try {
          const res = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
            refresh_token,
          });
          const { access_token, refresh_token: newRefresh } = res.data;
          localStorage.setItem("access_token", access_token);
          localStorage.setItem("refresh_token", newRefresh);

          // Retry original request
          if (error.config) {
            error.config.headers.Authorization = `Bearer ${access_token}`;
            return api.request(error.config);
          }
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/auth/login";
        }
      } else {
        window.location.href = "/auth/login";
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth API ─────────────────────────────────────────────
export const authApi = {
  signup: (data: { email: string; password: string; full_name: string; phone: string }) =>
    api.post("/auth/signup", data),
  verifyOtp: (data: { email: string; otp: string }) =>
    api.post("/auth/verify-otp", data),
  resendOtp: (email: string) =>
    api.post("/auth/resend-otp", { email, otp: "" }),
  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),
  refresh: (refresh_token: string) =>
    api.post("/auth/refresh", { refresh_token }),
  logout: () => api.post("/auth/logout"),
  me: () => api.get("/auth/me"),

  // Forgot / reset password
  forgotPassword: (email: string) =>
    api.post("/auth/forgot-password", { email }),
  verifyResetOtp: (data: { email: string; otp: string }) =>
    api.post("/auth/verify-reset-otp", data),
  resetPassword: (data: { email: string; otp: string; new_password: string }) =>
    api.post("/auth/reset-password", data),
};

// ── Business API ──────────────────────────────────────────
export const businessApi = {
  create: (data: object) => api.post("/businesses", data),
  getMe: () => api.get("/businesses/me"),
  update: (data: object) => api.put("/businesses/me", data),
  uploadLogo: (data: FormData) => 
    api.post("/businesses/me/logo", data, {
      headers: { "Content-Type": "multipart/form-data" }
    }),
  removeLogo: () => api.delete("/businesses/me/logo"),
};

// ── Dashboard API ─────────────────────────────────────────
export const dashboardApi = {
  get: () => api.get("/dashboard"),
};

// ── Products API ──────────────────────────────────────────
export const productsApi = {
  list: (params?: object) => api.get("/products", { params }),
  create: (data: object) => api.post("/products", data),
  get: (id: string) => api.get(`/products/${id}`),
  update: (id: string, data: object) => api.put(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
};

// ── Customers API ─────────────────────────────────────────
export const customersApi = {
  list: (params?: object) => api.get("/customers", { params }),
  create: (data: object) => api.post("/customers", data),
  get: (id: string) => api.get(`/customers/${id}`),
  update: (id: string, data: object) => api.put(`/customers/${id}`, data),
  delete: (id: string) => api.delete(`/customers/${id}`),
  getInvoices: (id: string, params?: object) =>
    api.get(`/customers/${id}/invoices`, { params }),
};

// ── Invoices API ──────────────────────────────────────────
export const invoicesApi = {
  list: (params?: object) => api.get("/invoices", { params }),
  create: (data: object) => api.post("/invoices", data),
  get: (id: string) => api.get(`/invoices/${id}`),
  update: (id: string, data: object) => api.put(`/invoices/${id}`, data),
  delete: (id: string) => api.delete(`/invoices/${id}`),
  downloadPdf: (id: string) =>
    api.get(`/invoices/${id}/pdf`, { responseType: "blob" }),
};

// ── Super Admin API ───────────────────────────────────────
export const adminApi = {
  getStats: () => api.get("/admin/stats"),

  // Users
  listUsers: (params?: object) => api.get("/admin/users", { params }),
  createUser: (data: object) => api.post("/admin/users", data),
  updateUser: (id: string, data: object) => api.patch(`/admin/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),

  // Businesses
  listBusinesses: (params?: object) => api.get("/admin/businesses", { params }),
  toggleBusiness: (id: string) => api.patch(`/admin/businesses/${id}/toggle`),
  deleteBusiness: (id: string) => api.delete(`/admin/businesses/${id}`),
};
