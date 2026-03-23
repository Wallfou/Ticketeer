from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from base import Base
import os
from dotenv import load_dotenv

load_dotenv()

engine = create_async_engine(os.getenv("DATABASE_URL"), echo=True)
Session = async_sessionmaker(engine, expire_on_commit=False)

__all__ = ["engine", "Session", "Base"]
