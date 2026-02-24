from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from backend.graph.state import AgentState


def analyst_node(state: AgentState):
    """
    The analyst synthesizes the roaw data into a structured Markdown report.
    """

    llm = ChatOpenAI(model = 'gpt-4o-mini', temperature=0.4)

    prompt = ChatPromptTemplate.from_messages([
        ('system',"You are an expert Research Analyst. Synthesize the provided raw data "
                   "into a comprehensive, well-structured Markdown report. "
                   "Include a title, introduction, key findings, and conclusion."),
        ('user', "Original Request: {user_request}\n\nRaw Data: \n{gathered_data}")
    ])
    raw_data_list = state.get("gathered_data") or []
    if not isinstance(raw_data_list, list):
        raw_data_list = [str(raw_data_list)]
    
    data_str = "\n\n---\n\n".join(raw_data_list)
    # create the chain
    chain = prompt | llm
    result = chain.invoke({
        "user_request": state["user_request"],
        "gathered_data": data_str
    })

    return {
        "final_report": result.content,
        "current_agent": "analyst"
    }
