import math
from typing import List
from uuid import UUID,uuid4
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from app.api.deps import get_current_staff
from app.core.config import settings
from app.database import get_db
from app.models.models import LoyaltyTransaction, Order, Product, User, ProductModifier,OutletProductAvailability
from app.schemas.schemas import (
    OrderOut,
    OrderStatusUpdate,
    ProductAvailabilityUpdate,
    ProductOut,
)

router = APIRouter(prefix="/staff", tags=["Staff Dashboard"])

# Finite State Machine for valid order lifecycles
VALID_STATE_TRANSITIONS = {
    "ORDER_RECEIVED": ["PREPARING", "CANCELLED"],
    "PREPARING": ["READY_FOR_PICKUP", "CANCELLED"],
    "READY_FOR_PICKUP": ["COMPLETED"],
    "COMPLETED": [],
    "CANCELLED": [],
}


@router.get("/orders", response_model=List[OrderOut])
async def get_staff_orders(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_staff),
):
    stmt = (
        select(Order)
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch("/orders/{order_id}/status", response_model=OrderOut)
async def update_order_status(
    order_id: UUID,
    payload: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_staff),
):
    stmt = (
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order_id)
        .with_for_update()
    )
    order = (await db.execute(stmt)).scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    next_status = payload.status
    allowed_transitions = VALID_STATE_TRANSITIONS.get(order.status, [])

    if next_status not in allowed_transitions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid state transition: '{order.status}' to '{next_status}'",
        )

    order.status = next_status

    # Award points when order is marked COMPLETED
    if next_status == "COMPLETED":
        points_to_award = math.floor(
            float(order.final_payable) / settings.LOYALTY_EARN_SPEND_RATIO
        )
        if points_to_award > 0:
            user = await db.get(User, order.user_id)
            if user:
                user.loyalty_balance += points_to_award
                db.add(
                    LoyaltyTransaction(
                        user_id=user.id,
                        order_id=order.id,
                        points_change=points_to_award,
                        reason="ORDER_EARN",
                    )
                )

    # Reversal: Refund points back to user if order is CANCELLED
    elif next_status == "CANCELLED" and order.points_redeemed > 0:
        user = await db.get(User, order.user_id)
        if user:
            user.loyalty_balance += order.points_redeemed
            db.add(
                LoyaltyTransaction(
                    user_id=user.id,
                    order_id=order.id,
                    points_change=order.points_redeemed,
                    reason="REVERSAL",
                )
            )

    await db.commit()
    await db.refresh(order)
    return order


@router.patch("/products/{product_id}/availability", response_model=ProductOut)
async def update_product_availability(
    product_id: UUID,
    payload: ProductAvailabilityUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_staff),
):
    stmt = (
        select(Product)
        .options(selectinload(Product.modifiers))
        .where(Product.id == product_id)
    )
    product = (await db.execute(stmt)).scalar_one_or_none()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    product.is_available = payload.is_available
    await db.commit()
    await db.refresh(product)
    return product



from app.schemas.schemas import ProductCreate

@router.post("/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_staff)
):
    """Admin / Staff endpoint to add a new product with customisation options."""
    new_product = Product(
        category=payload.category,
        name=payload.name,
        description=payload.description,
        base_price=payload.base_price,
        image_url=payload.image_url,
        is_available=True
    )
    db.add(new_product)
    await db.flush()  # Generates product ID

    # Attach any modifiers passed during creation
    for mod in payload.modifiers:
        db.add(ProductModifier(
            product_id=new_product.id,
            modifier_group=mod.modifier_group,
            option_name=mod.option_name,
            price_delta=mod.price_delta
        ))

    await db.commit()
    
    # Reload with modifiers for output schema
    stmt = select(Product).options(selectinload(Product.modifiers)).where(Product.id == new_product.id)
    return (await db.execute(stmt)).scalar_one()


@router.delete("/products/{product_id}", status_code=status.HTTP_200_OK)
async def delete_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_staff)
):
    """Admin / Staff endpoint to delete a product from the menu."""
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    await db.delete(product)
    await db.commit()
    return {"message": f"Product '{product.name}' deleted successfully", "id": product_id}

class OutletStockToggle(BaseModel):
    outlet_id: UUID
    is_available: bool

@router.patch("/products/{product_id}/outlet-availability")
async def set_outlet_product_availability(
    product_id: UUID,
    payload: OutletStockToggle,
    db: AsyncSession = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    stmt = select(OutletProductAvailability).where(
        OutletProductAvailability.outlet_id == payload.outlet_id,
        OutletProductAvailability.product_id == product_id,
    )
    record = (await db.execute(stmt)).scalar_one_or_none()

    if not record:
        record = OutletProductAvailability(
            outlet_id=payload.outlet_id,
            product_id=product_id,
            is_available=payload.is_available,
        )
        db.add(record)
    else:
        record.is_available = payload.is_available

    await db.commit()
    return {"detail": f"Availability updated for outlet {payload.outlet_id}"}

# Add to backend/app/api/staff.py
from pydantic import BaseModel
from typing import Optional

class StaffOrderDecision(BaseModel):
    action: str  # "ACCEPT" or "REJECT"
    rejection_reason: Optional[str] = None

@router.patch("/orders/{order_id}/decision", response_model=OrderOut)
async def handle_order_decision(
    order_id: UUID,
    payload: StaffOrderDecision,
    db: AsyncSession = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    stmt = (
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order_id)
    )
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != "ORDER_RECEIVED":
        raise HTTPException(
            status_code=400,
            detail=f"Order is in state '{order.status}'. Only 'ORDER_RECEIVED' orders can be accepted or rejected."
        )

    # Load customer to handle point refunds
    user_stmt = select(User).where(User.id == order.user_id)
    customer = (await db.execute(user_stmt)).scalar_one()

    if payload.action.upper() == "ACCEPT":
        order.status = "PREPARING"

    elif payload.action.upper() == "REJECT":
        order.status = "REJECTED"
        order.payment_status = "REFUNDED"

        # Restore customer loyalty points if redeemed
        if order.points_redeemed > 0:
            customer.loyalty_balance += order.points_redeemed
            refund_tx = LoyaltyTransaction(
                id=uuid4(),
                user_id=customer.id,
                order_id=order.id,
                points_change=order.points_redeemed,
                reason="ORDER_REJECTED_REFUND",
                created_at=datetime.now(timezone.utc),
            )
            db.add(refund_tx)
    else:
        raise HTTPException(
            status_code=400,
            detail="Invalid action. Use 'ACCEPT' or 'REJECT'."
        )

    await db.commit()
    await db.refresh(order)
    return order