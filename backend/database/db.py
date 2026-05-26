import os
from psycopg_pool import AsyncConnectionPool
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

DB_URI = os.getenv("POSTGRES_URI")

# Global connection pool
pool: AsyncConnectionPool = None

async def get_pool() -> AsyncConnectionPool:
    """Returns the global database connection pool, initializing it if necessary."""
    global pool
    if pool is None:
        pool = AsyncConnectionPool(
            conninfo=DB_URI,
            max_size=20, # Handles up to 20 concurrent agent executions
            kwargs={"autocommit": True}, # Required for LangGraph's checkpointer
            timeout=10.0
            )
    return pool

async def close_pool():
    """Gracefully closes the database connection pool."""
    global pool
    if pool is not None:
        await pool.close()
        pool = None