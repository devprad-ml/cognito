import json
import uuid
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from backend.database.db import get_pool, close_pool, init_db
from backend.graph.workflow import build_async_graph
from backend.agents.researcher import register_queue, unregister_queue

cognito_graph = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global cognito_graph
    await init_db()
    pool = await get_pool()
    checkpointer = AsyncPostgresSaver(pool)
    await checkpointer.setup()
    cognito_graph = await build_async_graph(checkpointer)
    print("✅ Cognito Graph Ready")
    yield
    await close_pool()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ResearchRequest(BaseModel):
    query: str


async def event_generator(thread_id: str, state_input: dict):
    config = {"configurable": {"thread_id": thread_id}}
    progress_queue: asyncio.Queue = asyncio.Queue()
    register_queue(thread_id, progress_queue)

    # Track which node is currently executing so we only stream
    # analyst tokens (not architect structured-output tokens)
    current_node = {"name": None}

    try:
        async def run_graph():
            async for event in cognito_graph.astream_events(state_input, config, version="v1"):
                kind = event["event"]

                # Track node entry
                if kind == "on_chain_start" and event["name"] in ["architect", "researcher", "analyst"]:
                    current_node["name"] = event["name"]

                # Node completed — send plan/report data
                elif kind == "on_chain_end" and event["name"] in ["architect", "researcher", "analyst"]:
                    output = event["data"].get("output", {})
                    await progress_queue.put({
                        "type": "node_update",
                        "node": event["name"],
                        "data": output
                    })
                    if event["name"] == "analyst":
                        current_node["name"] = None

                # Only stream tokens when the analyst is writing
                elif kind == "on_chat_model_stream" and current_node["name"] == "analyst":
                    content = event["data"]["chunk"].content
                    if content:
                        await progress_queue.put({"type": "token", "content": content})

            await progress_queue.put(None)  # sentinel

        graph_task = asyncio.create_task(run_graph())

        while True:
            item = await progress_queue.get()
            if item is None:
                break
            yield f"data: {json.dumps(item)}\n\n"

        await graph_task

    except Exception as e:
        print(f"Error in stream: {e}")
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    finally:
        unregister_queue(thread_id)

    yield "data: [DONE]\n\n"


@app.post("/api/research/start")
async def start_research(request: ResearchRequest):
    thread_id = str(uuid.uuid4())
    state_input = {"user_request": request.query, "thread_id": thread_id}
    return StreamingResponse(event_generator(thread_id, state_input), media_type="text/event-stream")

@app.get("/api/evals")
async def get_eval_history():
    pool = await get_pool()
    try:
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """SELECT run_id, run_at, question_id, domain, difficulty, question,
                              accuracy, depth, hallucination, citations, composite
                       FROM eval_runs
                       ORDER BY run_at DESC"""
                )
                cols = [d.name for d in cur.description]
                rows = await cur.fetchall()
        records = [dict(zip(cols, row)) for row in rows]
 
        runs = {}
        for r in records:
            rid = r["run_id"]
            if rid not in runs:
                runs[rid] = {
                    "run_id": rid, "run_at": r["run_at"].isoformat(),
                    "composite": [], "accuracy": [], "depth": [],
                    "hallucination": [], "citations": [], "by_domain": {}
                }
            runs[rid]["composite"].append(float(r["composite"]))
            runs[rid]["accuracy"].append(float(r["accuracy"]))
            runs[rid]["depth"].append(float(r["depth"]))
            runs[rid]["hallucination"].append(float(r["hallucination"]))
            runs[rid]["citations"].append(float(r["citations"]))
            runs[rid]["by_domain"].setdefault(r["domain"], []).append(float(r["composite"]))
 
        def avg(lst): return round(sum(lst) / len(lst), 3) if lst else 0
 
        run_list = []
        for rid, run in runs.items():
            run_list.append({
                "run_id": rid[:8], "run_at": run["run_at"],
                "avg_composite":    avg(run["composite"]),
                "avg_accuracy":     avg(run["accuracy"]),
                "avg_depth":        avg(run["depth"]),
                "avg_hallucination": avg(run["hallucination"]),
                "avg_citations":    avg(run["citations"]),
                "n": len(run["composite"]),
                "by_domain": {d: round(sum(s)/len(s), 3) for d, s in run["by_domain"].items()},
                "passed": avg(run["composite"]) >= 3.5,
            })
 
        seen, questions = set(), []
        for r in records:
            if r["question_id"] not in seen:
                seen.add(r["question_id"])
                questions.append({
                    "question_id": r["question_id"], "domain": r["domain"],
                    "difficulty": r["difficulty"], "question": r["question"],
                    "accuracy": float(r["accuracy"]), "depth": float(r["depth"]),
                    "hallucination": float(r["hallucination"]),
                    "citations": float(r["citations"]), "composite": float(r["composite"]),
                })
 
        return {"runs": run_list, "questions": questions}
    except Exception as e:
        print(f"Eval history error: {e}")
        return {"runs": [], "questions": [], "error": str(e)}
 