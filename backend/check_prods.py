import asyncio
from app.database.session import AsyncSessionLocal
from app.models.models import Product
from sqlalchemy import select, func

async def check():
    async with AsyncSessionLocal() as db:
        q = select(func.count(Product.id))
        count = (await db.execute(q)).scalar()
        print(f"TOTAL_PRODUCTS_IN_DB: {count}")
        
        q_all = select(Product).limit(10)
        prods = (await db.execute(q_all)).scalars().all()
        for p in prods:
            print(f" - {p.name} (SKU: {p.sku}) [BID: {p.business_id}]")

if __name__ == "__main__":
    asyncio.run(check())
