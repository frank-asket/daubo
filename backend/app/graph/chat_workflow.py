from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import MessagesState

from app.config import Settings
from app.services.llm import chat_llm


def build_chat_graph(settings: Settings):
    llm = chat_llm(settings)

    async def agent(state: MessagesState) -> dict:
        reply = await llm.ainvoke(state["messages"])
        return {"messages": [reply]}

    graph = StateGraph(MessagesState)
    graph.add_node("agent", agent)
    graph.add_edge(START, "agent")
    graph.add_edge("agent", END)
    return graph.compile()
