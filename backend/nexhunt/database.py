import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from nexhunt.config import settings


class Base(DeclarativeBase):
    pass


# Default database (for global settings and project index)
_default_db_path = os.path.join(settings.db_dir, "nexhunt.db")
_default_engine = create_async_engine(
    f"sqlite+aiosqlite:///{_default_db_path}",
    echo=False,
    connect_args={"check_same_thread": False},
)
DefaultSession = async_sessionmaker(_default_engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    """Create all tables in the default database."""
    # Import all models to ensure tables are registered with metadata
    from nexhunt.models import finding, recon_result  # noqa
    async with _default_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncSession:
    """Get a database session."""
    async with DefaultSession() as session:
        yield session
