import os
from dotenv import load_dotenv

import httpx
import base64
from typing import Optional

load_dotenv()
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')

BASE_URL = "https://api.github.com"

IGNORED_DIRS = {
    "node_modules", ".git", ".venv", "venv", "dist", "build",
    "__pycache__", ".next", "coverage", ".cache", "vendor"
}
IGNORED_FILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "poetry.lock", "Pipfile.lock", ".DS_Store"
}
BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".pdf", ".zip", ".tar", ".gz", ".exe", ".bin"
}
LANGUAGE_MAP = {
    ".py": "Python", ".ts": "TypeScript", ".tsx": "TypeScript",
    ".js": "JavaScript", ".jsx": "JavaScript", ".html": "HTML",
    ".css": "CSS", ".json": "JSON", ".md": "Markdown",
    ".yml": "YAML", ".yaml": "YAML", ".sh": "Shell",
    ".go": "Go", ".rs": "Rust", ".java": "Java",
}

# parsing GitHub url and returning repo name and owner
def parse_github_url(url: str) -> tuple[str, str]:
  parts = url.rstrip("/").split("/")
  if "github.com" in parts:
    index = parts.index("github.com")
    return parts[index + 1], parts[index + 2].removesuffix(".git")
  if len(parts) == 2:
    return parts[0], parts[1]
  raise ValueError(f"Invalid Github URL: {url}")

async def get_tree(owner: str, repo: str, token: Optional[str]) -> list[dict]:
  headers = {"Accept": "application/vnd.github+json"}
  if token:
    headers["Authorization"] = f"Bearer {token}"
  async with httpx.AsyncClient() as client:
    # this gets the default branch
    repo_response = await client.get(f"{BASE_URL}/repos/{owner}/{repo}", headers = headers)
    repo_response.raise_for_status()
    default_branch = repo_response.json()["default_branch"]

    # this gets full recursive tree of the default branch
    tree_response = await client.get(f"{BASE_URL}/repos/{owner}/{repo}/git/trees/{default_branch}",
    headers = headers, params = {"recursive": "1"})
    tree_response.raise_for_status()
    return tree_response.json().get("tree", [])

async def get_file_content(owner: str, repo: str, path: str, token: Optional[str]) -> str:
  headers = {"Accept": "application/vnd.github+json"}
  if token:
    headers["Authorization"] = f"Bearer {token}"
  async with httpx.AsyncClient() as client:
    file_response = await client.get(f"{BASE_URL}/repos/{owner}/{repo}/contents/{path}",
    headers = headers)
    file_response.raise_for_status()
    data = file_response.json()
    if data.get("encoding") == "base64":
      return base64.b64decode(data["content"]).decode("utf-8")
    return data.get("content", "")

def filter_file(path: str) -> bool:
  parts = path.split("/")
  if any(part in IGNORED_DIRS for part in parts):
    return False
  filename = parts[-1]
  if filename in IGNORED_FILES:
    return False
  extension = get_extension(filename)
  if extension in BINARY_EXTENSIONS:
    return False
  return True


def get_extension(filename: str) -> str:
  return "." + filename.rsplit(".", 1)[-1] if "." in filename else ""

async def analyze_repo(repo_url: str, token: Optional[str] = None) -> dict:
  token = GITHUB_TOKEN
  owner, repo = parse_github_url(repo_url)
  tree = await get_tree(owner, repo, token)
  files = [
    node for node in tree if node["type"] == "blob" and filter_file(node["path"])
  ]

  output = []
  for file in files:
    path = file["path"]
    extension = get_extension(path.split("/")[-1])
    language = LANGUAGE_MAP.get(extension, "Unknown")
    content = await get_file_content(owner, repo, path, token)
    output.append({
      "path": path,
      "language": language,
      "content": content
    })

  language_output = list({f["language"] for f in output} - {"Unknown"})

  return {
    "repo": f"{owner}/{repo}",
    "file_count": len(files),
    "languages": sorted(language_output),
    "files": output,
  }


