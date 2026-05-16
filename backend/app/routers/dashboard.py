"""
Dashboard Router - Analytics & Statistics
"""
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case, desc

from app.database.session import get_db
from app.models.models import Invoice, Customer, Product, Business, InvoiceStatus, PaymentStatus
from app.schemas.schemas import (
    DashboardResponse, DashboardStats, RecentInvoice, MonthlyRevenue
)
from app.auth.dependencies import get_current_business

router = APIRouter()


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    start_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    start_last_month = (start_this_month - timedelta(days=1)).replace(day=1)
    # Using 35 days back to ensure we cover the full last month regardless of duration
    bid = business.id

    # ── 1. Aggregated Revenue Stats ────────────────────────
    # Combine total, this month, and last month revenue in one pass if possible, 
    # but separate for clarity and slight complexity in filters.
    # We can at least use a single query for this month's stats.
    
    rev_stats = await db.execute(
        select(
            func.coalesce(func.sum(Invoice.grand_total), 0).label("total"),
            func.coalesce(func.sum(case((Invoice.invoice_date >= start_this_month, Invoice.grand_total), else_=0)), 0).label("this_month"),
            func.coalesce(func.sum(case((and_(Invoice.invoice_date >= start_last_month, Invoice.invoice_date < start_this_month), Invoice.grand_total), else_=0)), 0).label("last_month")
        ).where(Invoice.business_id == bid, Invoice.payment_status == PaymentStatus.PAID)
    )
    rev_row = rev_stats.fetchone()
    total_rev = rev_row.total
    this_month_rev = rev_row.this_month
    last_month_rev = rev_row.last_month

    growth = 0.0
    if last_month_rev and last_month_rev > 0:
        growth = float((this_month_rev - last_month_rev) / last_month_rev * 100)

    # ── 2. Aggregated Invoice Counts ──────────────────────
    inv_stats = await db.execute(
        select(
            func.count(Invoice.id).label("total"),
            func.count(case((Invoice.invoice_date >= start_this_month, Invoice.id))).label("this_month"),
            func.count(case((Invoice.payment_status == PaymentStatus.PENDING, Invoice.id))).label("pending"),
            func.count(case((Invoice.payment_status == PaymentStatus.OVERDUE, Invoice.id))).label("overdue")
        ).where(Invoice.business_id == bid)
    )
    inv_row = inv_stats.fetchone()

    # ── 3. Customer & Product Stats ──────────────────────
    cust_stats = await db.execute(
        select(
            func.count(Customer.id).label("total"),
            func.count(case((Customer.created_at >= start_this_month, Customer.id))).label("new_this_month")
        ).where(Customer.business_id == bid, Customer.is_active == True)
    )
    cust_row = cust_stats.fetchone()

    prod_stats = await db.execute(
        select(
            func.count(Product.id).label("total"),
            func.count(case((and_(Product.track_inventory == True, Product.stock_quantity <= Product.low_stock_threshold), Product.id))).label("low_stock")
        ).where(Product.business_id == bid, Product.is_active == True)
    )
    prod_row = prod_stats.fetchone()

    # ── 4. Recent Invoices ───────────────────────────
    recent_result = await db.execute(
        select(Invoice)
        .where(Invoice.business_id == bid)
        .order_by(Invoice.invoice_date.desc())
        .limit(10)
    )
    recent = recent_result.scalars().all()

    # ── 5. Monthly Revenue (optimized) ───────────
    # Get last 6 months using date truncation/formatting
    month_trunc = func.date_trunc('month', Invoice.invoice_date)
    monthly_result = await db.execute(
        select(
            month_trunc.label("month"),
            func.sum(Invoice.grand_total).label("revenue"),
            func.count(Invoice.id).label("count")
        )
        .where(Invoice.business_id == bid, Invoice.invoice_date >= now - timedelta(days=180))
        .group_by(month_trunc)
        .order_by(month_trunc.desc())
    )
    monthly_rows = monthly_result.fetchall()
    
    monthly = [
        MonthlyRevenue(
            month=row.month.strftime("%b %Y"),
            revenue=Decimal(str(row.revenue)),
            invoice_count=row.count,
        ) for row in monthly_rows
    ]

    return DashboardResponse(
        stats=DashboardStats(
            total_revenue=Decimal(str(total_rev)),
            revenue_this_month=Decimal(str(this_month_rev)),
            revenue_last_month=Decimal(str(last_month_rev)),
            revenue_growth_percent=round(growth, 1),
            total_invoices=inv_row.total,
            invoices_this_month=inv_row.this_month,
            pending_invoices=inv_row.pending,
            overdue_invoices=inv_row.overdue,
            total_customers=cust_row.total,
            new_customers_this_month=cust_row.new_this_month,
            total_products=prod_row.total,
            low_stock_products=prod_row.low_stock,
        ),
        recent_invoices=[
            RecentInvoice(
                id=inv.id,
                invoice_number=inv.invoice_number,
                customer_name=inv.customer_name,
                grand_total=inv.grand_total,
                status=inv.status,
                payment_status=inv.payment_status,
                invoice_date=inv.invoice_date,
            )
            for inv in recent
        ],
        monthly_revenue=monthly,
    )
