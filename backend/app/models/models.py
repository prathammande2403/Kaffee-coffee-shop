import uuid
from datetime import datetime, time, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import JSON
from sqlalchemy.types import TypeDecorator, CHAR
from sqlalchemy import UniqueConstraint

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Time,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str] = mapped_column(
        String(20), unique=True, index=True, nullable=False
    )
    email: Mapped[str] = mapped_column(
        String(120), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(
        String(20), default="customer", nullable=False
    )  # 'customer', 'staff', 'admin'
    loyalty_balance: Mapped[int] = mapped_column(
        Integer,
        CheckConstraint("loyalty_balance >= 0", name="chk_positive_loyalty_balance"),
        default=0,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    orders: Mapped[List["Order"]] = relationship(
        "Order", back_populates="user", cascade="all, delete-orphan"
    )
    loyalty_txs: Mapped[List["LoyaltyTransaction"]] = relationship(
        "LoyaltyTransaction", back_populates="user", cascade="all, delete-orphan"
    )


class Outlet(Base):
    __tablename__ = "outlets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    opening_time: Mapped[time] = mapped_column(Time, default=time(7, 0), nullable=False)
    closing_time: Mapped[time] = mapped_column(Time, default=time(22, 0), nullable=False)
    avg_prep_minutes: Mapped[int] = mapped_column(Integer, default=15, nullable=False)

    # Relationships
    orders: Mapped[List["Order"]] = relationship("Order", back_populates="outlet")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # 'hot_coffee', 'cold_coffee', 'matcha', 'food', 'add_ons'
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    base_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    modifiers: Mapped[List["ProductModifier"]] = relationship(
        "ProductModifier", back_populates="product", cascade="all, delete-orphan"
    )


class ProductModifier(Base):
    __tablename__ = "product_modifiers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
    )
    modifier_group: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # 'size', 'milk', 'sugar', 'add_ons'
    option_name: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # 'Large (350ml)', 'Oat Milk', 'Extra Shot'
    price_delta: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )

    # Relationships
    product: Mapped["Product"] = relationship("Product", back_populates="modifiers")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(30), default="ORDER_RECEIVED", nullable=False, index=True
    )  # 'ORDER_RECEIVED', 'PREPARING', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED'
    pickup_type: Mapped[str] = mapped_column(
        String(20), default="immediate", nullable=False
    )  # 'immediate', 'scheduled'
    scheduled_pickup_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    tax: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )
    points_redeemed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    final_payable: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    payment_status: Mapped[str] = mapped_column(
        String(20), default="PAID", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="orders")
    outlet: Mapped["Outlet"] = relationship("Outlet", back_populates="orders")
    items: Mapped[List["OrderItem"]] = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False
    )
    product_name: Mapped[str] = mapped_column(String(100), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    selected_modifiers: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list
    )  # Historical snapshot: [{"modifier_id": "...", "group": "milk", "option_name": "Oat Milk", "price_delta": 45.00}]
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # Relationships
    order: Mapped["Order"] = relationship("Order", back_populates="items")


class LoyaltyTransaction(Base):
    __tablename__ = "loyalty_transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    order_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True
    )
    points_change: Mapped[int] = mapped_column(
        Integer, nullable=False
    )  # Positive for earn (+), negative for redemption (-)
    reason: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # 'ORDER_EARN', 'CHECKOUT_REDEEM', 'REVERSAL'
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="loyalty_txs")
    
class OutletProductAvailability(Base):
    __tablename__ = "outlet_product_availability"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Ensure each outlet has exactly one stock record per product
    __table_args__ = (
        UniqueConstraint("outlet_id", "product_id", name="uq_outlet_product"),
    )
    


class UserFavorite(Base):
    __tablename__ = "user_favorites"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Optional label like "My Morning Brew" or "Gym Shake"
    label: Mapped[str] = mapped_column(String(100), nullable=True)
    
    # Store ONLY the user's selected choices: [{"modifier_id": "...", "option_name": "Oat Milk", "price_delta": 40.0}]
    selected_modifiers: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    product = relationship("Product")