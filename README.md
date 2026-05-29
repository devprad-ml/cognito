# Cognito: Multi-Agent AI Research Assistant

Cognito is an intelligent, multi-agent AI research platform. It orchestrates a team of AI agents — **Architect**, **Researcher**, **Analyst**, and **Critic** — to autonomously break down complex queries, search the web, scrape deep content, synthesize comprehensive Markdown reports, and self-review them for quality, all streamed in real-time to a modern Next.js frontend.

---

## 🚀 The Multi-Agent Workflow

When a user submits a research query, the request flows through a **LangGraph-orchestrated async state machine**:

```mermaid
graph TD
    User[User UI / Next.js]
    API[FastAPI Endpoint]
    Graph{LangGraph Orchestrator}
    Arch[🤖 Architect Agent]
    Res[🔍 Researcher Agent]
    Ana[✍️ Analyst Agent]
    Crit[🧐 Critic Agent]
    Web[(The Web)]
    DB[(PostgreSQL DB)]

    User -->|Sends Query| API
    API -->|Starts Thread| Graph
    Graph -->|1. Plans| Arch
    Arch -->|Research Plan| Res
    Res <-->|Searches & Scrapes| Web
    Res -->|Raw Extracted Data| Ana
    Ana -->|Draft Report| Crit
    Crit -->|"insufficient (≤ MAX_REVISIONS)"| Res
    Crit -->|Approved Report| Graph
    Graph -->|Final Report| API
    API -.->|Real-time SSE Stream| User
    Graph -.->|Saves State| DB
```

### Agent Roles

| Agent | Model | Role |
|---|---|---|
| **Architect** | `gpt-4o-mini` | Analyzes the prompt and produces a 3–5 step actionable research plan using structured output. |
| **Researcher** | `gpt-4o-mini` + Tools | Executes the plan in an autonomous tool loop. Uses Tavily to search the web and BeautifulSoup to scrape URLs, extracting key facts with LLM assistance. On a revision pass it researches only the gaps the Critic flagged. |
| **Analyst** | `gpt-4o-mini` | Takes the Researcher's raw data and writes a clean, formatted Markdown report. |
| **Critic** | `gpt-4o-mini` | Reviews the draft report (LLM-as-judge). If it's insufficient, it returns specific gaps and the graph loops back to the Researcher for a focused second pass (bounded by `MAX_REVISIONS`). |

> All agent nodes are **async** (`async def`) and use `ainvoke` for LangChain chains, making them compatible with LangGraph's async graph execution.

---

## 🛠️ Tech Stack

**Frontend**
- Next.js (App Router, Turbopack)
- React & Tailwind CSS
- Lucide Icons
- Server-Sent Events (SSE) for real-time UI updates

**Backend**
- Python & FastAPI (async)
- LangGraph & LangChain (Multi-Agent Orchestration)
- OpenAI API (`gpt-4o-mini`)
- Tavily Search API
- BeautifulSoup4 & Requests (Web Scraping)

**Infrastructure**
- PostgreSQL (via Docker) with `pgvector` for LangGraph state checkpointing

---

## ⚙️ Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **Python** (v3.10 or higher)
- **Docker Desktop**
- API Keys for **OpenAI** and **Tavily**

---

## 💻 Local Setup Instructions

### 1. Start the Database (Docker)

Open a terminal at the project root and start the PostgreSQL container:

```bash
docker compose up -d
```

> To verify it's running, check Docker Desktop or run `docker ps`. CPU usage will be near 0% until the backend connects — this is normal.

### 2. Configure Environment Variables

Create a `.env` file inside the `backend/` directory:

```env
OPENAI_API_KEY=sk-your-openai-api-key
TAVILY_API_KEY=tvly-your-tavily-api-key
POSTGRES_URI=postgresql://admin:password123@localhost:5432/cognito
```

### 3. Setup and Run the Backend (FastAPI)

Open a new terminal and navigate to the `backend/` folder:

