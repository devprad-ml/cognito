import os
import sys
import json
import uuid
import pytest
import pytest_asyncio
import asyncio
from datetime import datetime, timezone
from dotenv import load_dotenv

# --- WINDOWS ASYNCIO FIX FOR PSYCOPG ---
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# --- PATH FIX ---
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
sys.path.insert(0, root_dir)
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../.env'))
load_dotenv(env_path)

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from backend.graph.workflow import build_async_graph
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from backend.database.db import get_pool

# ---------------------------------------------------------------------------
# 1. GOLDEN DATASET — 20 questions, 5 domains, 3 difficulty tiers
# ---------------------------------------------------------------------------
EVAL_DATASET = [
    # Energy
    {"id": "e1", "domain": "Energy",      "difficulty": "medium", "question": "What are the key differences between solid-state batteries and lithium-ion batteries?"},
    {"id": "e2", "domain": "Energy",      "difficulty": "hard",   "question": "What are the main technical barriers preventing solid-state batteries from reaching mass-market EV production?"},
    {"id": "e3", "domain": "Energy",      "difficulty": "easy",   "question": "How does nuclear fusion differ from nuclear fission, and what is the current state of fusion energy research?"},
    {"id": "e4", "domain": "Energy",      "difficulty": "medium", "question": "What role does green hydrogen play in decarbonizing heavy industry?"},
    # AI & Robotics
    {"id": "r1", "domain": "AI/Robotics", "difficulty": "medium", "question": "Analyze the recent funding rounds of humanoid robotics startups."},
    {"id": "r2", "domain": "AI/Robotics", "difficulty": "hard",   "question": "What are the core architectural differences between transformer-based LLMs and mixture-of-experts models?"},
    {"id": "r3", "domain": "AI/Robotics", "difficulty": "medium", "question": "How are AI agents being used in software engineering workflows today?"},
    {"id": "r4", "domain": "AI/Robotics", "difficulty": "easy",   "question": "What is retrieval-augmented generation (RAG) and why is it used?"},
    # Finance
    {"id": "f1", "domain": "Finance",     "difficulty": "medium", "question": "What factors are currently driving volatility in the US commercial real estate market?"},
    {"id": "f2", "domain": "Finance",     "difficulty": "hard",   "question": "Compare the monetary policy approaches of the Federal Reserve and the European Central Bank over the past two years."},
    {"id": "f3", "domain": "Finance",     "difficulty": "medium", "question": "What is the current state of the IPO market and what companies are expected to go public soon?"},
    {"id": "f4", "domain": "Finance",     "difficulty": "easy",   "question": "What are stablecoins and how do they differ from other cryptocurrencies?"},
    # Health
    {"id": "h1", "domain": "Health",      "difficulty": "medium", "question": "What are the most promising approaches in GLP-1 drug development beyond Ozempic and Wegovy?"},
    {"id": "h2", "domain": "Health",      "difficulty": "hard",   "question": "How does CRISPR-Cas9 gene editing work, and what are its current clinical applications?"},
    {"id": "h3", "domain": "Health",      "difficulty": "medium", "question": "What is the current state of mRNA vaccine technology beyond COVID-19?"},
    {"id": "h4", "domain": "Health",      "difficulty": "easy",   "question": "What is the difference between Alzheimer's disease and other forms of dementia?"},
    # Geopolitics
    {"id": "g1", "domain": "Geopolitics", "difficulty": "medium", "question": "How have US semiconductor export controls affected the Chinese AI industry?"},
    {"id": "g2", "domain": "Geopolitics", "difficulty": "hard",   "question": "What are the geopolitical implications of rare earth mineral supply chains for the clean energy transition?"},
    {"id": "g3", "domain": "Geopolitics", "difficulty": "medium", "question": "What is the current status of EU AI regulation and how does it compare to the US approach?"},
    {"id": "g4", "domain": "Geopolitics", "difficulty": "easy",   "question": "What is the BRICS bloc and how has its membership changed recently?"},
    # Energy (extended)
    {"id": "e5", "domain": "Energy",      "difficulty": "hard",   "question": "What are the key engineering and economic challenges in building long-duration grid-scale energy storage?"},
    {"id": "e6", "domain": "Energy",      "difficulty": "medium", "question": "How is carbon capture and storage technology being deployed commercially today?"},
    {"id": "e7", "domain": "Energy",      "difficulty": "easy",   "question": "What is the difference between onshore and offshore wind energy, and which is more efficient?"},
    # AI/Robotics (extended)
    {"id": "r5", "domain": "AI/Robotics", "difficulty": "hard",   "question": "What are the main safety and alignment challenges researchers are trying to solve in frontier AI models?"},
    {"id": "r6", "domain": "AI/Robotics", "difficulty": "medium", "question": "How does reinforcement learning from human feedback (RLHF) work and what are its limitations?"},
    {"id": "r7", "domain": "AI/Robotics", "difficulty": "easy",   "question": "What is the difference between supervised learning, unsupervised learning, and reinforcement learning?"},
    # Finance (extended)
    {"id": "f5", "domain": "Finance",     "difficulty": "hard",   "question": "What are the systemic risks posed by the growth of private credit markets globally?"},
    {"id": "f6", "domain": "Finance",     "difficulty": "medium", "question": "How has the rise of passive investing through ETFs affected price discovery in equity markets?"},
    {"id": "f7", "domain": "Finance",     "difficulty": "easy",   "question": "What is quantitative easing and how does it affect inflation and asset prices?"},
    # Health (extended)
    {"id": "h5", "domain": "Health",      "difficulty": "hard",   "question": "What are the current scientific debates around the microbiome's role in mental health and neurological disease?"},
    {"id": "h6", "domain": "Health",      "difficulty": "medium", "question": "What is the current state of CAR-T cell therapy and which cancers is it most effective against?"},
    {"id": "h7", "domain": "Health",      "difficulty": "easy",   "question": "What is the difference between Type 1 and Type 2 diabetes and how are they treated?"},
]

