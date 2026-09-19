from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Outlet  # Adjust import to match your model name
from app.schemas.schemas import OutletOut  # Adjust to your Pydantic schema

router = APIRouter(prefix="/outlets", tags=["outlets"])


# 1. LIST ALL OUTLETS (No ID required)
@router.get("", response_model=List[OutletOut])
@router.get("/", response_model=List[OutletOut], include_in_schema=False)
async def list_outlets(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Outlet))
    outlets = result.scalars().all()
    return outlets


# 2. GET SINGLE OUTLET BY ID (Detail route)
@router.get("/{outlet_id}", response_model=OutletOut)
async def get_outlet(outlet_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Outlet).where(Outlet.id == outlet_id))
    outlet = result.scalar_one_or_none()
    if not outlet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Outlet not found",
        )
    return outlet