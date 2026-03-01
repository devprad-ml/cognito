import os
import sys
import pytest
import pytest_asyncio
import asyncio
from dotenv import load_dotenv

# --- WINDOWS ASYNCIO FIX FOR PSYCOPG ---
# Psycopg cannot use the default Windows ProactorEventLoop. 
# This forces Windows to use the compatible SelectorEventLoop.
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# --- CRITICAL PATH FIX ---
# This dynamically adds the root 'cognito' folder to Python's path
# so it can perfectly find the 'backend' folder, no matter where you run the command.
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
sys.path.insert(0, root_dir)

# Explicitly load the .env file from the backend directory
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../.env'))
load_dotenv(env_path)

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from backend.graph.workflow import build_async_graph
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from backend.database.db import get_pool

# 1. THE GOLDEN DATASET
EVAL_DATASET = [
    "What are the key differences between solid-state batteries and lithium-ion?",
    "Analyze the recent funding rounds of humanoid robotics startups."
]

@pytest_asyncio.fixture
async def cognito_app():
    """Setup the LangGraph environment and Database for testing."""
    pool = await get_pool()
    checkpointer = AsyncPostgresSaver(pool)
    await checkpointer.setup()
    app = await build_async_graph(checkpointer)
    return app

async def evaluate_quality(question: str, final_report: str) -> int:
    """Uses GPT-4o-mini as an objective judge to score the response from 1 to 5."""
    judge_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a strict AI Quality Evaluator. Grade the provided research report based on the original question. "
                   "Score from 1 to 5 based on Accuracy, Depth, and Lack of Hallucination. "
                   "Respond ONLY with the integer number (e.g., '4')."),
        ("user", "Question: {question}\n\nReport: {report}")
    ])
    
    chain = prompt | judge_llm
    result = await chain.ainvoke({"question": question, "report": final_report})
    
    try:
        return int(result.content.strip())
    except Exception as e:
        print(f"Failed to parse judge score: {e}")
        return 1 # Fail safe

@pytest.mark.asyncio
async def test_cognito_regression_gate(cognito_app):
    """
    Runs the dataset through the graph and asserts the average score is >= 4.0.
    """
    total_score = 0
    
    for i, question in enumerate(EVAL_DATASET):
        print(f"\n\n🧪 EVALUATING PROMPT {i+1}/{len(EVAL_DATASET)}: '{question}'")
        
        # 1. Run the multi-agent graph
        config = {"configurable": {"thread_id": f"pytest_eval_thread_{i}"}}
        print("   🤖 Agents are researching and writing... (this takes a moment)")
        final_state = await cognito_app.ainvoke({"user_request": question}, config)
        
        report = final_state.get("final_report", "")
        
        # 2. Score the output using the Judge LLM
        print("   ⚖️  Judging the final report...")
        score = await evaluate_quality(question, report)
        print(f"   📊 QUALITY SCORE: {score}/5")
        
        total_score += score
        
    avg_score = total_score / len(EVAL_DATASET)
    print(f"\n======================================")
    print(f"🏆 FINAL AVERAGE QUALITY SCORE: {avg_score}/5")
    print(f"======================================")
    
    # THE REGRESSION GATE: Fail the build if average quality is below 4.0 (80%)
    assert avg_score >= 4.0, f"❌ REGRESSION DETECTED! Quality dropped to {avg_score}/5"