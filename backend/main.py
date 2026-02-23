from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from backend.graph.workflow import build_async_graph
import uuid
import json
import asyncio

app = FastAPI(title="Cognito Production API")

class ResearchRequest(BaseModel):
    query: str

class ApprovalRequest(BaseModel):
    thread_id: str
    approved: bool

# We will initialize the graph dynamically on startup
cognito_graph = None

@app.on_event("startup")
async def startup_event():
    global cognito_graph
    cognito_graph = await build_async_graph()

async def event_generator(thread_id: str, state_input: dict = None, resume: bool = False):
    """Generates Server-Sent Events (SSE) by streaming LangGraph output."""
    config = {"configurable": {"thread_id": thread_id}}
    
    try:
        # astream_events yields token-by-token and node-by-node updates
        stream_target = None if resume else state_input
        
        async for event in cognito_graph.astream_events(stream_target, config, version="v1"):
            event_type = event["event"]
            
            # Stream LLM tokens in real-time
            if event_type == "on_chat_model_stream":
                chunk = event["data"]["chunk"].content
                if chunk:
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
            
            # Notify frontend when an agent finishes its task
            elif event_type == "on_chain_end" and event.get("name") in ["architect", "researcher", "analyst"]:
                output = event["data"].get("output", {})
                yield f"data: {json.dumps({'type': 'node_update', 'node': event['name'], 'data': output})}\n\n"

        # Check if we hit the human-in-the-loop interrupt
        final_state = await cognito_graph.aget_state(config)
        if final_state.next and "researcher" in final_state.next:
            yield f"data: {json.dumps({'type': 'interrupt', 'message': 'Awaiting Human Approval'})}\n\n"

    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    
    yield "data: [DONE]\n\n"

@app.post("/api/research/start")
async def start_research(request: ResearchRequest):
    """Starts a new research thread and streams the Architect's planning phase."""
    thread_id = str(uuid.uuid4())
    
    initial_state = {
        "user_request": request.query,
        "messages": [],
        "current_agent": "system"
    }
    
    # Return a StreamingResponse to keep the connection open and stream events
    return StreamingResponse(
        event_generator(thread_id, initial_state), 
        media_type="text/event-stream"
    )

@app.post("/api/research/approve")
async def approve_research(request: ApprovalRequest):
    """Resumes the graph after human approval and streams Researcher & Analyst."""
    config = {"configurable": {"thread_id": request.thread_id}}
    state = await cognito_graph.aget_state(config)
    
    if not state.next:
        raise HTTPException(status_code=400, detail="No pending actions for this thread.")
        
    if request.approved:
        # Update state to clear the approval flag
        await cognito_graph.aupdate_state(config, {"requires_approval": False})
        
        # Resume graph execution asynchronously
        return StreamingResponse(
            event_generator(request.thread_id, resume=True), 
            media_type="text/event-stream"
        )
    else:
        return {"status": "cancelled"}