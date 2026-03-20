import asyncio
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from backend.graph.state import AgentState
from backend.tools.search_scraper import perform_search, scrape_url

# Module-level registry: thread_id -> asyncio.Queue
# Populated by main.py before graph runs, read here by the researcher
_progress_queues: dict[str, asyncio.Queue] = {}

def register_queue(thread_id: str, queue: asyncio.Queue):
    _progress_queues[thread_id] = queue

def unregister_queue(thread_id: str):
    _progress_queues.pop(thread_id, None)


async def _push(thread_id: str, event: dict):
    q = _progress_queues.get(thread_id)
    if q:
        await q.put(event)


async def _extract_from_url(llm, objective: str, url: str, title: str, snippet: str) -> str:
    result = f"\n**Source**: {title} ({url})\n"
    result += f"**Tavily Snippet**: {snippet}\n"
    try:
        raw = await asyncio.to_thread(scrape_url, url)
        if raw.startswith("Failed"):
            result += f"Deep Dive: {raw}\n"
            return result
        extraction_prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an expert research assistant. Extract the most important facts, "
                       "data points, and metrics from the provided raw website text based on the "
                       "user's objective. Ignore irrelevant ads or navigation text. Keep it concise and bulleted."),
            ("user", "Objective: {objective}\n\nRaw Website Text:\n{text}")
        ])
        extracted = await (extraction_prompt | llm).ainvoke({"objective": objective, "text": raw})
        result += f"Deep Dive Extraction:\n{extracted.content}\n"
    except Exception as e:
        result += f"Deep Dive: Failed — {e}\n"
    return result


async def _research_step(llm, step: str, thread_id: str) -> str:
    await _push(thread_id, {"type": "research_step", "status": "searching", "step": step})

    search_results = await asyncio.to_thread(perform_search, step, max_results=2)
    step_block = f"### Research for Sub-task: {step}\n"

    if not search_results:
        step_block += "_No results found._\n"
        await _push(thread_id, {"type": "research_step", "status": "done", "step": step})
        return step_block

    await _push(thread_id, {
        "type": "research_step", "status": "extracting", "step": step,
        "sources": [r.get("title", r.get("url", "")) for r in search_results]
    })

    tasks = [
        _extract_from_url(llm, step, r.get("url", ""), r.get("title", ""), r.get("content", ""))
        for r in search_results if r.get("url")
    ]
    url_results = await asyncio.gather(*tasks, return_exceptions=True)

    for res in url_results:
        step_block += f"\n_Extraction failed: {res}_\n" if isinstance(res, Exception) else res

    await _push(thread_id, {"type": "research_step", "status": "done", "step": step})
    return step_block


async def researcher_node(state: AgentState):
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.1)
    plan = state.get("plan", [])
    thread_id = state.get("thread_id", "")

    step_tasks = [_research_step(llm, step, thread_id) for step in plan]
    gathered_data = list(await asyncio.gather(*step_tasks))

    return {"gathered_data": gathered_data, "current_agent": "researcher"}