import asyncio
from sqlalchemy import select, text
from app.database.session import engine, Base
from app.models.models import Profile

async def check():
    async with engine.connect() as conn:
        try:
            # Check if columns exist by querying the table
            res = await conn.execute(text("SELECT * FROM profiles LIMIT 1"))
            cols = res.keys()
            print(f"Columns in profiles: {list(cols)}")
        except Exception as e:
            print(f"Error checking profiles: {e}")

if __name__ == "__main__":
    asyncio.run(check())
