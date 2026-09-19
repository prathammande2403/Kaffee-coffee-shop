from decimal import Decimal
from typing import List
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.database import get_db
from app.models.models import Product, User, UserFavorite
from app.schemas.schemas import FavoriteCreate, FavoriteOut

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("", response_model=List[FavoriteOut])
async def list_user_favorites(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(UserFavorite)
        .options(selectinload(UserFavorite.product))
        .where(UserFavorite.user_id == current_user.id)
        .order_by(UserFavorite.created_at.desc())
    )
    result = await db.execute(stmt)
    fav_records = result.scalars().all()

    output = []
    for fav in fav_records:
        product = fav.product
        if not product:
            continue

        raw_price = getattr(product, "base_price", getattr(product, "price", Decimal("0.00")))
        base_price = Decimal(str(raw_price))
        
        # Calculate total price for this customized drink
        mod_total = Decimal("0.00")
        for mod in fav.selected_modifiers:
            mod_total += Decimal(str(mod.get("price_delta", 0)))

        calculated_price = base_price + mod_total

        output.append(
            FavoriteOut(
                id=fav.id,
                product_id=product.id,
                product_name=product.name,
                product_image=getattr(product, "image_url", None),
                base_price=base_price,
                label=fav.label or product.name,
                selected_modifiers=fav.selected_modifiers,
                calculated_price=calculated_price,
                is_available=getattr(product, "is_available", True),
                created_at=fav.created_at,
            )
        )

    return output


@router.post("", response_model=FavoriteOut, status_code=status.HTTP_201_CREATED)
async def create_custom_favorite(
    payload: FavoriteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify product exists
    product = await db.get(Product, payload.product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    # Convert Pydantic modifier models to JSON-serializable dicts
    serialized_mods = [mod.model_dump(mode="json") for mod in payload.selected_modifiers]

    new_fav = UserFavorite(
        id=uuid4(),
        user_id=current_user.id,
        product_id=product.id,
        label=payload.label or product.name,
        selected_modifiers=serialized_mods,
    )
    db.add(new_fav)
    await db.commit()
    await db.refresh(new_fav, ["product"])

    raw_price = getattr(product, "base_price", getattr(product, "price", Decimal("0.00")))
    base_price = Decimal(str(raw_price))
    mod_total = sum(Decimal(str(m.get("price_delta", 0))) for m in serialized_mods)

    return FavoriteOut(
        id=new_fav.id,
        product_id=product.id,
        product_name=product.name,
        product_image=getattr(product, "image_url", None),
        base_price=base_price,
        label=new_fav.label,
        selected_modifiers=new_fav.selected_modifiers,
        calculated_price=base_price + mod_total,
        is_available=getattr(product, "is_available", True),
        created_at=new_fav.created_at,
    )


@router.delete("/{favorite_id}", status_code=status.HTTP_200_OK)
async def delete_favorite(
    favorite_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = delete(UserFavorite).where(
        UserFavorite.id == favorite_id,
        UserFavorite.user_id == current_user.id
    )
    result = await db.execute(stmt)
    await db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Favorite preset not found")

    return {"detail": "Favorite preset removed"}