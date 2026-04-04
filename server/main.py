from fastapi import FastAPI
from routes.github import router as github_router
from routes.ai import router as ai_router
from routes.assign import router as assign_router

app = FastAPI()

app.include_router(github_router)
app.include_router(ai_router)
app.include_router(assign_router)

@app.get("/health")
def health_check():
  return {"status": "ok"}
