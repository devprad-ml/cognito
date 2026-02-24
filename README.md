Cognito: Multi-Agent AI Research Assistant

Cognito is an intelligent, multi-agent AI research platform. It leverages an orchestrated team of AI agents (Architect, Researcher, and Analyst) to autonomously break down complex queries, search the web, scrape deep content, and synthesize comprehensive Markdown reports—all streamed in real-time to a modern Next.js frontend.

🚀 The Multi-Agent Workflow

When a user submits a research query, the request flows through a LangGraph-orchestrated state machine.

graph TD
    %% Define Nodes
    User[User UI / Next.js]
    API[FastAPI Endpoint]
    Graph{LangGraph Orchestrator}
    Arch[🤖 Architect Agent]
    Res[🔍 Researcher Agent]
    Ana[✍️ Analyst Agent]
    Web[(The Web)]
    DB[(PostgreSQL DB)]

    %% Define Flow
    User -->|Sends Query| API
    API -->|Starts Thread| Graph
    Graph -->|1. Plans| Arch
    Arch -->|Research Plan| Res
    Res <-->|Searches & Scrapes| Web
    Res -->|Raw Extracted Data| Ana
    Ana -->|Synthesizes| Graph
    Graph -->|Final Report| API
    API -.->|Real-time SSE Stream| User
    
    %% Database Checkpointing
    Graph -.->|Saves State| DB


Agent Roles:

The Architect (gpt-4o): Analyzes the prompt and breaks it down into a 3-5 step actionable research plan.

The Researcher (gpt-4o-mini + Tools): Executes the plan. Uses the Tavily API to search the web and BeautifulSoup to scrape the raw text from URLs, extracting key facts.

The Analyst (gpt-4o): Takes the massive list of raw data from the Researcher and writes a clean, formatted Markdown report.

🛠️ Tech Stack

Frontend:

Next.js (App Router, Turbopack)

React & Tailwind CSS

Lucide Icons

Server-Sent Events (SSE) for real-time UI updates

Backend:

Python & FastAPI

LangGraph & LangChain (Multi-Agent Orchestration)

OpenAI API (gpt-4o, gpt-4o-mini)

Tavily Search API

BeautifulSoup4 (Web Scraping)

Infrastructure:

PostgreSQL (via Docker) with pgvector for LangGraph state checkpointing.

⚙️ Prerequisites

Before you begin, ensure you have the following installed:

Node.js (v18 or higher)

Python (v3.10 or higher)

Docker Desktop

API Keys for OpenAI and Tavily.

💻 Local Setup Instructions

1. Start the Database (Docker)

Open a terminal in the root of your project and start the PostgreSQL container:

docker compose up -d


(Note: To verify it is running, check Docker Desktop or run docker ps. CPU usage will be near 0% until the backend connects, which is normal).

2. Configure Environment Variables

Create a .env file in the backend directory (and frontend if required).
backend/.env:

OPENAI_API_KEY=sk-your-openai-api-key
TAVILY_API_KEY=tvly-your-tavily-api-key
POSTGRES_URI=postgresql://admin:password123@localhost:5432/cognito


3. Setup and Run the Backend (FastAPI)

Open a new terminal and navigate to the backend folder:

cd backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment (Windows)
.\venv\Scripts\activate
# (Mac/Linux: source venv/bin/activate)

# Install dependencies
pip install fastapi uvicorn langchain langchain-openai langgraph langgraph-checkpoint-postgres beautifulsoup4 tavily-python pydantic psycopg-pool python-dotenv

# Run the server
uvicorn main:app --reload


You should see 🚀 COGNITO GRAPH READY in your terminal.

4. Setup and Run the Frontend (Next.js)

Open another terminal and navigate to the frontend folder:

cd frontend

# Install Node modules
npm install

# Start the development server
npm run dev


5. Access the Application

Open your browser and navigate to: http://localhost:3000

🐛 Troubleshooting & Tips

ModuleNotFoundError: No module named 'langgraph': This means your Python terminal is not using your virtual environment. Make sure you run .\venv\Scripts\activate before running uvicorn.

Database Connection Failed / Hanging: Ensure Docker is running. If localhost fails inside a custom network setup, verify your POSTGRES_URI in the .env file.

UI jumps straight to "Completed": This usually happens if the OpenAI API key is missing or out of credits, causing the agents to return empty data. Check your backend terminal for LLM errors.

Missing UI/Blank Screen: Ensure you are editing frontend/app/page.tsx. Delete any old App.tsx mockup files that might be confusing Next.js.