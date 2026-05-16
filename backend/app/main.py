"""
BillFlow SaaS Billing Platform - FastAPI Main Application
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.core.config import settings
from app.core.logging import setup_logging
from app.database.session import engine, Base
from app.routers import auth, businesses, products, customers, invoices, dashboard, admin
from app.middleware.tenant import TenantMiddleware

setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title="BillFlow API",
    description="Multi-tenant SaaS Billing Platform for Small Businesses",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tenant isolation middleware
app.add_middleware(TenantMiddleware)

# Routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(businesses.router, prefix="/api/v1/businesses", tags=["Businesses"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(products.router, prefix="/api/v1/products", tags=["Products"])
app.include_router(customers.router, prefix="/api/v1/customers", tags=["Customers"])
app.include_router(invoices.router, prefix="/api/v1/invoices", tags=["Invoices"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Super Admin"])


@app.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "version": "1.0.0", "service": "BillFlow API"}
