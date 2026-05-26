from langgraph.graph import StateGraph, END
from backend.graph.state import AgentState
from backend.agents.manager import architect_node
from backend.agents.researcher import researcher_node
from backend.agents.analyst import analyst_node
from backend.agents.critic import critic_node

# How many extra research rounds the critic may trigger after the first draft.
# Bounded so a stubborn critique can never loop (and bill) forever.
MAX_REVISIONS = 1


def route_after_critic(state: AgentState) -> str:
    """Decide whether to accept the report or send it back for more research."""
    if state.get("critique_passed"):
        return END
    if state.get("research_rounds", 1) > MAX_REVISIONS:
        return END  # budget spent — ship the best draft we have
    return "researcher"


async def build_async_graph(checkpointer):
    """Builds the agentic research graph: plan -> research (tool loop) -> write ->
    critique -> (loop back to research if insufficient) with Postgres persistence."""
    workflow = StateGraph(AgentState)

    # add the agent nodes
    workflow.add_node("architect", architect_node)
    workflow.add_node("researcher", researcher_node)
    workflow.add_node("analyst", analyst_node)
    workflow.add_node("critic", critic_node)

    # connect the nodes
    workflow.set_entry_point("architect")
    workflow.add_edge("architect", "researcher")
    workflow.add_edge("researcher", "analyst")
    workflow.add_edge("analyst", "critic")

    # reflection cycle: the critic either ends the run or routes back to research
    workflow.add_conditional_edges(
        "critic",
        route_after_critic,
        {"researcher": "researcher", END: END},
    )

    app = workflow.compile(
        checkpointer=checkpointer,
    )

    return app
