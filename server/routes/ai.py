import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any
from db.database import Session
from services.github import analyze_repo as github_analyze_repo
from services.ai import analyze_repo as ai_analyze_repo
from services.ai import analyze_goal as ai_analyze_goal
from services.ai import classify_tasks as ai_classify_tasks
from services.ai import write_tickets as ai_write_tickets
from services.ai import chat_tickets as ai_chat_tickets
from services.indexing import index_repo as run_index_repo

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


class IndexRepoRequest(BaseModel):
  """Chunk + embed a repo into code_chunks for an existing projects.id"""
  project_id: int = Field(..., ge=1)
  repo_url: str | None = None
  repo_data: dict[str, Any] | None = Field(
    default=None,
    description="Output shape from /github/analyze; if set, repo_url is ignored.",
  )

@router.post("/ai/index")
async def index_repo_endpoint(body: IndexRepoRequest):
  if body.repo_data is None and body.repo_url is None:
    raise HTTPException(
      status_code=400,
      detail="Provide repo_data or repo_url.",
    )
  try:
    if body.repo_data is not None:
      repo_data = body.repo_data
    else:
      repo_data = await github_analyze_repo(body.repo_url)
    async with Session() as session:
      try:
        stats = await run_index_repo(session, body.project_id, repo_data)
        await session.commit()
      except Exception:
        await session.rollback()
        raise
    return stats

  except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))
  except RuntimeError as e:
    if "GEMINI_API_KEY" in str(e):
      raise HTTPException(status_code=503, detail=str(e))
    raise HTTPException(status_code=502, detail=str(e))
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
  project_id: int | None = Field(
    default=None,
    description="If set, use dense vector search over code_chunks for this projects.id.",
  )

@router.post("/ai/classify")
async def classify_tasks_with_ai(body: ClassifyTasksRequest):
  try:
    if body.project_id is not None:
      async with Session() as session:
        classified = await ai_classify_tasks(
          body.decomposition,
          body.repo_data,
          body.analysis,
          session=session,
          project_id=body.project_id,
        )
    else:
      classified = await ai_classify_tasks(
        body.decomposition,
        body.repo_data,
        body.analysis,
        session=None,
        project_id=None,
      )
    return classified
  except json.JSONDecodeError:
    raise HTTPException(status_code=500, detail="AI returned invalid JSON")
  except Exception as e:
    raise HTTPException(status_code=502, detail=str(e))


class WriteTicketsRequest(BaseModel):
  classified: dict
  analysis: dict
  repo_data: dict
  project_id: int | None = Field(
    default=None,
    description="If set, use dense vector search over code_chunks for this projects.id",
  )

@router.post("/ai/tickets")
async def write_tickets(body: WriteTicketsRequest):
  try:
    if body.project_id is not None:
      async with Session() as session:
        tickets = await ai_write_tickets(
          body.classified,
          body.repo_data,
          body.analysis,
          session=session,
          project_id=body.project_id,
        )
    else:
      tickets = await ai_write_tickets(
        body.classified,
        body.repo_data,
        body.analysis,
        session=None,
        project_id=None,
      )
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
