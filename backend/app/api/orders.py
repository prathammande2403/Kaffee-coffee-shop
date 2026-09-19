from datetime import datetime, timezone
from decimal import Decimal
from typing import List
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.database import get_db
from app.models.models import (
    LoyaltyTransaction,
    Order,
    OrderItem,
    Outlet,
    Product,
    User,
)
from app.schemas.schemas import OrderCreate, OrderOut

# Attempt to import OutletProductAvailability if defined in models
try:
    from app.models.models import OutletProductAvailability
except ImportError:
    OutletProductAvailability = None

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=OrderOut, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_order(
    order_in: OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Validate Outlet exists and is operational
    outlet_res = await db.execute(select(Outlet).where(Outlet.id == order_in.outlet_id))
    outlet = outlet_res.scalar_one_or_none()
    if not outlet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specified outlet does not exist",
        )
    if hasattr(outlet, "is_active") and not outlet.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Specified outlet is temporarily closed",
        )

    # 2. Validate Order contains items
    if not order_in.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order must contain at least one item",
        )

    # 3. Verify Products, Availability, and Calculate Financials
    subtotal = Decimal("0.00")
    order_items_to_create: List[OrderItem] = []
    order_id = uuid4()

    for item in order_in.items:
        if item.quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Quantity must be greater than 0 for product {item.product_id}",
            )

        # Lookup Product
        prod_res = await db.execute(select(Product).where(Product.id == item.product_id))
        product = prod_res.scalar_one_or_none()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {item.product_id} no longer exists",
            )

        # Enforce Global Availability
        if not getattr(product, "is_available", True):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"'{product.name}' is currently marked unavailable and cannot be ordered",
            )

        # Enforce Outlet-Specific Availability (if table exists)
        if OutletProductAvailability is not None:
            outlet_avail_res = await db.execute(
                select(OutletProductAvailability.is_available).where(
                    OutletProductAvailability.outlet_id == order_in.outlet_id,
                    OutletProductAvailability.product_id == product.id,
                )
            )
            is_outlet_avail = outlet_avail_res.scalar_one_or_none()
            if is_outlet_avail is False:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"'{product.name}' is out of stock at this selected outlet",
                )

        # Extract Base Product Price
        raw_price = getattr(product, "base_price", getattr(product, "price", None))
        if raw_price is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Product pricing configuration missing on database model",
            )
        base_product_price = Decimal(str(raw_price))

        # Sum Modifiers and Serialize for JSON Storage
        modifiers_total = Decimal("0.00")
        serialized_modifiers = []

        if getattr(item, "modifiers", None):
            for mod in item.modifiers:
                mod_price = Decimal(str(getattr(mod, "price_delta", getattr(mod, "price", 0))))
                modifiers_total += mod_price

                if hasattr(mod, "model_dump"):
                    serialized_modifiers.append(mod.model_dump(mode="json"))
                elif hasattr(mod, "dict"):
                    data = mod.dict()
                    data["modifier_id"] = str(data.get("modifier_id", ""))
                    data["price_delta"] = float(data.get("price_delta", data.get("price", 0.0)))
                    serialized_modifiers.append(data)
                elif isinstance(mod, dict):
                    mod_copy = dict(mod)
                    if "modifier_id" in mod_copy:
                        mod_copy["modifier_id"] = str(mod_copy["modifier_id"])
                    if "price_delta" in mod_copy:
                        mod_copy["price_delta"] = float(mod_copy["price_delta"])
                    elif "price" in mod_copy:
                        mod_copy["price_delta"] = float(mod_copy["price"])
                    serialized_modifiers.append(mod_copy)

        unit_price = base_product_price + modifiers_total
        item_total = unit_price * Decimal(item.quantity)
        subtotal += item_total

        order_item = OrderItem(
            id=uuid4(),
            order_id=order_id,
            product_id=product.id,
            product_name=product.name,
            quantity=item.quantity,
            selected_modifiers=serialized_modifiers,
            unit_price=unit_price,
            total_price=item_total,
        )
        order_items_to_create.append(order_item)

    # 4. Handle Loyalty Points Redemption
    points_to_redeem = order_in.points_to_redeem or 0
    if points_to_redeem > 0:
        if points_to_redeem < 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Minimum 50 loyalty points required for redemption",
            )
        if current_user.loyalty_balance < points_to_redeem:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient loyalty points. Current balance: {current_user.loyalty_balance}",
            )
        current_user.loyalty_balance -= points_to_redeem

    # 5. Compute Taxes, Discount, and Final Payable
    discount = Decimal(str(points_to_redeem))
    tax = (subtotal * Decimal("0.05")).quantize(Decimal("0.01"))
    final_payable = max(Decimal("0.00"), subtotal + tax - discount)

    # 6. Create Order Record
    new_order = Order(
        id=order_id,
        user_id=current_user.id,
        outlet_id=order_in.outlet_id,
        pickup_type=order_in.pickup_type,
        scheduled_pickup_time=order_in.scheduled_pickup_time,
        subtotal=subtotal,
        tax=tax,
        discount_amount=discount,
        points_redeemed=points_to_redeem,
        final_payable=final_payable,
        status="ORDER_RECEIVED",
        payment_status="PAID",
    )
    db.add(new_order)
    db.add_all(order_items_to_create)
    await db.flush()

    # 7. Record Loyalty Transaction Audit Log (if redeemed)
    if points_to_redeem > 0:
        redemption_tx = LoyaltyTransaction(
            id=uuid4(),
            user_id=current_user.id,
            order_id=new_order.id,
            points_change=-points_to_redeem,
            reason="CHECKOUT_REDEEM",
            created_at=datetime.now(timezone.utc),
        )
        db.add(redemption_tx)

    # 8. Atomically Commit
    await db.commit()

    # 9. Return eager-loaded order
    stmt = (
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == new_order.id)
    )
    result = await db.execute(stmt)
    return result.scalar_one()


