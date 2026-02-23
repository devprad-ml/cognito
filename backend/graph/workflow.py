import os
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool
from backend.graph.state import AgentState
from backend.agents.manager import architect_node
from backend.agents.researcher import researcher_node
from backend.agents.analyst import analyst_node

DB_URI = os.getenv("POSTGRES_URI", "postgresql://user:password@localhost:5432/cognito")

async def build_async_graph():
    """Builds the orchestrator-worker graph with asynchronous Postgres persistence."""
    workflow = StateGraph(AgentState)

    # add the agent nodes
    workflow.add_node("architect", architect_node)
    workflow.add_node("researcher", researcher_node)
    workflow.add_node("analyst", analyst_node)

    # connect the nodes 
    workflow.set_entry_point("architect")
    workflow.add_edge("architect", "researcher")
    workflow.add_edge("researcher", "analyst")
    workflow.add_edge("analyst", END)

    # prod checkpoint setup (guardrail for crashes)
    pool = AsyncConnectionPool(
        conninfo=DB_URI,
        max_size=20,
        kwargs={'autocommit':True}
    )

    checkpointer = AsyncPostgresSaver(pool)

    await checkpointer.setup()

    app = workflow.compile(
        checkpointer=checkpointer,
        interrupt_before={"researcher"}
    )

    return app