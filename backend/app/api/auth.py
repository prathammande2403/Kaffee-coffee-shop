from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.security import create_access_token, get_password_hash, verify_password
from app.database import get_db
from app.models.models import LoyaltyTransaction, User
from app.schemas.schemas import LoyaltyTransactionOut, Token, UserLogin, UserOut, UserRegister

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(
        or_(User.email == payload.email, User.phone == payload.phone)
    )
    existing_user = (await db.execute(stmt)).scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email or phone number already exists",
        )

    new_user = User(
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        hashed_password=get_password_hash(payload.password),
        role="customer",
        loyalty_balance=0,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@router.post("/login", response_model=Token)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.email == payload.email)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        subject=str(user.id),
        role=user.role,
        extra_claims={"email": user.email, "name": user.full_name},
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        user_id=user.id,
    )


@router.get("/me", response_model=UserOut)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/loyalty-history", response_model=List[LoyaltyTransactionOut])
async def get_loyalty_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(LoyaltyTransaction)
        .where(LoyaltyTransaction.user_id == current_user.id)
        .order_by(LoyaltyTransaction.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()