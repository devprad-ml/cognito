import requests
from bs4 import BeautifulSoup
from tavily import TavilyClient
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize Tavily
tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

def perform_search(query: str, max_results: int = 2) -> list:
    """Searches the web using Tavily and returns the top results."""
    try:
        response = tavily_client.search(query, search_depth="advanced", max_results=max_results)
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