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

    # --- Reflection / critic loop ---
    research_rounds: int          # how many times the researcher has run
    critique: Optional[str]       # the critic's latest feedback
    critique_passed: bool         # True once the critic accepts the report
    missing_info: List[str]       # specific gaps the next research round must fill
