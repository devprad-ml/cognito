import requests
from bs4 import BeautifulSoup
from tavily import TavilyClient
import os
from dotenv import load_dotenv

load_dotenv()

# Lazy Tavily client: instantiated on first use so module import never fails
# when the API key isn't present (lets tests collect, linters run, etc.).
_tavily_client: TavilyClient | None = None

def _get_tavily() -> TavilyClient:
    global _tavily_client
    if _tavily_client is None:
        _tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
    return _tavily_client

def perform_search(query: str, max_results: int = 2, time_range: str | None = None) -> list:
    """Searches the web using Tavily and returns the top results.

    time_range: optional recency filter — 'day', 'week', 'month', or 'year'.
    Restricts results to recently published/updated pages for time-sensitive queries.
    """
    try:
        params = {"search_depth": "advanced", "max_results": max_results}
        if time_range in ("day", "week", "month", "year"):
            params["time_range"] = time_range
        response = _get_tavily().search(query, **params)
        return response.get("results", [])
    except Exception as e:
        print(f"Search failed: {e}")
        return []

def scrape_url(url: str) -> str:
    """Scrapes a URL and extracts the main text using BeautifulSoup."""
    try:
        # Standard headers to prevent 403 Forbidden errors on basic websites
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Strip out noisy, non-content tags to save LLM tokens
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
            tag.extract()
        
        # Extract text with spaces between elements
        text = soup.get_text(separator=' ', strip=True)
        
        # Hard cap at ~15,000 characters to prevent blowing out the context window
        return text[:15000]
    
    except Exception as e:
        return f"Failed to scrape {url}: {str(e)}"