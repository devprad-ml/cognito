from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field
from backend.graph.state import AgentState


class Critique(BaseModel):
    """Structured editorial verdict on a research report."""
    sufficient: bool = Field(
        description="True ONLY if the report fully and accurately answers the original "
                    "request with adequate depth and cited sources.")
    feedback: str = Field(
        description="One or two sentences explaining the verdict.")
    missing: list[str] = Field(
        default_factory=list,
        description="Specific information gaps that another round of web research should "
                    "fill. Leave empty if the report is sufficient.")


CRITIC_SYSTEM = (
    "You are a demanding editorial critic for an AI research team. Judge whether the report "
    "fully and accurately answers the original request: is it complete, sufficiently deep, "
    "and are its claims backed by cited sources? Be fair but rigorous. If the report falls "
    "short, list the SPECIFIC missing pieces that another round of web research could fix. "
    "Do not demand limitless detail — approve a report that genuinely answers the question."
)


async def critic_node(state: AgentState):
    """Reviews the analyst's report. If it's insufficient, returns concrete gaps so the
    graph can loop back to the researcher for a focused second pass."""
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    prompt = ChatPromptTemplate.from_messages([
        ("system", CRITIC_SYSTEM),
        ("user", "Original request:\n{request}\n\nReport to review:\n{report}"),
    ])
    chain = prompt | llm.with_structured_output(Critique)

    result = await chain.ainvoke({
        "request": state["user_request"],
        "report": state.get("final_report", "") or "",
    })

    verdict = "✅ sufficient" if result.sufficient else "🔁 needs revision"
    print(f"🧐 CRITIC: {verdict} — {result.feedback}")

    return {
        "critique_passed": result.sufficient,
        "critique": result.feedback,
        "missing_info": result.missing,
        "current_agent": "critic",
    }
