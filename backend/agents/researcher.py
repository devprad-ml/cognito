from langchain_Core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from backend.graph.state import AgentState



def researcher_node(state: AgentState):
    """ The researcher executes the plan using search and scraping tools"""

    llm  = ChatOpenAI(model='gpt-4o-mini', temperature = 0.2)
    plan = state.get("plan",[])

    # mocking the tool execution for the same of the structural template.
    # in production, bind tools to the LLM: llm_with_tools = llm.bind_tools([TavilySearchResults()])

    gathered_data = []

    for step in plan:
        simulated_search_result = f"Data gathered for: '{step}'. Found relevant metrics and context"
        gathered_data.append(simulated_search_result)
    
    return {
        "gathered_data": gathered_data,
        "current_agent": "researcher",
        "requires_approval": False
    }