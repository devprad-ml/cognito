import pytest
import asyncio
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from backend.graph.workflow import build_async_graph
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from backend.database.db import get_pool

# A small "Golden Dataset" of prompts we expect the AI to answer well
EVAL_DATASET = [
    "What are the key differences between solid-state batteries and lithium-ion?",
    "Analyze the recent funding rounds of humanoid robotics startups in 2024."
]

@pytest.fixture
async def cognito_app():
    """Setup the graph for testing."""
    pool = await get_pool()
    checkpointer = AsyncPostgresSaver(pool)
    await checkpointer.setup()
    app = await build_async_graph(checkpointer)
    return app

async def evaluate_quality(question: str, final_report: str) -> int:
    """Uses GPT-4o-mini as an objective judge to score the response from 1 to 5."""
    judge_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an AI Quality Evaluator. Grade the provided research report based on the original question. "
                   "Score from 1 to 5 based on Accuracy, Depth, and Lack of Hallucination. "
                   "Respond ONLY with the integer number."),
        ("user", "Question: {question}\n\nReport: {report}")
    ])
    
    chain = prompt | judge_llm
    result = await chain.ainvoke({"question": question, "report": final_report})
    
    try:
        return int(result.content.strip())
    except:
        return 1 # Fail safe

@pytest.mark.asyncio
async def test_cognito_regression_gate(cognito_app):
    """
    Runs the dataset through the graph and asserts the average score is >= 4.0.
    If the score drops below 4.0, the CI/CD pipeline fails!
    """
    total_score = 0
    
    for i, question in enumerate(EVAL_DATASET):
        print(f"\n🧪 Evaluating Prompt {i+1}: {question}")
        
        # Run the graph
        config = {"configurable": {"thread_id": f"test_thread_{i}"}}
        final_state = await cognito_app.ainvoke({"user_request": question}, config)
        
        report = final_state.get("final_report", "")
        
        # Score the output
        score = await evaluate_quality(question, report)
        print(f"📊 Quality Score: {score}/5")
        
        total_score += score
        
    avg_score = total_score / len(EVAL_DATASET)
    print(f"\n🏆 Final Average Quality Score: {avg_score}/5")
    
    # THE REGRESSION GATE: Fail the build if average quality is below 4.0 (80%)
    assert avg_score >= 4.0, f"Regression detected! Quality dropped to {avg_score}/5"
