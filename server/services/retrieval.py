"""
Dense vector retrieval over code chunks.

When project_id and a session are provided, embeds the generated task as a
"RETRIEVAL_QUERY" with the same dimension as indexing, orders chunks by
cosine distance, and packs the top matches into markdown for LLM context.

if id or other stuff not present, falls back to old keyword matching approach with repo_data.
"""
from __future__ import annotations

import os
from typing import Any

from aiolimiter import AsyncLimiter
from dotenv import load_dotenv
from google import genai
from google.genai import types
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import CodeChunk
from services.indexing import EMBEDDING_DIM, EMBEDDING_MODEL

load_dotenv()

_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
_limiter = AsyncLimiter(max_rate=50, time_period=60)


_DENSE_CANDIDATE_LIMIT = 100

# builds a single string used as the dense retrieval query
# the string is a combination of the task properties
def _task_query_text(task: dict) -> str:
  title = (task.get("title") or "").strip()
  desc = (task.get("description") or "").strip()
  hints = task.get("file_hints") or []
  lines = [title, desc]
  if hints:
    lines.append("Hints: " + ", ".join(str(h) for h in hints if h))
  return "\n".join(x for x in lines if x).strip() or title or "task"

# embeds the query text into vector with same dimension as indexing
# under same rate limit
async def _embed_query_vector(text: str) -> list[float]:
  if not os.getenv("GEMINI_API_KEY"):
    raise RuntimeError("GEMINI_API_KEY is not set")
  async with _limiter:
    resp = await _client.aio.models.embed_content(
      model=EMBEDDING_MODEL,
      contents=[text],
      config=types.EmbedContentConfig(
        task_type="RETRIEVAL_QUERY",
        output_dimensionality=EMBEDDING_DIM,
      ),
    )
  if not resp.embeddings or not resp.embeddings[0].values:
    raise RuntimeError("Embedding API returned no query vector")
  vec = list(resp.embeddings[0].values)
  if len(vec) != EMBEDDING_DIM:
    raise RuntimeError(f"Expected {EMBEDDING_DIM}-dim query embedding, got {len(vec)}")
  return vec


# Turns one CodeChunk row into a markdown block for LLM context
def _chunk_markdown(row: CodeChunk) -> str:
  loc = ""
  if row.start_line is not None and row.end_line is not None:
    loc = f" (lines {row.start_line}-{row.end_line}"
    if row.symbol_name:
      loc += f", {row.symbol_name}"
    loc += ")"
  elif row.symbol_name:
    loc = f" ({row.symbol_name})"
  lang = (row.language or "text").lower()
  return f"### {row.path}{loc}\n```{lang}\n{row.content}\n```\n"

# Fallback appraoch to keyword matching, if dense retrieval fails
def retrieve_keyword_files(task: dict, repo_data: dict, max_chars: int = 12000) -> str:
  """Path / token overlap over ``repo_data['files']`` (previous ``retrieve_relevant_files``)."""
  hints = set(h.lower() for h in task.get("file_hints", []))
  keywords = (
    set(task["title"].lower().split())
    | set(task["description"].lower().split())
    | hints
  )
  scored = []
  for file in repo_data.get("files") or []:
    path_lower = file["path"].lower()
    score = sum(10 if hint in path_lower else 0 for hint in hints)
    score += sum(1 for kw in keywords if kw in path_lower)
    if score > 0:
      scored.append((score, file))
  scored.sort(key=lambda x: x[0], reverse=True)
  sections = []
  total = 0
  for _, file in scored:
    content = file.get("content", "")
    if not content.strip():
      continue
    chunk = f"### {file['path']}\n```{file['language'].lower()}\n{content}\n```\n"
    if total + len(chunk) > max_chars:
      break
    sections.append(chunk)
    total += len(chunk)
  return "\n".join(sections) if sections else "No directly relevant files found."

# Flow
# - builds query text and embeds via _embed_query_vector
# - SELECT from CodeChunk where project_id matches and embedding is not NULL, ordered by cosine distance to query vector
# - Iterates in simliarity order, formats each with _chunk_markdown until max_chars is reached
# - Returns one markdown string
async def _dense_pack_context(
  session: AsyncSession,
  project_id: int,
  task: dict,
  max_chars: int,
) -> str | None:
  qtext = _task_query_text(task)
  qvec = await _embed_query_vector(qtext)

  stmt = (
    select(CodeChunk)
    .where(CodeChunk.project_id == project_id)
    .where(CodeChunk.embedding.is_not(None))
    .order_by(CodeChunk.embedding.cosine_distance(qvec))
    .limit(_DENSE_CANDIDATE_LIMIT)
  )
  rows = list((await session.scalars(stmt)).all())
  if not rows:
    return None

  sections: list[str] = []
  total = 0
  for row in rows:
    block = _chunk_markdown(row)
    if total + len(block) > max_chars:
      break
    sections.append(block)
    total += len(block)
  return "\n".join(sections) if sections else None

# Main function to retrieve relevant context for a single task
async def retrieve_relevant_context(
  session: AsyncSession | None,
  project_id: int | None,
  task: dict,
  repo_data: dict,
  *,
  max_chars: int = 12000,
) -> str:
  """
  Prefer dense retrieval when ``session`` and ``project_id`` are set and chunks exist;
  otherwise use keyword retrieval over ``repo_data``.
  """
  if session is not None and project_id is not None:
    try:
      dense = await _dense_pack_context(session, project_id, task, max_chars)
      if dense:
        return dense
    except Exception:
      # Missing index, API errors, or driver issues
      pass
  return retrieve_keyword_files(task, repo_data, max_chars=max_chars)
