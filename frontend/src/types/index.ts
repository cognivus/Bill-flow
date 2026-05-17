// ─── Auth ─────────────────────────────────────────────────
export type UserRole = "super_admin" | "business_owner" | "staff";

export interface User {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  role: UserRole;
  is_active: boolean;
  avatar_url?: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

// ─── Business ─────────────────────────────────────────────
export interface Business {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  gst_number?: string;
  pan_number?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country: string;
  logo_url?: string;
  invoice_prefix: string;
  invoice_counter: number;
  invoice_notes?: string;
  invoice_terms?: string;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Product ──────────────────────────────────────────────
export interface Product {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  unit: string;
  price: string;
  cost_price?: string;
  gst_percentage: string;
  hsn_code?: string;
  stock_quantity: number;
  low_stock_threshold: number;
  track_inventory: boolean;
  is_active: boolean;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

// ─── Customer ─────────────────────────────────────────────
export interface Customer {
  id: string;
  business_id: string;
  name: string;
  email?: string;
  phone?: string;
  gst_number?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country: string;
  notes?: string;
  total_purchases: string;
  invoice_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerListResponse {
  items: Customer[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

// ─── Invoice ──────────────────────────────────────────────
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "partially_paid" | "overdue" | "cancelled";

export interface InvoiceItem {
  id: string;
  product_id?: string;
  product_name: string;
  product_description?: string;
  hsn_code?: string;
  unit: string;
  quantity: string;
  unit_price: string;
  discount_percentage: string;
  discount_amount: string;
  taxable_amount: string;
  gst_percentage: string;
  cgst_percentage: string;
  sgst_percentage: string;
  igst_percentage: string;
  tax_amount: string;
  total_amount: string;
  sort_order: number;
}

export interface Invoice {
  id: string;
  business_id: string;
  customer_id?: string;
  invoice_number: string;
  status: InvoiceStatus;
  payment_status: PaymentStatus;
  invoice_date: string;
  due_date?: string;
  subtotal: string;
  discount_amount: string;
  discount_percentage: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  total_tax: string;
  grand_total: string;
  amount_paid: string;
  amount_due: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_gst?: string;
  notes?: string;
  terms?: string;
  pdf_url?: string;
  items: InvoiceItem[];
  created_at: string;
  updated_at: string;
}

export interface InvoiceListResponse {
  items: Invoice[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

// ─── Dashboard ────────────────────────────────────────────
export interface DashboardStats {
  total_revenue: string;
  revenue_this_month: string;
  revenue_last_month: string;
  revenue_growth_percent: number;
  total_invoices: number;
  invoices_this_month: number;
  pending_invoices: number;
  overdue_invoices: number;
  total_customers: number;
  new_customers_this_month: number;
  total_products: number;
  low_stock_products: number;
}

export interface DashboardResponse {
  stats: DashboardStats;
  recent_invoices: {
    id: string;
    invoice_number: string;
    customer_name?: string;
    grand_total: string;
    status: InvoiceStatus;
    payment_status: PaymentStatus;
    invoice_date: string;
  }[];
  monthly_revenue: {
    month: string;
    revenue: string;
    invoice_count: number;
  }[];
}

// ─── API ──────────────────────────────────────────────────
export interface ApiError {
  detail: string;
  code?: string;
}

export interface PaginationParams {
  page?: number;
  per_page?: number;
  search?: string;
}
