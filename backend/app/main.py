from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import favorites
from app.api import auth, menu, orders, outlets, staff
from app.core.config import settings
from app.database import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure schemas exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown: dispose connections cleanly
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(outlets.router, prefix=settings.API_V1_STR)
app.include_router(menu.router, prefix=settings.API_V1_STR)
app.include_router(orders.router, prefix=settings.API_V1_STR)
app.include_router(staff.router, prefix=settings.API_V1_STR)
app.include_router(favorites.router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
    }