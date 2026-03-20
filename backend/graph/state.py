from typing import Annotated, List, TypedDict, Optional
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage

class AgentState(TypedDict):
    """The shared state object for the cognito multi-agent system."""

    messages: Annotated[list[BaseMessage], add_messages]
    user_request: str
    plan: List[str]
    gathered_data: List[str]
    final_report: Optional[str]
    current_agent: str
    thread_id: str  # passed in so researcher can find its progress queue