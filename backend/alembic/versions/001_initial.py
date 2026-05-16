"""Initial schema - all tables

Revision ID: 001_initial
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enums
    op.execute("CREATE TYPE user_role AS ENUM ('super_admin', 'business_owner', 'staff')")
    op.execute("CREATE TYPE subscription_plan AS ENUM ('free', 'starter', 'professional', 'enterprise')")
    op.execute("CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'partially_paid', 'overdue', 'cancelled')")
    op.execute("CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled')")

    # profiles
    op.create_table('profiles',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('role', sa.Enum('super_admin', 'business_owner', 'staff', name='user_role'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('avatar_url', sa.Text(), nullable=True),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
    )
    op.create_index('ix_profiles_email', 'profiles', ['email'])
    op.create_index('ix_profiles_role', 'profiles', ['role'])

    # businesses
    op.create_table('businesses',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('gst_number', sa.String(20), nullable=True),
        sa.Column('pan_number', sa.String(15), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('address_line1', sa.String(255), nullable=True),
        sa.Column('address_line2', sa.String(255), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('state', sa.String(100), nullable=True),
        sa.Column('pincode', sa.String(10), nullable=True),
        sa.Column('country', sa.String(100), nullable=False, server_default='India'),
        sa.Column('logo_url', sa.Text(), nullable=True),
        sa.Column('subscription_plan', sa.Enum('free', 'starter', 'professional', 'enterprise', name='subscription_plan'), nullable=False, server_default='free'),
        sa.Column('subscription_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('invoice_prefix', sa.String(10), nullable=False, server_default='INV'),
        sa.Column('invoice_counter', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('invoice_notes', sa.Text(), nullable=True),
        sa.Column('invoice_terms', sa.Text(), nullable=True),
        sa.Column('currency', sa.String(3), nullable=False, server_default='INR'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('settings', postgresql.JSONB(), nullable=True, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['owner_id'], ['profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('owner_id'),
        sa.UniqueConstraint('slug'),
    )
    op.create_index('ix_businesses_owner_id', 'businesses', ['owner_id'])
    op.create_index('ix_businesses_slug', 'businesses', ['slug'])

    # products
    op.create_table('products',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('sku', sa.String(100), nullable=True),
        sa.Column('barcode', sa.String(100), nullable=True),
        sa.Column('unit', sa.String(20), nullable=False, server_default='pcs'),
        sa.Column('price', sa.Numeric(12, 2), nullable=False),
        sa.Column('cost_price', sa.Numeric(12, 2), nullable=True),
        sa.Column('gst_percentage', sa.Numeric(5, 2), nullable=False, server_default='0'),
        sa.Column('hsn_code', sa.String(20), nullable=True),
        sa.Column('stock_quantity', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('low_stock_threshold', sa.Integer(), nullable=False, server_default='5'),
        sa.Column('track_inventory', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('image_url', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_products_business_id', 'products', ['business_id'])
    op.create_index('ix_products_barcode', 'products', ['barcode'])

    # customers
    op.create_table('customers',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('gst_number', sa.String(20), nullable=True),
        sa.Column('address_line1', sa.String(255), nullable=True),
        sa.Column('address_line2', sa.String(255), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('state', sa.String(100), nullable=True),
        sa.Column('pincode', sa.String(10), nullable=True),
        sa.Column('country', sa.String(100), nullable=False, server_default='India'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('total_purchases', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('invoice_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_customers_business_id', 'customers', ['business_id'])

    # invoices
    op.create_table('invoices',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('invoice_number', sa.String(50), nullable=False),
        sa.Column('status', sa.Enum('draft','sent','paid','overdue','cancelled', name='invoice_status'), nullable=False),
        sa.Column('payment_status', sa.Enum('pending','paid','partially_paid','overdue','cancelled', name='payment_status'), nullable=False),
        sa.Column('invoice_date', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('subtotal', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('discount_amount', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('discount_percentage', sa.Numeric(5, 2), nullable=False, server_default='0'),
        sa.Column('cgst_amount', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('sgst_amount', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('igst_amount', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('total_tax', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('grand_total', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('amount_paid', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('amount_due', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('customer_name', sa.String(255), nullable=True),
        sa.Column('customer_email', sa.String(255), nullable=True),
        sa.Column('customer_phone', sa.String(20), nullable=True),
        sa.Column('customer_address', sa.Text(), nullable=True),
        sa.Column('customer_gst', sa.String(20), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('terms', sa.Text(), nullable=True),
        sa.Column('pdf_url', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('business_id', 'invoice_number', name='uq_invoice_number_per_business'),
    )
    op.create_index('ix_invoices_business_id', 'invoices', ['business_id'])
    op.create_index('ix_invoices_customer_id', 'invoices', ['customer_id'])
    op.create_index('ix_invoices_status', 'invoices', ['status'])
    op.create_index('ix_invoices_date', 'invoices', ['invoice_date'])

    # invoice_items
    op.create_table('invoice_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('invoice_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('product_name', sa.String(255), nullable=False),
        sa.Column('product_description', sa.Text(), nullable=True),
        sa.Column('hsn_code', sa.String(20), nullable=True),
        sa.Column('unit', sa.String(20), nullable=False, server_default='pcs'),
        sa.Column('quantity', sa.Numeric(10, 3), nullable=False),
        sa.Column('unit_price', sa.Numeric(12, 2), nullable=False),
        sa.Column('discount_percentage', sa.Numeric(5, 2), nullable=False, server_default='0'),
        sa.Column('discount_amount', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('taxable_amount', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('gst_percentage', sa.Numeric(5, 2), nullable=False, server_default='0'),
        sa.Column('cgst_percentage', sa.Numeric(5, 2), nullable=False, server_default='0'),
        sa.Column('sgst_percentage', sa.Numeric(5, 2), nullable=False, server_default='0'),
        sa.Column('igst_percentage', sa.Numeric(5, 2), nullable=False, server_default='0'),
        sa.Column('tax_amount', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('total_amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_invoice_items_invoice_id', 'invoice_items', ['invoice_id'])


def downgrade() -> None:
    op.drop_table('invoice_items')
    op.drop_table('invoices')
    op.drop_table('customers')
    op.drop_table('products')
    op.drop_table('businesses')
    op.drop_table('profiles')
    op.execute("DROP TYPE IF EXISTS invoice_status")
    op.execute("DROP TYPE IF EXISTS payment_status")
    op.execute("DROP TYPE IF EXISTS subscription_plan")
    op.execute("DROP TYPE IF EXISTS user_role")
