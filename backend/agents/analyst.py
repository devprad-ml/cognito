from datetime import date
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from backend.graph.state import AgentState


async def analyst_node(state: AgentState):
    """
    The analyst synthesizes the raw data into a structured Markdown report.
    """

    llm = ChatOpenAI(model = 'gpt-4o-mini', temperature=0.4)

    prompt = ChatPromptTemplate.from_messages([
        ('system', f"{date.today().isoformat()}. "
                   "You are an expert Research Analyst. Synthesize the provided raw data "
                   "into a comprehensive, well-structured text report. "
                   "Include a title, introduction, key findings, and conclusion. "
                   "Base the report ONLY on the supplied raw data "
                   " Do NOT rely on your own training knowledge"
                   "When you state dates or 'as of' timing, use the current date "
                   "above"),
        ('user', "Original Request: {user_request}\n\nRaw Data: \n{gathered_data}")
    ])
    raw_data_list = state.get("gathered_data") or []
    if not isinstance(raw_data_list, list):
        raw_data_list = [str(raw_data_list)]

    data_str = "\n\n---\n\n".join(raw_data_list)

    # On a revision pass, fold the critic's feedback into the data so the rewrite
    # explicitly addresses what was missing.
    is_revision = state.get("research_rounds", 0) > 1 and not state.get("critique_passed", False)
    if is_revision and state.get("critique"):
        data_str += (
            f"\n\n---\n\nREVISION NOTE — a reviewer flagged the previous draft: "
            f"{state['critique']}. Make sure this revised report resolves it."
        )

    # create the chain
    chain = prompt | llm
    result = await chain.ainvoke({
        "user_request": state["user_request"],
        "gathered_data": data_str
    })

    return {
        "final_report": result.content,
        "current_agent": "analyst"
    }