@router.get("", response_model=List[OrderOut])
@router.get("/", response_model=List[OrderOut], include_in_schema=False)
async def list_my_orders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.user_id == current_user.id)
        .order_by(Order.created_at.desc() if hasattr(Order, "created_at") else Order.id.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{order_id}", response_model=OrderOut)
async def get_order_details(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order_id)
    )
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    # Restrict viewing to the order owner or staff/admin
    if order.user_id != current_user.id and getattr(current_user, "role", "customer") not in ["staff", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this order",
        )

@router.patch("/{order_id}/cancel", response_model=OrderOut)
async def cancel_my_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order_id, Order.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    # Cannot cancel if kitchen has already started preparing or completed it
    if order.status != "ORDER_RECEIVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order cannot be cancelled because it is already '{order.status}'",
        )

    # 1. Update order status
    order.status = "CANCELLED"
    order.payment_status = "REFUNDED"

    # 2. Refund loyalty points if used
    if order.points_redeemed > 0:
        current_user.loyalty_balance += order.points_redeemed
        refund_tx = LoyaltyTransaction(
            id=uuid4(),
            user_id=current_user.id,
            order_id=order.id,
            points_change=order.points_redeemed,
            reason="CANCELLED_REFUND",
            created_at=datetime.now(timezone.utc),
        )
        db.add(refund_tx)

    await db.commit()
    await db.refresh(order)
    return order

# Add to backend/app/api/orders.py

@router.post("/{order_id}/repeat")
async def repeat_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order_id, Order.user_id == current_user.id)
    )
    prev_order = (await db.execute(stmt)).scalar_one_or_none()
    if not prev_order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Reconstitute items with live availability check
    reorder_items = []
    for item in prev_order.items:
        product = await db.get(Product, item.product_id)
        if not product or not product.is_available:
            raise HTTPException(
                status_code=400,
                detail=f"Item '{item.product_name}' is currently unavailable and cannot be reordered",
            )

        reorder_items.append({
            "product_id": str(item.product_id),
            "name": item.product_name,
            "unit_price": float(item.unit_price),
            "quantity": item.quantity,
            "modifiers": item.selected_modifiers or [],
        })

    # Look up outlet details
    outlet = await db.get(Outlet, prev_order.outlet_id)

    return {
        "outlet_id": str(prev_order.outlet_id),
        "outlet_name": outlet.name if outlet else "Coffee Outlet",
        "items": reorder_items,
    }