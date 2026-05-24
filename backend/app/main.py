"""
BillFlow SaaS Billing Platform - FastAPI Main Application
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings
from app.core.logging import setup_logging
from app.database.session import engine, Base, AsyncSessionLocal
from app.routers import auth, businesses, products, customers, invoices, dashboard, admin
from app.middleware.tenant import TenantMiddleware
from app.services.cleanup_service import cleanup_incomplete_signups

setup_logging()

import logging
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def run_cleanup():
    """Periodic job: delete stale unverified and abandoned-onboarding accounts."""
    async with AsyncSessionLocal() as db:
        try:
            result = await cleanup_incomplete_signups(db)
            await db.commit()
            if result["deleted_unverified"] or result["deleted_abandoned_onboarding"]:
                logger.info(
                    f"Cleanup job: removed {result['deleted_unverified']} unverified "
                    f"+ {result['deleted_abandoned_onboarding']} abandoned accounts"
                )
        except Exception as e:
            await db.rollback()
            logger.error(f"Cleanup job failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Start cleanup scheduler — runs every 10 minutes
    scheduler.add_job(
        run_cleanup,
        trigger=IntervalTrigger(minutes=10),
        id="cleanup_incomplete_signups",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()
    logger.info("Cleanup scheduler started (runs every 10 minutes)")

    yield

    # Shutdown
    scheduler.shutdown(wait=False)
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
