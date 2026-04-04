import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.ai import assign_tickets as ai_assign_tickets

router = APIRouter()


class RosterMember(BaseModel):
  id: str
  name: str
  experience: str
  tags: list[str]


class AssignRequest(BaseModel):
  tickets: list[dict]
  roster: list[RosterMember]


@router.post("/assign")
async def assign(body: AssignRequest):
  if not body.roster:
    raise HTTPException(status_code=400, detail="Roster is empty — add team members first.")
  if not body.tickets:
    raise HTTPException(status_code=400, detail="No tickets to assign.")
  try:
    result = await ai_assign_tickets(
      body.tickets,
      [m.model_dump() for m in body.roster],
    )
    return result
  except json.JSONDecodeError:
    raise HTTPException(status_code=500, detail="AI returned invalid JSON")
  except Exception as e:
    raise HTTPException(status_code=502, detail=str(e))
