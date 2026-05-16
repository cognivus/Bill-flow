"""
Products Router - Full CRUD with Search & Pagination
"""
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import math

from app.database.session import get_db
from app.models.models import Product, Business
from app.schemas.schemas import (
    ProductCreate, ProductUpdate, ProductResponse,
    ProductListResponse, MessageResponse
)
from app.auth.dependencies import get_current_business

router = APIRouter()


@router.get("", response_model=ProductListResponse)
async def list_products(
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    active_only: bool = True,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    query = select(Product).where(Product.business_id == business.id)
    if active_only:
        query = query.where(Product.is_active == True)
    if search:
        query = query.where(
            Product.name.ilike(f"%{search}%") |
            Product.sku.ilike(f"%{search}%") |
            Product.barcode.ilike(f"%{search}%")
        )
    query = query.order_by(Product.name)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    offset = (page - 1) * per_page
    products = (await db.execute(query.offset(offset).limit(per_page))).scalars().all()

    return ProductListResponse(
        items=[ProductResponse.model_validate(p) for p in products],
        total=total, page=page, per_page=per_page,
        pages=math.ceil(total / per_page),
    )


@router.post("", response_model=ProductResponse, status_code=201)
async def create_product(
    data: ProductCreate,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    product = Product(business_id=business.id, **data.model_dump())
    db.add(product)
    await db.flush()
    await db.refresh(product)
    return ProductResponse.model_validate(product)


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.business_id == business.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return ProductResponse.model_validate(product)


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: UUID,
    data: ProductUpdate,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.business_id == business.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(product, key, value)
    await db.flush()
    await db.refresh(product)
    return ProductResponse.model_validate(product)


@router.delete("/{product_id}", response_model=MessageResponse)
async def delete_product(
    product_id: UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.business_id == business.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False  # Soft delete
    return MessageResponse(message="Product deleted successfully")