```bash
cd backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server (from inside the backend/ directory)
uvicorn main:app --reload
```

You should see `✅ Cognito Graph Ready` in your terminal.

> **Important:** Run `uvicorn` from *inside* the `backend/` directory. Module imports are relative to that folder.

### 4. Setup and Run the Frontend (Next.js)

Open another terminal and navigate to the `frontend/` folder:

```bash
cd frontend

# Install Node modules
npm install

# Start the development server
npm run dev
```

### 5. Access the Application

Open your browser and navigate to: [http://localhost:3000](http://localhost:3000)

---

## 🧪 AI Quality Regression Tests

Cognito includes an **LLM-as-Judge** evaluation suite (`backend/tests/test_ai_quality.py`). It runs the full multi-agent graph against a 20-question golden dataset (5 domains × 3 difficulty tiers) and uses `gpt-4o-mini` to score each report on four dimensions (accuracy, depth, hallucination, citations) from 1–5. The build fails if the weighted **composite** average falls below **3.5/5.0**.

To run the tests locally:

```bash
cd backend
# Ensure your virtual environment is active and .env is configured
pytest tests/test_ai_quality.py -v -s
```

The same tests run automatically in CI via GitHub Actions on every push or pull request to `main`.

---

## 🐛 Troubleshooting & Tips

**`ModuleNotFoundError: No module named 'langgraph'`**
Your terminal is not using the virtual environment. Run `.\venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Mac/Linux) before running `uvicorn`.

**`ModuleNotFoundError: No module named 'backend'`**
Make sure you run `uvicorn main:app --reload` from *inside* the `backend/` directory, not the project root.

**Database Connection Failed / Hanging**
Ensure Docker is running. Verify your `POSTGRES_URI` in `backend/.env` uses `localhost:5432`.

**UI jumps straight to "Completed" with no content**
Usually means the OpenAI API key is missing or out of credits, causing agents to return empty data. Check your backend terminal for LLM errors.

**Missing UI / Blank Screen**
Ensure you're editing `frontend/app/page.tsx`. Delete any stale `App.tsx` files that might confuse Next.js routing.

---

## 🔧 Bug Fixes Applied

The following bugs were identified and fixed from the original codebase:

| # | File | Bug | Fix |
|---|---|---|---|
| 1 | `backend/main.py` | Import paths used `backend.` prefix, breaking when uvicorn runs from inside `backend/` | Changed to `from database.db import ...` and `from graph.workflow import ...` |
| 2 | `backend/main.py` | `event_generator` had an empty interrupt-check stub — interrupt events were never sent | Added `aget_state()` call and interrupt SSE event emission |
| 3 | `backend/graph/workflow.py` | Created a duplicate `AsyncConnectionPool` inside `build_async_graph`, ignoring the passed-in `checkpointer` and leaking connections | Removed the orphaned pool; the function now uses the `checkpointer` argument correctly |
| 4 | `backend/agents/manager.py` | `architect_node` was a sync `def`, blocking the async event loop | Converted to `async def` with `await planner.ainvoke(...)` |
| 5 | `backend/agents/manager.py` | `ChatPromptTemplate` had `state["user_request"]` as a hardcoded literal instead of the `{user_request}` template variable | Changed to `("user", "{user_request}")` so `.ainvoke()` substitutes correctly |
| 6 | `backend/agents/researcher.py` | `researcher_node` was sync and used blocking `chain.invoke(...)` | Converted to `async def` with `await chain.ainvoke(...)` |
| 7 | `backend/agents/analyst.py` | `analyst_node` was sync and used blocking `chain.invoke(...)` | Converted to `async def` with `await chain.ainvoke(...)` |
| 8 | `backend/requirements.txt` | `requests` package was missing despite being used in `search_scraper.py` | Added `requests>=2.31.0` |
| 9 | `.github/workflows/ai-regression-gate.yml` | YAML indentation error on the Install Dependencies step caused CI parse failure | Fixed indentation alignment |
