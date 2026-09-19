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

origins = [
    "http://localhost:5173",          # Local development
    "http://localhost:3000",          # Alternative local port  
    "https://kaffa-coffee-shop-kaffee.vercel.app",  # Your current active Vercel frontend URL
]

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https:\/\/.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes (both with /api prefix and root for full client compatibility)
routers = [auth.router, outlets.router, menu.router, orders.router, staff.router, favorites.router]
for r in routers:
    app.include_router(r, prefix=settings.API_V1_STR)
    app.include_router(r)


@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
    }