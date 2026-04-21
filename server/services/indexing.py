"""
Index repository file contents into code_chunks for RAG.

Pipeline: parse each file with tree-sitter, extract definition-sized chunks with line ranges and optional symbol names, 
fall back to fixed-size sliding line windows for unsupported languages or failures, 
embed each chunk with Gemini gemini-embedding-001 at 768 dims 
(might have to migrate later if google deprecates :( https://ai.google.dev/gemini-api/docs/embeddings),
write rows to Postgres,
then populate tsv column with to_tsvector for lexical/GIN search later.
"""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from typing import Any, Iterator

from aiolimiter import AsyncLimiter
from dotenv import load_dotenv
from google import genai
from google.genai import types
from sqlalchemy import delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import CodeChunk

load_dotenv()

_EMBED_CLIENT = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 768
_EMBED_LIMITER = AsyncLimiter(max_rate=50, time_period=60)

MAX_CHUNK_CHARS = 14_000
FALLBACK_LINE_WINDOW = 70
FALLBACK_LINE_OVERLAP = 10
_EMBED_BATCH = 24

# mapping file extensions to tree sitter grammar ids
_EXT_TO_PARSER: dict[str, str] = {
  ".py": "python",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
}

# maps readable language labels to tree sitter same grammar ids
_DISPLAY_TO_PARSER: dict[str, str] = {
  "Python": "python",
  "TypeScript": "typescript",
  "JavaScript": "javascript",
  "Go": "go",
  "Rust": "rust",
  "Java": "java",
  "JSON": "json",
  "YAML": "yaml",
}

# for each grammar id, lists AST node types that should become a chunk
# AST is abstract syntax tree
_AST_NODE_TYPES: dict[str, frozenset[str]] = {
  "python": frozenset({
    "function_definition",
    "class_definition",
    "decorated_definition",
  }),
  "javascript": frozenset({
    "function_declaration",
    "class_declaration",
    "method_definition",
    "generator_function",
  }),
  "typescript": frozenset({
    "function_declaration",
    "class_declaration",
    "method_definition",
    "generator_function",
    "abstract_class_declaration",
    "interface_declaration",
    "type_alias_declaration",
    "enum_declaration",
  }),
  "go": frozenset({
    "function_declaration",
    "method_declaration",
    "type_declaration",
  }),
  "rust": frozenset({
    "function_item",
    "impl_item",
    "struct_item",
    "enum_item",
    "trait_item",
    "mod_item",
    "macro_definition",
  }),
  "java": frozenset({
    "class_declaration",
    "interface_declaration",
    "enum_declaration",
    "record_declaration",
    "method_declaration",
    "constructor_declaration",
  }),
}


@dataclass
class _ChunkDraft:
  path: str
  language: str
  symbol_name: str | None
  start_line: int | None
  end_line: int | None
  content: str

# deciding which tree sitter grammar to use, if not in the MAP, use file extension
def _parser_name_for_file(path: str, display_language: str) -> str | None:
  if display_language in _DISPLAY_TO_PARSER:
    return _DISPLAY_TO_PARSER[display_language]
  name = path.rsplit("/", 1)[-1]
  ext = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
  return _EXT_TO_PARSER.get(ext)


# just loading the tree sitter Parser
def _get_parser(parser_name: str):
  try:
    from tree_sitter_languages import get_parser
  except ImportError:
    return None
  try:
    return get_parser(parser_name)
  except Exception:
    return None

# decode AST name for readable  
def _node_name(node, source: bytes) -> str | None:
  try:
    n = node.child_by_field_name("name")
  except Exception:
    n = None
  if n and n.text:
    text = n.text.decode("utf-8", errors="replace").strip()
    return text[:512] if text else None
  return None

# gets symbol stirng for chunk from AST
def _symbol_for_node(node, source: bytes) -> str | None:
  if node.type == "decorated_definition":
    for child in node.named_children:
      if child.type in ("function_definition", "class_definition"):
        return _node_name(child, source)
    return None
  return _node_name(node, source)


# decides if the node should becomes its own chunk 
def _should_emit_node(node, interesting: frozenset[str]) -> bool:
  if node.type not in interesting:
    return False
  parent = node.parent
  if node.type == "function_definition" and parent and parent.type == "decorated_definition":
    return False
  if node.type == "class_definition" and parent and parent.type == "decorated_definition":
    return False
  return True


