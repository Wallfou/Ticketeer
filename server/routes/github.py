from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from services.github import analyze_repo
from services.github_issues import export_tickets_to_github_issues

router = APIRouter()

class RepoRequest(BaseModel):
  repo_url: str

class ExportIssuesRequest(BaseModel):
  repo_url: str
  tickets: list[dict]
  team: list[dict] = []

@router.post("/github/analyze")
async def analyze_github_repo(body: RepoRequest, github_token: str = Header(default=None)):
  try:
    output = await analyze_repo(body.repo_url, token=github_token)
    return output
  except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))
  except Exception as e:
    raise HTTPException(status_code=502, detail=f"GitHub API errors: {str(e)}")


@router.post("/github/export-issues")
async def export_issues(body: ExportIssuesRequest, authorization: str = Header(default=None)):
  token = None
  if authorization and authorization.lower().startswith("bearer "):
    token = authorization[7:].strip()
  try:
    return await export_tickets_to_github_issues(body.repo_url, body.tickets, body.team, token=token)
  except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))
  except Exception as e:
    raise HTTPException(status_code=502, detail=f"GitHub API error: {str(e)}")
