-- =====================================================
-- BillFlow - Complete Database Schema v2
-- OTP-based auth, no subscription plans
-- Run this in Supabase SQL Editor
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ENUMS
CREATE TYPE user_role AS ENUM ('super_admin', 'business_owner', 'staff');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'partially_paid', 'overdue', 'cancelled');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');

-- ─── PROFILES (Password + OTP Verification) ──────────────
CREATE TABLE profiles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255),         -- New: for password-based auth
    full_name       VARCHAR(255),
    phone           VARCHAR(20),
    role            user_role NOT NULL DEFAULT 'business_owner',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE, -- New: verification status
    avatar_url      TEXT,
    otp_secret      VARCHAR(64),          -- current 6-digit OTP
    otp_expires_at  TIMESTAMPTZ,          -- OTP expiry (10 minutes)
    otp_fail_count  INTEGER DEFAULT 0,    -- New: brute force protection
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_profiles_email ON profiles(email);
CREATE INDEX ix_profiles_role ON profiles(role);

-- ─── BUSINESSES ───────────────────────────────────────────
CREATE TABLE businesses (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id            UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    slug                VARCHAR(100) UNIQUE NOT NULL,
    gst_number          VARCHAR(20),
    pan_number          VARCHAR(15),
    email               VARCHAR(255),
    phone               VARCHAR(20),
    address_line1       VARCHAR(255),
    address_line2       VARCHAR(255),
    city                VARCHAR(100),
    state               VARCHAR(100),
    pincode             VARCHAR(10),
    country             VARCHAR(100) NOT NULL DEFAULT 'India',
    logo_url            TEXT,
    invoice_prefix      VARCHAR(10) NOT NULL DEFAULT 'INV',
    invoice_counter     INTEGER NOT NULL DEFAULT 1,
    invoice_notes       TEXT,
    invoice_terms       TEXT,
    currency            VARCHAR(3) NOT NULL DEFAULT 'INR',
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    settings            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_businesses_owner_id ON businesses(owner_id);
CREATE INDEX ix_businesses_slug ON businesses(slug);

-- ─── PRODUCTS ─────────────────────────────────────────────
CREATE TABLE products (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    sku                 VARCHAR(100),
    barcode             VARCHAR(100),
    unit                VARCHAR(20) NOT NULL DEFAULT 'pcs',
    price               NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    cost_price          NUMERIC(12, 2),
    gst_percentage      NUMERIC(5, 2) NOT NULL DEFAULT 0,
    hsn_code            VARCHAR(20),
    stock_quantity      INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    track_inventory     BOOLEAN NOT NULL DEFAULT TRUE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    image_url           TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_products_business_id ON products(business_id);
CREATE INDEX ix_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX ix_products_name_trgm ON products USING gin(name gin_trgm_ops);

-- ─── CUSTOMERS ────────────────────────────────────────────
CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255),
    phone           VARCHAR(20),
    gst_number      VARCHAR(20),
    address_line1   VARCHAR(255),
    address_line2   VARCHAR(255),
    city            VARCHAR(100),
    state           VARCHAR(100),
    pincode         VARCHAR(10),
    country         VARCHAR(100) NOT NULL DEFAULT 'India',
    notes           TEXT,
    total_purchases NUMERIC(14, 2) NOT NULL DEFAULT 0,
    invoice_count   INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_customers_business_id ON customers(business_id);
CREATE INDEX ix_customers_phone ON customers(business_id, phone) WHERE phone IS NOT NULL;

-- ─── INVOICES ─────────────────────────────────────────────
CREATE TABLE invoices (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id         UUID REFERENCES customers(id) ON DELETE SET NULL,
    invoice_number      VARCHAR(50) NOT NULL,
    status              invoice_status NOT NULL DEFAULT 'draft',
    payment_status      payment_status NOT NULL DEFAULT 'pending',
    invoice_date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date            TIMESTAMPTZ,
    subtotal            NUMERIC(14, 2) NOT NULL DEFAULT 0,
    discount_amount     NUMERIC(14, 2) NOT NULL DEFAULT 0,
    discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
    cgst_amount         NUMERIC(14, 2) NOT NULL DEFAULT 0,
    sgst_amount         NUMERIC(14, 2) NOT NULL DEFAULT 0,
    igst_amount         NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_tax           NUMERIC(14, 2) NOT NULL DEFAULT 0,
    grand_total         NUMERIC(14, 2) NOT NULL DEFAULT 0,
    amount_paid         NUMERIC(14, 2) NOT NULL DEFAULT 0,
    amount_due          NUMERIC(14, 2) NOT NULL DEFAULT 0,
    customer_name       VARCHAR(255),
    customer_email      VARCHAR(255),
    customer_phone      VARCHAR(20),
    customer_address    TEXT,
    customer_gst        VARCHAR(20),
    notes               TEXT,
    terms               TEXT,
    pdf_url             TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(business_id, invoice_number)
);

CREATE INDEX ix_invoices_business_id ON invoices(business_id);
CREATE INDEX ix_invoices_customer_id ON invoices(customer_id);
CREATE INDEX ix_invoices_payment_status ON invoices(business_id, payment_status);
CREATE INDEX ix_invoices_date ON invoices(business_id, invoice_date DESC);

-- ─── INVOICE ITEMS ────────────────────────────────────────
CREATE TABLE invoice_items (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id          UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id          UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name        VARCHAR(255) NOT NULL,
    product_description TEXT,
    hsn_code            VARCHAR(20),
    unit                VARCHAR(20) NOT NULL DEFAULT 'pcs',
    quantity            NUMERIC(10, 3) NOT NULL CHECK (quantity > 0),
    unit_price          NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
    discount_amount     NUMERIC(12, 2) NOT NULL DEFAULT 0,
    taxable_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,
    gst_percentage      NUMERIC(5, 2) NOT NULL DEFAULT 0,
    cgst_percentage     NUMERIC(5, 2) NOT NULL DEFAULT 0,
    sgst_percentage     NUMERIC(5, 2) NOT NULL DEFAULT 0,
    igst_percentage     NUMERIC(5, 2) NOT NULL DEFAULT 0,
    tax_amount          NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_amount        NUMERIC(12, 2) NOT NULL,
    sort_order          INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX ix_invoice_items_invoice_id ON invoice_items(invoice_id);

-- ─── AUTO updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','businesses','products','customers','invoices']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t, t
    );
  END LOOP;
END $$;

-- ─── RLS ──────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (used by the FastAPI backend)
CREATE POLICY "service_role_all" ON profiles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON businesses FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON products FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON customers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON invoices FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON invoice_items FOR ALL USING (auth.role() = 'service_role');