# parses the full file, walks the AST and emits chunks for interesting nodes, with byte range, line range, and symbol
# interesting nodes are defined in _AST_NODE_TYPES
def _iter_ast_chunks(
  parser_name: str,
  path: str,
  display_language: str,
  content: str,
) -> list[_ChunkDraft]:
  parser = _get_parser(parser_name)
  if not parser:
    return []
  interesting = _AST_NODE_TYPES.get(parser_name)
  if not interesting:
    return []

  source_bytes = content.encode("utf-8")
  tree = parser.parse(source_bytes)
  root = tree.root_node
  out: list[_ChunkDraft] = []

  stack: list[Any] = [root]
  while stack:
    node = stack.pop()
    if _should_emit_node(node, interesting):
      start_b, end_b = node.start_byte, node.end_byte
      text = source_bytes[start_b:end_b].decode("utf-8", errors="replace")
      if not text.strip():
        continue
      snippet = source_bytes[start_b:end_b]
      sl = source_bytes[:start_b].count(b"\n") + 1
      el = sl + snippet.count(b"\n")
      sym = _symbol_for_node(node, source_bytes)
      out.append(
        _ChunkDraft(
          path=path,
          language=display_language,
          symbol_name=sym,
          start_line=sl,
          end_line=el,
          content=text.rstrip(),
        )
      )
    for child in reversed(node.children):
      stack.append(child)

  return out

# if the file isn't parsable, use fixed size sliding line windows, with overlap so context isn't lost between windows
def _iter_line_fallback_chunks(
  path: str,
  display_language: str,
  content: str,
) -> Iterator[_ChunkDraft]:
  lines = content.splitlines(keepends=True)
  if not lines:
    return
  n = len(lines)
  start = 0
  while start < n:
    end = min(start + FALLBACK_LINE_WINDOW, n)
    piece = "".join(lines[start:end]).rstrip()
    if piece.strip():
      yield _ChunkDraft(
        path=path,
        language=display_language,
        symbol_name=None,
        start_line=start + 1,
        end_line=end,
        content=piece,
      )
    if end >= n:
      break
    start = max(end - FALLBACK_LINE_OVERLAP, start + 1)


# if a draft content is too large, split it using the same fixed size sliding window approach as above function
def _split_oversized(draft: _ChunkDraft) -> list[_ChunkDraft]:
  if len(draft.content) <= MAX_CHUNK_CHARS:
    return [draft]
  base = (draft.start_line or 1) - 1
  lines = draft.content.splitlines(keepends=True)
  if not lines:
    return [draft]
  out: list[_ChunkDraft] = []
  part = 1
  pos = 0
  while pos < len(lines):
    end = min(pos + FALLBACK_LINE_WINDOW, len(lines))
    piece = "".join(lines[pos:end]).rstrip()
    if piece.strip():
      sym = draft.symbol_name
      if sym:
        sym = f"{sym} [part {part}]"
      elif draft.path:
        sym = f"{draft.path} [part {part}]"
      out.append(
        _ChunkDraft(
          path=draft.path,
          language=draft.language,
          symbol_name=sym[:512] if sym else None,
          start_line=base + pos + 1,
          end_line=base + end,
          content=piece,
        )
      )
      part += 1
    if end >= len(lines):
      break
    pos = max(end - FALLBACK_LINE_OVERLAP, pos + 1)
  return out if out else [draft]


# gets chunks for a file, uses tree sitter if available, otherwise use fixed size sliding line windows
def _chunks_for_file(file_entry: dict[str, Any]) -> list[_ChunkDraft]:
  path = file_entry.get("path") or ""
  display_lang = (file_entry.get("language") or "Unknown").strip() or "Unknown"
  content = file_entry.get("content") or ""
  if not path or not content.strip():
    return []

  parser_name = _parser_name_for_file(path, display_lang)
  drafts: list[_ChunkDraft] = []

  if parser_name:
    ast_list = _iter_ast_chunks(parser_name, path, display_lang, content)
    if ast_list:
      for d in ast_list:
        drafts.extend(_split_oversized(d))
    else:
      for d in _iter_line_fallback_chunks(path, display_lang, content):
        drafts.extend(_split_oversized(d))
  else:
    for d in _iter_line_fallback_chunks(path, display_lang, content):
      drafts.extend(_split_oversized(d))

  # de-dupe identical path+content (rare)
  seen: set[tuple[str, str]] = set()
  unique: list[_ChunkDraft] = []
  for d in drafts:
    key = (d.path, d.content)
    if key in seen:
      continue
    seen.add(key)
    unique.append(d)
  return unique


