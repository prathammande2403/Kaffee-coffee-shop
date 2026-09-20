from datetime import datetime, time
from decimal import Decimal
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# ==========================================
# Authentication Schemas
# ==========================================
class UserRegister(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=15)
    password: str = Field(..., min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: UUID


class UserOut(BaseModel):
    id: UUID
    full_name: str
    email: EmailStr
    phone: str
    role: str
    loyalty_balance: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Outlet Schemas
# ==========================================
class OutletOut(BaseModel):
    id: UUID
    name: str
    address: str
    is_active: bool
    opening_time: time
    closing_time: time
    avg_prep_minutes: int

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Menu & Modifiers Schemas
# ==========================================
class ModifierOut(BaseModel):
    id: UUID
    modifier_group: str
    option_name: str
    price_delta: Decimal

    model_config = ConfigDict(from_attributes=True)


class ProductOut(BaseModel):
    id: UUID
    category: str
    name: str
    description: Optional[str] = None
    base_price: Decimal
    image_url: Optional[str] = None
    is_available: bool
    modifiers: List[ModifierOut] = []

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Cart & Checkout Schemas
# ==========================================
class ModifierSelection(BaseModel):
    modifier_id: UUID
    group: str
    option_name: str
    price_delta: Decimal = Field(default=Decimal("0.00"), ge=0)


class CartItemIn(BaseModel):
    product_id: UUID
    quantity: int = Field(..., ge=1, le=50)
    modifiers: List[ModifierSelection] = []


class OrderCreate(BaseModel):
    outlet_id: UUID
    pickup_type: Literal["immediate", "scheduled"] = "immediate"
    scheduled_pickup_time: Optional[datetime] = None
    points_to_redeem: int = Field(default=0, ge=0)
    items: List[CartItemIn] = Field(..., min_length=1)

    @field_validator("scheduled_pickup_time")
    @classmethod
    def validate_scheduled_time(
        cls, v: Optional[datetime], info: Any
    ) -> Optional[datetime]:
        # Pickup type check happens during business logic, but ensure future time if provided
        if v and v < datetime.now(v.tzinfo):
            raise ValueError("Scheduled pickup time must be in the future")
        return v


class OrderItemOut(BaseModel):
    id: UUID
    product_id: UUID
    product_name: str
    quantity: int
    unit_price: Decimal
    total_price: Decimal
    selected_modifiers: List[Dict[str, Any]]

    model_config = ConfigDict(from_attributes=True)


class OrderOut(BaseModel):
    id: UUID
    outlet_id: UUID
    status: str
    pickup_type: str
    scheduled_pickup_time: Optional[datetime] = None
    subtotal: Decimal
    tax: Decimal
    discount_amount: Decimal
    points_redeemed: int
    final_payable: Decimal
    payment_status: str
    created_at: datetime
    items: List[OrderItemOut] = []

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Staff & Administration Schemas
# ==========================================
class StaffOrderOut(OrderOut):
    customer_name: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    status: Literal[
        "ORDER_RECEIVED",
        "PREPARING",
        "READY_FOR_PICKUP",
        "COMPLETED",
        "CANCELLED",
    ]


class ProductAvailabilityUpdate(BaseModel):
    is_available: bool


# ==========================================
# Loyalty Schemas
# ==========================================
class LoyaltyTransactionOut(BaseModel):
    id: UUID
    order_id: Optional[UUID] = None
    points_change: int
    reason: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
    
    
class ModifierCreate(BaseModel):
    modifier_group: str  # 'size', 'milk', 'sugar', 'add_ons'
    option_name: str     # e.g., 'Oat Milk'
    price_delta: Decimal = Decimal("0.00")

class ProductCreate(BaseModel):
    category: str       # 'hot_coffee', 'cold_coffee', 'matcha', 'food'
    name: str
    description: Optional[str] = None
    base_price: Decimal
    image_url: Optional[str] = None
    modifiers: List[ModifierCreate] = []
    

class SelectedModifierInFavorite(BaseModel):
    # Accepts either "modifier_id" or "id"
    modifier_id: UUID = Field(validation_alias="modifier_id", default=None)
    # Accepts either "group" or "modifier_group"
    group: str = Field(validation_alias="group", default="")
    option_name: str
    price_delta: Decimal = Decimal("0.00")

    model_config = {
        "populate_by_name": True,
        "extra": "ignore"
    }

    # Fallback resolver if passed as 'id' or 'modifier_group'
    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        if isinstance(obj, dict):
            if "id" in obj and "modifier_id" not in obj:
                obj["modifier_id"] = obj["id"]
            if "modifier_group" in obj and "group" not in obj:
                obj["group"] = obj["modifier_group"]
        return super().model_validate(obj, *args, **kwargs)

class FavoriteCreate(BaseModel):
    product_id: UUID
    label: Optional[str] = None
    selected_modifiers: List[SelectedModifierInFavorite] = []

class FavoriteOut(BaseModel):
    id: UUID
    product_id: UUID
    product_name: str
    product_image: Optional[str] = None
    base_price: Decimal
    label: Optional[str] = None
    selected_modifiers: List[dict]
    calculated_price: Decimal
    is_available: bool
    created_at: datetime

    model_config = {"from_attributes": True}