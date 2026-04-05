import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any
from services.github import analyze_repo as github_analyze_repo
from services.ai import analyze_repo as ai_analyze_repo
from services.ai import analyze_goal as ai_analyze_goal
from services.ai import classify_tasks as ai_classify_tasks
from services.ai import write_tickets as ai_write_tickets
from services.ai import chat_tickets as ai_chat_tickets

router = APIRouter()

class AnalyzeRequest(BaseModel):
  repo_url: str

@router.post("/ai/analyze")
async def analyze_with_ai(body: AnalyzeRequest):
  try:
    repo_data = await github_analyze_repo(body.repo_url)
    analysis = await ai_analyze_repo(repo_data)
    return analysis
  except json.JSONDecodeError:
    raise HTTPException(status_code=500, detail="AI returned invalid JSON")
  except Exception as e:
    raise HTTPException(status_code=502, detail=str(e))

class AnalyzeGoalRequest(BaseModel):
  goal: str
  analysis: dict

@router.post("/ai/decompose")
async def analyze_goal_with_ai(body: AnalyzeGoalRequest):
  try:
    decomposed = await ai_analyze_goal(body.goal, body.analysis)
    return decomposed
  except json.JSONDecodeError:
    raise HTTPException(status_code=500, detail="AI returned invalid JSON")
  except Exception as e:
    raise HTTPException(status_code=502, detail=str(e))

class ClassifyTasksRequest(BaseModel):
  decomposition: dict
  analysis: dict
  repo_data: dict

@router.post("/ai/classify")
async def classify_tasks_with_ai(body: ClassifyTasksRequest):
  try:
    classified = await ai_classify_tasks(body.decomposition, body.repo_data, body.analysis)
    return classified
  except json.JSONDecodeError:
    raise HTTPException(status_code=500, detail="AI returned invalid JSON")
  except Exception as e:
    raise HTTPException(status_code=502, detail=str(e))


class WriteTicketsRequest(BaseModel):
  classified: dict
  analysis: dict
  repo_data: dict

@router.post("/ai/tickets")
async def write_tickets(body: WriteTicketsRequest):
  try:
    tickets = await ai_write_tickets(body.classified, body.repo_data, body.analysis)
    return tickets
  except json.JSONDecodeError:
    raise HTTPException(status_code=500, detail="AI returned invalid JSON")
  except Exception as e:
    raise HTTPException(status_code=502, detail=str(e))


class ChatMessageItem(BaseModel):
  role: str  # "user" | "ai"
  content: str

class ChatRequest(BaseModel):
  messages: list[ChatMessageItem]
  tickets: list[dict[str, Any]]
  team: list[dict[str, Any]] = Field(default_factory=list)

@router.post("/ai/chat")
async def chat(body: ChatRequest):
  try:
    result = await ai_chat_tickets(
      [m.model_dump() for m in body.messages],
      body.tickets,
      body.team,
    )
    return result
  except json.JSONDecodeError:
    raise HTTPException(status_code=500, detail="AI returned invalid JSON")
  except Exception as e:
    raise HTTPException(status_code=502, detail=str(e))
