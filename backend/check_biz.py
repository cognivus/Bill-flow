import asyncio
from app.database.session import AsyncSessionLocal
from app.models.models import Business
from sqlalchemy import select

async def run():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Business.id, Business.name))
        print('\nBUSINESSES:')
        for r in res.all():
            print(f' - {r[1]} (ID: {r[0]})')

if __name__ == '__main__':
    asyncio.run(run())
