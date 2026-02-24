from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from backend.graph.state import AgentState
from backend.tools.search_scraper import perform_search, scrape_url


def researcher_node(state: AgentState):
    """
    The Researcher executes the Architect's plan using Tavily search 
    and BeautifulSoup web scraping.
    """
    # Using 'mini' here saves costs since this agent does a lot of heavy reading/extraction
    extraction_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.1)
    
    plan = state.get("plan", [])
    gathered_data = state.get("gathered_data", [])
    if not gathered_data:
        gathered_data = []
    
    # Iterate through the Architect's plan
    for step in plan:
        step_results = f"### Research for Sub-task: {step}\n"
        
        # 1. Search the web
        search_results = perform_search(step, max_results=2)
        
        for result in search_results:
            url = result.get('url')
            title = result.get('title')
            snippet = result.get('content')
            
            step_results += f"\n**Source**: {title} ({url})\n"
            step_results += f"**Tavily Snippet**: {snippet}\n"
            
            # 2. Scrape the actual webpage for deeper context
            if url:
                raw_page_content = scrape_url(url)
                
                # 3. Use LLM to extract relevant facts from the raw HTML text
                if not raw_page_content.startswith("Failed"):
                    extraction_prompt = ChatPromptTemplate.from_messages([
                        ("system", "You are an expert research assistant. Extract the most important facts, data points, "
                                   "and metrics from the provided raw website text based on the user's objective. "
                                   "Ignore irrelevant ads or navigation text. Keep it concise and bulleted."),
                        ("user", "Objective: {objective}\n\nRaw Website Text:\n{text}")
                    ])
                    
                    chain = extraction_prompt | extraction_llm
                    extracted_info = chain.invoke({
                        "objective": step,
                        "text": raw_page_content
                    })
                    
                    step_results += f"**Deep Dive Extraction**: \n{extracted_info.content}\n"
                else:
                    step_results += f"**Deep Dive Extraction**: {raw_page_content}\n"
                    
        gathered_data.append(step_results)
        
    return {
        "gathered_data": gathered_data,
        "current_agent": "researcher"
    }