from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field
from backend.graph.state import AgentState

class ResearchPlan(BaseModel):
    '''Structured output for the research plan'''
    steps: list[str] = Field(
        description="3 to 5 discrete subtasks for the researcher to execute.")

def architect_node(state: AgentState):
    '''
    The architect (manager) analyzes the user's request 
    and breaks in into sub-tasks'''

    llm = ChatOpenAI(model = 'gpt-4o-mini', temperature=0)

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", "You are the Architect of a multi-agent research team. "
                   "Break the user's research request into 3 to 5 clear, actionable search tasks. "
                   "These tasks will be executed by a web-searching AI."),
            ("user",state["user_request"])
        ]
    )

    # chain prompt to LLM to output the structured Pydantic model

    planner = prompt | llm.with_structured_output(ResearchPlan)

    plan_result = planner.invoke({"user_request": state["user_request"]})
    
    print(f"✅ ARCHITECT PLAN GENERATED:")

    return {
        "plan": plan_result.steps,
        "current_agent": "architect",
        
    }

    