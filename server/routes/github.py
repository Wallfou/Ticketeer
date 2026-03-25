from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from services.github import analyze_repo

router = APIRouter()

class RepoRequest(BaseModel):
  repo_url: str

@router.post("/github/analyze")
async def analyze_github_repo(body: RepoRequest, github_token: str = Header(default=None)):
  try:
    output = await analyze_repo(body.repo_url, token=github_token)
    return output
  except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))
  except Exception as e:
    raise HTTPException(status_code=502, detail=f"GitHub API errors: {str(e)}")
