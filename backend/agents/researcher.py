import asyncio
from datetime import date
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from backend.graph.state import AgentState
from backend.tools.search_scraper import perform_search, scrape_url

# Module-level registry: thread_id -> asyncio.Queue
# Populated by main.py before graph runs, read here so the researcher can
# stream its live tool activity to the client.
_progress_queues: dict[str, asyncio.Queue] = {}

def register_queue(thread_id: str, queue: asyncio.Queue):
    _progress_queues[thread_id] = queue

def unregister_queue(thread_id: str):
    _progress_queues.pop(thread_id, None)


async def _push(thread_id: str, event: dict):
    q = _progress_queues.get(thread_id)
    if q:
        await q.put(event)


# ---------------------------------------------------------------------------
# Tools — the researcher decides which of these to call, and when.
# ---------------------------------------------------------------------------
@tool
async def web_search(query: str, recency: str = "none") -> str:
    """Search the web for current information about a topic. Returns the title,
    URL, and a short snippet for each of the top results. Use this first to
    discover which sources are worth reading.

    recency: limit results by age for time-sensitive topics — one of 'none',
    'week', 'month', or 'year'. Use 'week'/'month' for "latest"/"current"/news-style
    questions; use 'none' for timeless background topics. Also put the current year
    in your query when you want the newest information."""
    time_range = recency if recency in ("week", "month", "year") else None
    results = await asyncio.to_thread(perform_search, query, 3, time_range)
    if not results:
        return "No results found for that query. Try a different phrasing."
    blocks = []
    for r in results:
        blocks.append(
            f"Title: {r.get('title', '(untitled)')}\n"
            f"URL: {r.get('url', '')}\n"
            f"Snippet: {(r.get('content') or '')[:300]}"
        )
    return "\n\n".join(blocks)


@tool
async def read_url(url: str) -> str:
    """Fetch and read the main text content of a web page given its URL. Use this
    to dig into a promising search result and extract concrete facts, figures,
    and quotes."""
    text = await asyncio.to_thread(scrape_url, url)
    return text[:8000]


_TOOLS = [web_search, read_url]
_TOOL_MAP = {t.name: t for t in _TOOLS}

# Each "turn" is one LLM call that may issue one or more tool calls. Bounding
# turns keeps cost and latency predictable.
MAX_RESEARCH_TURNS = 3

def _researcher_system() -> str:
    return (
        f"{date.today().isoformat()}. "
        "You are an autonomous research agent. You investigate an objective using two tools:\n"
        "  - web_search(query, recency): find relevant sources\n"
        "  - read_url(url): read a page to extract concrete facts and figures\n\n"
        " always rely on what the tools "
        "return, and prefer the most recent sources. For anything time-sensitive (latest, "
        "current, recent, prices, releases, who-holds-office), set the web_search recency "
        "filter and include the current year in your query.\n\n"
        f"Work in at most {MAX_RESEARCH_TURNS} rounds of searching and reading — be efficient. "
        "Typically: search for each part of the plan, then read the most promising 1-2 sources "
        "per topic. When you have gathered enough to answer thoroughly, STOP calling tools and "
        "write up your findings as concise, factual bullet points. After each fact, cite its "
        "source URL in parentheses so the analyst can attribute claims."
    )


def _build_objective(state: AgentState) -> str:
    """First pass: the original request + the architect's plan.
    Revision pass: a focused brief targeting only the gaps the critic flagged."""
    request = state["user_request"]
    rounds = state.get("research_rounds", 0)

    if rounds >= 1 and state.get("missing_info"):
        gaps = "\n".join(f"- {m}" for m in state.get("missing_info", []))
        return (
            "A reviewer found the previous report incomplete and sent it back for more "
            "research.\n\n"
            f"Original request: {request}\n\n"
            f"Reviewer feedback: {state.get('critique', '')}\n\n"
            f"Specific gaps to fill:\n{gaps}\n\n"
            "Focus your research ONLY on filling these gaps. Do not re-research what is "
            "already covered."
        )

    plan = state.get("plan", []) or []
    plan_str = "\n".join(f"{i + 1}. {s}" for i, s in enumerate(plan))
    return f"Research objective: {request}\n\nResearch plan:\n{plan_str}"


async def researcher_node(state: AgentState):
    """Runs an autonomous tool-calling loop: the LLM searches and reads pages of
    its own choosing until it decides it has enough, then writes up findings.
    On a revision pass it targets only the gaps the critic identified."""
    rounds = state.get("research_rounds", 0)
    thread_id = state.get("thread_id", "")
    is_revision = rounds >= 1   # this is a boolean flag

    if is_revision:
        await _push(thread_id, {
            "type": "revision",
            "round": rounds + 1,
            "missing": state.get("missing_info", []),
        })

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.1)
    llm_with_tools = llm.bind_tools(_TOOLS)

    messages = [
        SystemMessage(content=_researcher_system()),
        HumanMessage(content=_build_objective(state)),
    ]
    findings = None

    for _ in range(MAX_RESEARCH_TURNS):
        ai = await llm_with_tools.ainvoke(messages)
        messages.append(ai)

        # No tool calls => the agent is done and this message holds its findings.
        if not ai.tool_calls:
            findings = ai.content
            break

        # Respond to every tool call in this turn (OpenAI requires a ToolMessage
        # for each tool_call_id before the next model turn).
        for tc in ai.tool_calls:
            name, args = tc["name"], tc.get("args", {})
            detail = args.get("query") or args.get("url") or ""
            await _push(thread_id, {"type": "research_activity", "tool": name, "detail": detail, "status": "running"})

            tool_obj = _TOOL_MAP.get(name)
            try:
                result = await tool_obj.ainvoke(args) if tool_obj else f"Unknown tool: {name}"
            except Exception as e:
                result = f"Tool '{name}' failed: {e}"

            await _push(thread_id, {"type": "research_activity", "tool": name, "detail": detail, "status": "done"})
            messages.append(ToolMessage(content=str(result), tool_call_id=tc["id"]))

    # Budget exhausted while still wanting tools — force a final synthesis.
    if findings is None:
        wrap = await llm.ainvoke(messages + [HumanMessage(content=(
            "You've reached your research budget. Summarize your key findings now as "
            "concise bullet points, each with its source URL in parentheses."
        ))])
        findings = wrap.content

    # Accumulate across rounds so a revision adds to (not replaces) prior research.
    existing = state.get("gathered_data", []) or []
    labelled = f"## Research Round {rounds + 1}\n{findings}"
    return {
        "gathered_data": existing + [labelled],
        "research_rounds": rounds + 1,
        "current_agent": "researcher",
    }
