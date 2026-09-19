from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.models import Product, OutletProductAvailability
from app.schemas.schemas import ProductOut

router = APIRouter(prefix="/menu", tags=["Menu"])


@router.get("", response_model=List[ProductOut])
async def get_menu(
    outlet_id: Optional[UUID] = None,
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Product).options(selectinload(Product.modifiers))

    if category and category != "all":
        query = query.where(Product.category == category)

    products = (await db.execute(query)).scalars().all()

    # If an outlet is selected, override is_available per outlet
    if outlet_id:
        avail_stmt = select(OutletProductAvailability).where(
            OutletProductAvailability.outlet_id == outlet_id
        )
        avail_records = (await db.execute(avail_stmt)).scalars().all()
        avail_map = {rec.product_id: rec.is_available for rec in avail_records}

        # Dynamically set is_available based on outlet override
        for prod in products:
            if prod.id in avail_map:
                prod.is_available = avail_map[prod.id]

    return products


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(product_id: UUID, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Product)
        .options(selectinload(Product.modifiers))
        .where(Product.id == product_id)
    )
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    return product