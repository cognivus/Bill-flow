"""
SQLAlchemy ORM Models - Multi-tenant SaaS Billing Platform
"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import (
    String, Text, Boolean, Integer, Numeric, ForeignKey,
    DateTime, Enum as SAEnum, Index, UniqueConstraint, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.database.session import Base


def utcnow():
    return datetime.now(timezone.utc)


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    BUSINESS_OWNER = "business_owner"
    STAFF = "staff"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    PARTIALLY_PAID = "partially_paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


# ─── PROFILES ────────────────────────────────────────────
class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    role: Mapped[UserRole] = mapped_column(SAEnum('super_admin', 'business_owner', 'staff', name='user_role', create_constraint=False), default=UserRole.BUSINESS_OWNER, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text)

    # Auth fields
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255))
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # OTP fields
    otp_secret: Mapped[Optional[str]] = mapped_column(String(255))        # current OTP code (hashed)
    otp_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))  # expiry
    otp_fail_count: Mapped[int] = mapped_column(Integer, default=0)

    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    business: Mapped[Optional["Business"]] = relationship(back_populates="owner")

    __table_args__ = (
        Index("ix_profiles_email", "email"),
        Index("ix_profiles_role", "role"),
    )


# ─── BUSINESSES ──────────────────────────────────────────
class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    gst_number: Mapped[Optional[str]] = mapped_column(String(20))
    pan_number: Mapped[Optional[str]] = mapped_column(String(15))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    address_line1: Mapped[Optional[str]] = mapped_column(String(255))
    address_line2: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(100))
    pincode: Mapped[Optional[str]] = mapped_column(String(10))
    country: Mapped[str] = mapped_column(String(100), default="India")
    logo_url: Mapped[Optional[str]] = mapped_column(Text)
    invoice_prefix: Mapped[str] = mapped_column(String(10), default="INV")
    invoice_counter: Mapped[int] = mapped_column(Integer, default=1)
    invoice_notes: Mapped[Optional[str]] = mapped_column(Text)
    invoice_terms: Mapped[Optional[str]] = mapped_column(Text)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    settings: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    owner: Mapped["Profile"] = relationship(back_populates="business")
    products: Mapped[List["Product"]] = relationship(back_populates="business", cascade="all, delete-orphan")
    customers: Mapped[List["Customer"]] = relationship(back_populates="business", cascade="all, delete-orphan")
    invoices: Mapped[List["Invoice"]] = relationship(back_populates="business", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_businesses_owner_id", "owner_id"),
        Index("ix_businesses_slug", "slug"),
    )


# ─── PRODUCTS ────────────────────────────────────────────
class Product(Base):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    sku: Mapped[Optional[str]] = mapped_column(String(100))
    barcode: Mapped[Optional[str]] = mapped_column(String(100))
    unit: Mapped[str] = mapped_column(String(20), default="pcs")
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    cost_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    gst_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"))
    hsn_code: Mapped[Optional[str]] = mapped_column(String(20))
    stock_quantity: Mapped[int] = mapped_column(Integer, default=0)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=5)
    track_inventory: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    image_url: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    business: Mapped["Business"] = relationship(back_populates="products")
    invoice_items: Mapped[List["InvoiceItem"]] = relationship(back_populates="product")

    __table_args__ = (
        Index("ix_products_business_id", "business_id"),
        Index("ix_products_barcode", "barcode"),
    )


# ─── CUSTOMERS ───────────────────────────────────────────
class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    gst_number: Mapped[Optional[str]] = mapped_column(String(20))
    address_line1: Mapped[Optional[str]] = mapped_column(String(255))
    address_line2: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(100))
    pincode: Mapped[Optional[str]] = mapped_column(String(10))
    country: Mapped[str] = mapped_column(String(100), default="India")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    total_purchases: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    invoice_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    business: Mapped["Business"] = relationship(back_populates="customers")
    invoices: Mapped[List["Invoice"]] = relationship(back_populates="customer")

    __table_args__ = (
        Index("ix_customers_business_id", "business_id"),
        Index("ix_customers_phone", "business_id", "phone"),
    )


# ─── INVOICES ────────────────────────────────────────────
class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    invoice_number: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[InvoiceStatus] = mapped_column(SAEnum('draft', 'sent', 'paid', 'overdue', 'cancelled', name='invoice_status', create_constraint=False), default=InvoiceStatus.DRAFT)
    payment_status: Mapped[PaymentStatus] = mapped_column(SAEnum('pending', 'paid', 'partially_paid', 'overdue', 'cancelled', name='payment_status', create_constraint=False), default=PaymentStatus.PENDING)
    invoice_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    discount_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"))
    cgst_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    sgst_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    igst_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    total_tax: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    grand_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    amount_due: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    customer_name: Mapped[Optional[str]] = mapped_column(String(255))
    customer_email: Mapped[Optional[str]] = mapped_column(String(255))
    customer_phone: Mapped[Optional[str]] = mapped_column(String(20))
    customer_address: Mapped[Optional[str]] = mapped_column(Text)
    customer_gst: Mapped[Optional[str]] = mapped_column(String(20))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    terms: Mapped[Optional[str]] = mapped_column(Text)
    pdf_url: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    business: Mapped["Business"] = relationship(back_populates="invoices")
    customer: Mapped[Optional["Customer"]] = relationship(back_populates="invoices")
    items: Mapped[List["InvoiceItem"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("business_id", "invoice_number", name="uq_invoice_number_per_business"),
        Index("ix_invoices_business_id", "business_id"),
        Index("ix_invoices_customer_id", "customer_id"),
        Index("ix_invoices_status", "status"),
        Index("ix_invoices_date", "invoice_date"),
    )


# ─── INVOICE ITEMS ───────────────────────────────────────
class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    product_description: Mapped[Optional[str]] = mapped_column(Text)
    hsn_code: Mapped[Optional[str]] = mapped_column(String(20))
    unit: Mapped[str] = mapped_column(String(20), default="pcs")
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    discount_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"))
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    taxable_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    gst_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"))
    cgst_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"))
    sgst_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"))
    igst_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"))
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    invoice: Mapped["Invoice"] = relationship(back_populates="items")
    product: Mapped[Optional["Product"]] = relationship(back_populates="invoice_items")

    __table_args__ = (
        Index("ix_invoice_items_invoice_id", "invoice_id"),
    )
