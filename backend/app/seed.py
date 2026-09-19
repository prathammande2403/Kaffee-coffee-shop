import asyncio
from datetime import time
from decimal import Decimal
from sqlalchemy import select

from app.core.security import get_password_hash
from app.database import AsyncSessionLocal, engine, Base
from app.models.models import Outlet, Product, ProductModifier, User


async def seed() -> None:
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # Check if already seeded
        result = await db.execute(select(User).limit(1))
        if result.scalar_one_or_none():
            print("Database already contains data. Skipping seed.")
            return

        print("Seeding database...")

        # 1. Outlets
        outlet1 = Outlet(
            name="Downtown Roastery",
            address="102 MG Road, Heritage District",
            is_active=True,
            opening_time=time(7, 0),
            closing_time=time(23, 0),
            avg_prep_minutes=12,
        )
        outlet2 = Outlet(
            name="Cyber City Hub",
            address="Ground Floor, Tower B, Tech Park",
            is_active=True,
            opening_time=time(8, 0),
            closing_time=time(21, 30),
            avg_prep_minutes=10,
        )
        db.add_all([outlet1, outlet2])

        # 2. Users (Staff and Customer)
        staff_user = User(
            full_name="Outlet Staff",
            email="staff@coffee.com",
            phone="9876543210",
            hashed_password=get_password_hash("staff123"),
            role="staff",
            loyalty_balance=0,
        )
        customer_user = User(
            full_name="Alex Turner",
            email="alex@coffee.com",
            phone="9123456780",
            hashed_password=get_password_hash("alex123"),
            role="customer",
            loyalty_balance=120,  # Pre-funded to test point redemption immediately
        )
        db.add_all([staff_user, customer_user])

        # 3. Products
        p1 = Product(
            category="hot_coffee",
            name="Cortado",
            description="Equal parts double espresso and silky textured milk",
            base_price=Decimal("210.00"),
            image_url="https://images.unsplash.com/photo-1534778101976-62847782c213?w=500",
            is_available=True,
        )
        p2 = Product(
            category="cold_coffee",
            name="Cold Brew Tonic",
            description="18-hour steeped single-origin coffee with artisan citrus tonic",
            base_price=Decimal("260.00"),
            image_url="https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500",
            is_available=True,
        )
        p3 = Product(
            category="matcha",
            name="Iced Strawberry Matcha Latte",
            description="Ceremonial Uji matcha over house strawberry compote and oat milk",
            base_price=Decimal("320.00"),
            image_url="https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=500",
            is_available=True,
        )
        p4 = Product(
            category="food",
            name="Almond Croissant",
            description="Twice-baked butter croissant loaded with frangipane cream",
            base_price=Decimal("190.00"),
            image_url="https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500",
            is_available=True,
        )
        db.add_all([p1, p2, p3, p4])
        await db.flush()  # Generate IDs for modifiers

        # 4. Modifiers for Beverages
        beverage_ids = [p1.id, p2.id, p3.id]
        modifiers_to_add = []

        for p_id in beverage_ids:
            # Sizes
            modifiers_to_add.extend([
                ProductModifier(product_id=p_id, modifier_group="size", option_name="Regular (250ml)", price_delta=Decimal("0.00")),
                ProductModifier(product_id=p_id, modifier_group="size", option_name="Large (350ml)", price_delta=Decimal("50.00")),
            ])
            # Milk choices
            modifiers_to_add.extend([
                ProductModifier(product_id=p_id, modifier_group="milk", option_name="Whole Milk", price_delta=Decimal("0.00")),
                ProductModifier(product_id=p_id, modifier_group="milk", option_name="Oat Milk", price_delta=Decimal("45.00")),
                ProductModifier(product_id=p_id, modifier_group="milk", option_name="Almond Milk", price_delta=Decimal("45.00")),
            ])
            # Sugar levels
            modifiers_to_add.extend([
                ProductModifier(product_id=p_id, modifier_group="sugar", option_name="Unsweetened (0%)", price_delta=Decimal("0.00")),
                ProductModifier(product_id=p_id, modifier_group="sugar", option_name="Mild (50%)", price_delta=Decimal("0.00")),
                ProductModifier(product_id=p_id, modifier_group="sugar", option_name="Standard (100%)", price_delta=Decimal("0.00")),
            ])
            # Add-ons
            modifiers_to_add.extend([
                ProductModifier(product_id=p_id, modifier_group="add_ons", option_name="Extra Espresso Shot", price_delta=Decimal("55.00")),
                ProductModifier(product_id=p_id, modifier_group="add_ons", option_name="Vanilla Bean Syrup", price_delta=Decimal("35.00")),
            ])

        db.add_all(modifiers_to_add)
        await db.commit()
        print("Database seeded successfully with outlets, users, menu items, and modifiers.")


if __name__ == "__main__":
    asyncio.run(seed())