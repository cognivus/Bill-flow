"""
Customers Router - Full CRUD with Purchase History
"""
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
import math

from app.database.session import get_db
from app.models.models import Customer, Invoice, Business
from app.schemas.schemas import (
    CustomerCreate, CustomerUpdate, CustomerResponse,
    CustomerListResponse, MessageResponse, InvoiceResponse
)
from app.auth.dependencies import get_current_business

router = APIRouter()


@router.get("", response_model=CustomerListResponse)
async def list_customers(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    query = select(Customer).where(
        Customer.business_id == business.id, Customer.is_active == True
    )
    if search:
        query = query.where(
            Customer.name.ilike(f"%{search}%") |
            Customer.phone.ilike(f"%{search}%") |
            Customer.email.ilike(f"%{search}%")
        )
    query = query.order_by(Customer.name)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    offset = (page - 1) * per_page
    customers = (await db.execute(query.offset(offset).limit(per_page))).scalars().all()

    return CustomerListResponse(
        items=[CustomerResponse.model_validate(c) for c in customers],
        total=total, page=page, per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 1,
    )


@router.post("", response_model=CustomerResponse, status_code=201)
async def create_customer(
    data: CustomerCreate,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    customer = Customer(business_id=business.id, **data.model_dump())
    db.add(customer)
    await db.flush()
    await db.refresh(customer)
    return CustomerResponse.model_validate(customer)


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.business_id == business.id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return CustomerResponse.model_validate(customer)


@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: UUID,
    data: CustomerUpdate,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.business_id == business.id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(customer, key, value)
    await db.flush()
    await db.refresh(customer)
    return CustomerResponse.model_validate(customer)


@router.delete("/{customer_id}", response_model=MessageResponse)
async def delete_customer(
    customer_id: UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.business_id == business.id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    # Soft delete — flush to persist
    customer.is_active = False
    await db.flush()
    return MessageResponse(message="Customer deleted successfully")


@router.get("/{customer_id}/invoices")
async def get_customer_invoices(
    customer_id: UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Get purchase history for a customer."""
    query = select(Invoice).where(
        Invoice.customer_id == customer_id,
        Invoice.business_id == business.id
    ).order_by(Invoice.invoice_date.desc())

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    offset = (page - 1) * per_page
    invoices = (await db.execute(query.offset(offset).limit(per_page))).scalars().all()

    return {
        "items": [InvoiceResponse.model_validate(i) for i in invoices],
        "total": total, "page": page, "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }
