import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.github import analyze_repo as github_analyze_repo
from services.ai import analyze_repo as ai_analyze_repo

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
