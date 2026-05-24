"""
Pydantic Schemas - Request/Response Validation
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Any
from uuid import UUID
from pydantic import BaseModel, EmailStr, field_validator, model_validator, ConfigDict

from app.models.models import (
    UserRole, PaymentStatus, InvoiceStatus
)


# ─── Base Config ───────────────────────────────────
class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Auth Schemas ──────────────────────────────────
class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyResetOtpRequest(BaseModel):
    email: EmailStr
    otp: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "ProfileResponse"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# ─── Profile Schemas ───────────────────────────────
class ProfileResponse(BaseSchema):
    id: UUID
    email: str
    full_name: Optional[str]
    phone: Optional[str]
    role: str
    is_active: bool
    avatar_url: Optional[str]
    created_at: datetime


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None


# ─── Business Schemas ──────────────────────────────
class BusinessCreate(BaseModel):
    name: str
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: str = "India"
    invoice_prefix: str = "INV"
    currency: str = "INR"


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    invoice_prefix: Optional[str] = None
    invoice_notes: Optional[str] = None
    invoice_terms: Optional[str] = None
    currency: Optional[str] = None
    country: Optional[str] = None
    settings: Optional[dict] = None


class BusinessResponse(BaseSchema):
    id: UUID
    owner_id: UUID
    name: str
    slug: str
    gst_number: Optional[str]
    pan_number: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    address_line1: Optional[str]
    address_line2: Optional[str]
    city: Optional[str]
    state: Optional[str]
    pincode: Optional[str]
    country: str
    logo_url: Optional[str]
    invoice_prefix: str
    invoice_counter: int
    invoice_notes: Optional[str]
    invoice_terms: Optional[str]
    currency: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ─── Product Schemas ───────────────────────────────
class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    unit: str = "pcs"
    price: Decimal
    cost_price: Optional[Decimal] = None
    gst_percentage: Decimal = Decimal("0.00")
    hsn_code: Optional[str] = None
    stock_quantity: int = 0
    low_stock_threshold: int = 5
    track_inventory: bool = True

    @field_validator("price", "gst_percentage")
    @classmethod
    def validate_decimal(cls, v):
        if v < 0:
            raise ValueError("Value cannot be negative")
        return v


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    unit: Optional[str] = None
    price: Optional[Decimal] = None
    cost_price: Optional[Decimal] = None
    gst_percentage: Optional[Decimal] = None
    hsn_code: Optional[str] = None
    stock_quantity: Optional[int] = None
    low_stock_threshold: Optional[int] = None
    track_inventory: Optional[bool] = None
    is_active: Optional[bool] = None


class ProductResponse(BaseSchema):
    id: UUID
    business_id: UUID
    name: str
    description: Optional[str]
    sku: Optional[str]
    barcode: Optional[str]
    unit: str
    price: Decimal
    cost_price: Optional[Decimal]
    gst_percentage: Decimal
    hsn_code: Optional[str]
    stock_quantity: int
    low_stock_threshold: int
    track_inventory: bool
    is_active: bool
    image_url: Optional[str]
    created_at: datetime
    updated_at: datetime


class ProductListResponse(BaseModel):
    items: List[ProductResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ─── Customer Schemas ──────────────────────────────
class CustomerCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    gst_number: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: str = "India"
    notes: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    gst_number: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class CustomerResponse(BaseSchema):
    id: UUID
    business_id: UUID
    name: str
    email: Optional[str]
    phone: Optional[str]
    gst_number: Optional[str]
    address_line1: Optional[str]
    address_line2: Optional[str]
    city: Optional[str]
    state: Optional[str]
    pincode: Optional[str]
    country: str
    notes: Optional[str]
    total_purchases: Decimal
    invoice_count: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CustomerListResponse(BaseModel):
    items: List[CustomerResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ─── Invoice Schemas ───────────────────────────────
class InvoiceItemCreate(BaseModel):
    product_id: Optional[UUID] = None
    product_name: str
    product_description: Optional[str] = None
    hsn_code: Optional[str] = None
    unit: str = "pcs"
    quantity: Decimal
    unit_price: Decimal
    discount_percentage: Decimal = Decimal("0.00")
    gst_percentage: Decimal = Decimal("0.00")
    is_igst: bool = False  # True for inter-state, False for intra-state

    @field_validator("quantity", "unit_price")
    @classmethod
    def validate_positive(cls, v):
        if v <= 0:
            raise ValueError("Value must be positive")
        return v


class InvoiceCreate(BaseModel):
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    customer_gst: Optional[str] = None
    invoice_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    status: InvoiceStatus = InvoiceStatus.DRAFT
    discount_percentage: Decimal = Decimal("0.00")
    notes: Optional[str] = None
    terms: Optional[str] = None
    items: List[InvoiceItemCreate]

    @model_validator(mode="after")
    def validate_items(self):
        if not self.items:
            raise ValueError("Invoice must have at least one item")
        return self


class InvoiceUpdate(BaseModel):
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    customer_gst: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[InvoiceStatus] = None
    payment_status: Optional[PaymentStatus] = None
    discount_percentage: Optional[Decimal] = None
    amount_paid: Optional[Decimal] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    items: Optional[List[InvoiceItemCreate]] = None


class InvoiceItemResponse(BaseSchema):
    id: UUID
    product_id: Optional[UUID]
    product_name: str
    product_description: Optional[str]
    hsn_code: Optional[str]
    unit: str
    quantity: Decimal
    unit_price: Decimal
    discount_percentage: Decimal
    discount_amount: Decimal
    taxable_amount: Decimal
    gst_percentage: Decimal
    cgst_percentage: Decimal
    sgst_percentage: Decimal
    igst_percentage: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    sort_order: int


class InvoiceResponse(BaseSchema):
    id: UUID
    business_id: UUID
    customer_id: Optional[UUID]
    invoice_number: str
    status: str
    payment_status: str
    invoice_date: datetime
    due_date: Optional[datetime]
    subtotal: Decimal
    discount_amount: Decimal
    discount_percentage: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    total_tax: Decimal
    grand_total: Decimal
    amount_paid: Decimal
    amount_due: Decimal
    customer_name: Optional[str]
    customer_email: Optional[str]
    customer_phone: Optional[str]
    customer_address: Optional[str]
    customer_gst: Optional[str]
    notes: Optional[str]
    terms: Optional[str]
    pdf_url: Optional[str]
    items: List[InvoiceItemResponse] = []
    created_at: datetime
    updated_at: datetime


class InvoiceListResponse(BaseModel):
    items: List[InvoiceResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ─── Dashboard Schemas ─────────────────────────────
class DashboardStats(BaseModel):
    total_revenue: Decimal
    revenue_this_month: Decimal
    revenue_last_month: Decimal
    revenue_growth_percent: float
    total_invoices: int
    invoices_this_month: int
    pending_invoices: int
    overdue_invoices: int
    total_customers: int
    new_customers_this_month: int
    total_products: int
    low_stock_products: int


class RecentInvoice(BaseModel):
    id: UUID
    invoice_number: str
    customer_name: Optional[str]
    grand_total: Decimal
    status: str
    payment_status: str
    invoice_date: datetime


class MonthlyRevenue(BaseModel):
    month: str
    revenue: Decimal
    invoice_count: int


class DashboardResponse(BaseModel):
    stats: DashboardStats
    recent_invoices: List[RecentInvoice]
    monthly_revenue: List[MonthlyRevenue]


# ─── Common Schemas ────────────────────────────────
class MessageResponse(BaseModel):
    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None
