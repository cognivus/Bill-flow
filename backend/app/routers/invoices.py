"""
Invoices Router - Full CRUD + PDF Generation
"""
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
import math

from app.database.session import get_db
from app.models.models import Invoice, InvoiceItem, Business, InvoiceStatus, PaymentStatus
from app.schemas.schemas import (
    InvoiceCreate, InvoiceUpdate, InvoiceResponse,
    InvoiceListResponse, MessageResponse
)
from app.auth.dependencies import get_current_user, get_current_business
from app.services.invoice_service import create_invoice, generate_invoice_pdf

router = APIRouter()


@router.get("", response_model=InvoiceListResponse)
async def list_invoices(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[InvoiceStatus] = None,
    payment_status: Optional[PaymentStatus] = None,
    customer_id: Optional[UUID] = None,
    search: Optional[str] = None,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Invoice)
        .where(Invoice.business_id == business.id)
        .options(selectinload(Invoice.items))
        .order_by(Invoice.invoice_date.desc())
    )

    if status:
        query = query.where(Invoice.status == status)
    if payment_status:
        query = query.where(Invoice.payment_status == payment_status)
    if customer_id:
        query = query.where(Invoice.customer_id == customer_id)
    if search:
        query = query.where(
            Invoice.invoice_number.ilike(f"%{search}%") |
            Invoice.customer_name.ilike(f"%{search}%")
        )

    total_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar_one()

    offset = (page - 1) * per_page
    result = await db.execute(query.offset(offset).limit(per_page))
    invoices = result.scalars().all()

    return InvoiceListResponse(
        items=[InvoiceResponse.model_validate(i) for i in invoices],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page),
    )


@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_new_invoice(
    data: InvoiceCreate,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    invoice = await create_invoice(db, business, data)
    await db.refresh(invoice)

    result = await db.execute(
        select(Invoice)
        .where(Invoice.id == invoice.id)
        .options(selectinload(Invoice.items))
    )
    invoice = result.scalar_one()
    return InvoiceResponse.model_validate(invoice)


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Invoice)
        .where(Invoice.id == invoice_id, Invoice.business_id == business.id)
        .options(selectinload(Invoice.items))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return InvoiceResponse.model_validate(invoice)


@router.put("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: UUID,
    data: InvoiceUpdate,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Invoice)
        .where(Invoice.id == invoice_id, Invoice.business_id == business.id)
        .options(selectinload(Invoice.items))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    update_data = data.model_dump(exclude_unset=True, exclude={"items"})
    for key, value in update_data.items():
        setattr(invoice, key, value)

    # Update amount_due if payment_status changed
    if data.amount_paid is not None:
        invoice.amount_due = invoice.grand_total - data.amount_paid
        if invoice.amount_due <= 0:
            invoice.payment_status = PaymentStatus.PAID
        elif invoice.amount_paid > 0:
            invoice.payment_status = PaymentStatus.PARTIALLY_PAID

    await db.flush()
    await db.refresh(invoice)

    result = await db.execute(
        select(Invoice)
        .where(Invoice.id == invoice.id)
        .options(selectinload(Invoice.items))
    )
    invoice = result.scalar_one()
    return InvoiceResponse.model_validate(invoice)


@router.delete("/{invoice_id}", response_model=MessageResponse)
async def delete_invoice(
    invoice_id: UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.business_id == business.id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    await db.delete(invoice)
    return MessageResponse(message="Invoice deleted successfully")


@router.get("/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Generate and download PDF invoice."""
    result = await db.execute(
        select(Invoice)
        .where(Invoice.id == invoice_id, Invoice.business_id == business.id)
        .options(selectinload(Invoice.items))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    pdf_bytes = generate_invoice_pdf(invoice, business)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="invoice-{invoice.invoice_number}.pdf"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )
