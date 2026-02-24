import json
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from backend.database.db import get_pool, close_pool, init_db
from backend.graph.workflow import build_async_graph

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

class ApprovalRequest(BaseModel):
    thread_id: str
    approved: bool

async def event_generator(thread_id: str, state_input: dict = None, resume: bool = False):
    config = {"configurable": {"thread_id": thread_id}}
    try:
        stream_target = None if resume else state_input
        
        # We use version="v1" to get standard event names
        async for event in cognito_graph.astream_events(stream_target, config, version="v1"):
            kind = event["event"]
            
            # 1. Capture Node Completions (on_chain_end handles our nodes)
            if kind == "on_chain_end" and event["name"] in ["architect", "researcher", "analyst"]:
                yield f"data: {json.dumps({'type': 'node_update', 'node': event['name'], 'data': event['data'].get('output', {})})}\n\n"
            
            # 2. Capture Streaming Tokens (for real-time report writing)
            elif kind == "on_chat_model_stream":
                content = event["data"]["chunk"].content
                if content:
                    yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"

        # 3. Check for Interruption (Human-in-the-loop)
        final_state = await cognito_graph.aget_state(config)
        if final_state.next:
            yield f"data: {json.dumps({'type': 'interrupt', 'thread_id': thread_id})}\n\n"

    except Exception as e:
        print(f"Error in stream: {e}")
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    
    yield "data: [DONE]\n\n"

@app.post("/api/research/start")
async def start_research(request: ResearchRequest):
    thread_id = str(uuid.uuid4())
    return StreamingResponse(event_generator(thread_id, {"user_request": request.query}), media_type="text/event-stream")

@app.post("/api/research/approve")
async def approve_research(request: ApprovalRequest):
    if request.approved:
        return StreamingResponse(event_generator(request.thread_id, resume=True), media_type="text/event-stream")
    return {"status": "cancelled"}