# prepares the input for embedding API
# header plus up to 12000 chars of body
def _embedding_input(path: str, symbol_name: str | None, content: str) -> str:
  header = f"File: {path}\n"
  if symbol_name:
    header += f"Symbol: {symbol_name}\n"
  body = content[:12_000]
  return header + body

# calls the embedding API under _EMBED_LIMITER
async def _embed_batch(texts: list[str]) -> list[list[float]]:
  if not texts:
    return []
  async with _EMBED_LIMITER:
    resp = await _EMBED_CLIENT.aio.models.embed_content(
      model=EMBEDDING_MODEL,
      contents=texts,
      config=types.EmbedContentConfig(
        task_type="RETRIEVAL_DOCUMENT",
        output_dimensionality=EMBEDDING_DIM,
      ),
    )
  if not resp.embeddings:
    raise RuntimeError("Embedding API returned no vectors")
  vectors: list[list[float]] = []
  for emb in resp.embeddings:
    vals = list(emb.values or [])
    if len(vals) != EMBEDDING_DIM:
      raise RuntimeError(
        f"Expected {EMBEDDING_DIM}-dim embeddings from {EMBEDDING_MODEL}, got {len(vals)}"
      )
    vectors.append(vals)
  if len(vectors) != len(texts):
    raise RuntimeError("Embedding count mismatch")
  return vectors


# main function to index the repo
# validates repo data, clear existing chunks, iterate over the files to get chunks, embed chunks in batches,
# and build CodeChunk rows in Postgres
# builds tsv column with to_tsvector for lexical search
# does not commit the session; callers should commit on success
async def index_repo(
  session: AsyncSession,
  project_id: int,
  repo_data: dict[str, Any],
  *,
  clear_existing: bool = True,
) -> dict[str, int]:
  """
  Chunk ``repo_data`` (same shape as ``services.github.analyze_repo`` output),
  embed chunks, and persist to ``code_chunks`` for ``project_id``.

  Does not commit the session; callers should ``await session.commit()`` on success.
  """
  if not os.getenv("GEMINI_API_KEY"):
    raise RuntimeError("GEMINI_API_KEY is not set")

  files = repo_data.get("files") or []
  if not isinstance(files, list):
    raise ValueError("repo_data.files must be a list")

  if clear_existing:
    await session.execute(delete(CodeChunk).where(CodeChunk.project_id == project_id))

  all_drafts: list[_ChunkDraft] = []
  files_with_chunks = 0
  for f in files:
    if not isinstance(f, dict):
      continue
    got = _chunks_for_file(f)
    if got:
      files_with_chunks += 1
      all_drafts.extend(got)

  if not all_drafts:
    await session.flush()
    return {"chunk_count": 0, "files_indexed": 0, "embedded_count": 0}

  embeddings: list[list[float]] = []
  for i in range(0, len(all_drafts), _EMBED_BATCH):
    batch = all_drafts[i : i + _EMBED_BATCH]
    texts = [_embedding_input(d.path, d.symbol_name, d.content) for d in batch]
    vecs = await _embed_batch(texts)
    embeddings.extend(vecs)
    await asyncio.sleep(0)

  rows: list[CodeChunk] = []
  for draft, vec in zip(all_drafts, embeddings, strict=True):
    rows.append(
      CodeChunk(
        project_id=project_id,
        path=draft.path,
        language=draft.language[:64],
        symbol_name=(draft.symbol_name[:512] if draft.symbol_name else None),
        start_line=draft.start_line,
        end_line=draft.end_line,
        content=draft.content,
        embedding=vec,
        tsv=None,
      )
    )

  for j in range(0, len(rows), 200):
    session.add_all(rows[j : j + 200])
    await session.flush()

  await session.execute(
    text(
      "UPDATE code_chunks SET tsv = to_tsvector('english', content) "
      "WHERE project_id = :pid AND tsv IS NULL"
    ),
    {"pid": project_id},
  )
  await session.flush()

  return {
    "chunk_count": len(rows),
    "files_indexed": files_with_chunks,
    "embedded_count": len(rows),
  }
