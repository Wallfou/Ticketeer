from fastapi import FastAPI
from routes.github import router as github_router

app = FastAPI()

app.include_router(github_router)

@app.get("/health")
def health_check():
  return {"status": "ok"}