# ---------------------------------------------------------------------------
# 2. MULTI-DIMENSIONAL LLM JUDGE
# ---------------------------------------------------------------------------
JUDGE_SYSTEM_PROMPT = """You are a strict AI Research Quality Evaluator.

Score the research report on FOUR dimensions, each from 1 to 5:

- accuracy:       Are the facts correct and well-supported?
- depth:          Does it go beyond surface-level? Are nuances covered?
- hallucination:  Are there invented facts or unsupported claims?
                  5 = zero hallucinations detected, 1 = many hallucinations.
- citations:      Are sources referenced and claims attributed?

Respond ONLY with a valid JSON object, no markdown, no explanation:
{{"accuracy": <1-5>, "depth": <1-5>, "hallucination": <1-5>, "citations": <1-5>}}"""

async def evaluate_quality(question: str, report: str) -> dict:
    """Score a report on 4 dimensions. Returns scores + weighted composite."""
    judge_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    prompt = ChatPromptTemplate.from_messages([
        ("system", JUDGE_SYSTEM_PROMPT),
        ("user", "Question: {question}\n\nReport:\n{report}")
    ])
    result = await (prompt | judge_llm).ainvoke({"question": question, "report": report})
    try:
        scores = json.loads(result.content.strip())
        scores["composite"] = round(
            scores["accuracy"]      * 0.30 +
            scores["depth"]         * 0.25 +
            scores["hallucination"] * 0.30 +
            scores["citations"]     * 0.15,
            3
        )
        return scores
    except Exception as e:
        print(f"  ⚠️  Judge parse failed: {e} — raw: {result.content}")
        return {"accuracy": 1, "depth": 1, "hallucination": 1, "citations": 1, "composite": 1.0}

# ---------------------------------------------------------------------------
# 3. POSTGRES PERSISTENCE
# ---------------------------------------------------------------------------
CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS eval_runs (
    id            TEXT PRIMARY KEY,
    run_id        TEXT        NOT NULL,
    run_at        TIMESTAMPTZ NOT NULL,
    question_id   TEXT        NOT NULL,
    domain        TEXT        NOT NULL,
    difficulty    TEXT        NOT NULL,
    question      TEXT        NOT NULL,
    accuracy      NUMERIC(3,2),
    depth         NUMERIC(3,2),
    hallucination NUMERIC(3,2),
    citations     NUMERIC(3,2),
    composite     NUMERIC(5,3)
);
"""

async def save_result(pool, run_id: str, run_at: datetime, item: dict, scores: dict):
    async with pool.connection() as conn:
        await conn.execute(CREATE_TABLE_SQL)
        await conn.execute(
            """INSERT INTO eval_runs
               (id, run_id, run_at, question_id, domain, difficulty, question,
                accuracy, depth, hallucination, citations, composite)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (id) DO NOTHING""",
            (
                str(uuid.uuid4()), run_id, run_at,
                item["id"], item["domain"], item["difficulty"], item["question"],
                scores["accuracy"], scores["depth"],
                scores["hallucination"], scores["citations"], scores["composite"],
            )
        )

# ---------------------------------------------------------------------------
# 4. FIXTURES
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def cognito_app():
    pool = await get_pool()
    checkpointer = AsyncPostgresSaver(pool)
    await checkpointer.setup()
    return await build_async_graph(checkpointer)

# ---------------------------------------------------------------------------
# 5. REGRESSION GATE TEST
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_cognito_regression_gate(cognito_app):
    """
    Runs all 20 golden-dataset questions through the full multi-agent graph.
    Scores each report on 4 dimensions via LLM-as-judge.
    Persists every result to Postgres for the dashboard.
    FAILS the build if the weighted composite average drops below 3.5 / 5.0.
    """
    pool   = await get_pool()
    run_id = str(uuid.uuid4())
    run_at = datetime.now(timezone.utc)
    scores_list = []

    for i, item in enumerate(EVAL_DATASET):
        q = item["question"]
        print(f"\n🧪 [{i+1}/{len(EVAL_DATASET)}] ({item['domain']} / {item['difficulty']})")
        print(f"   {q}")

        config = {"configurable": {"thread_id": f"eval_{run_id}_{item['id']}"}}
        final_state = await cognito_app.ainvoke({"user_request": q, "progress_callback": None, "research_progress": []}, config)
        report = final_state.get("final_report", "")

        print("   ⚖️  Judging…")
        scores = await evaluate_quality(q, report)
        print(
            f"   📊 accuracy={scores['accuracy']}  depth={scores['depth']}  "
            f"hallucination={scores['hallucination']}  citations={scores['citations']}  "
            f"→ composite={scores['composite']}"
        )

        await save_result(pool, run_id, run_at, item, scores)
        scores_list.append(scores["composite"])

    avg = round(sum(scores_list) / len(scores_list), 3)
    print(f"\n{'='*52}")
    print(f"  RUN {run_id[:8]}   |   AVG COMPOSITE: {avg} / 5.0")
    print(f"{'='*52}\n")

    assert avg >= 3.5, f"❌ REGRESSION DETECTED — composite avg = {avg}/5"