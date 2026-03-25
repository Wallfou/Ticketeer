import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

PRIORITY_PATTERNS = {
    "README", "readme", "package.json", "requirements.txt",
    "pyproject.toml", "Dockerfile", "docker-compose",
    "main.py", "index.ts", "index.tsx", "App.tsx", "app.py",
    "models.py", "routes", "schema", "config"
}

MAX_CONTENT_CHARS = 320000

def is_priority_file(path: str) -> bool:
  filename = path.split("/")[-1].lower()
  return any(p.lower() in filename for p in PRIORITY_PATTERNS)

def build_context(repo_data: dict) -> str:
  file_tree = "\n".join(f["path"] for f in repo_data["files"])

  content_sections = []
  total_characters = 0

  priority_files = [f for f in repo_data["files"] if is_priority_file(f["path"])]
  rest_files = [f for f in repo_data["files"] if not is_priority_file(f["path"])]

  for file in priority_files + rest_files:
    content = file.get("content", "")
    if not content.strip():
      continue

    content_chunk = f"### {file['path']}\n```{file['language'].lower()}\n{content}\n```\n"
    if total_characters + len(content_chunk) > MAX_CONTENT_CHARS:
      break

    content_sections.append(content_chunk)
    total_characters += len(content_chunk)

  return f"""
  ## File Tree 
  {file_tree}

  ## File Contents
  {''.join(content_sections)}
  """.strip()

async def analyze_repo(repo_data: dict) -> dict:
  context = build_context(repo_data)
  prompt = f"""
  You are a senior software engineer analyzing a codebase.

  Given the file tree and key file contents below, produce a structured analysis as valid JSON with these exact fields:
  - "summary": 2-3 sentence description of what the app does 
  - "frameworks": list of frameworks and major libraries detected
  - "languages": list of programming languages used
  - "modules": list of objects with "name" and "description" for each major module/area
  - "complexity_map": list of objects with "area", "level" (beginner/intermediate/advanced), and "reason"
  Return ONLY valid JSON, no markdown, no explanation.
  
  {context}
  """
  model = genai.GenerativeModel("gemini-2.5-flash")
  response = await model.generate_content_async(prompt)
  raw = response.text.strip()

  # strip markdown code block if gemini wraps the json
  if raw.startswith("```"):
    raw = raw.split("```")[1]
    if raw.startswith("json"):
      raw = raw[4:]

  return json.loads(raw.strip())

