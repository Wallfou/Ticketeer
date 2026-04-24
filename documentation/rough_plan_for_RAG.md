# RAG Implementation Plan

## 1. Code-Aware Chunking (Most Important)

No fixed character-count chunking — that shreds functions. Using AST-aware chunking instead:

- **Python:** `ast` module, split on top-level `def`/`class`
- **TS/JS/TSX/JSX/Go/Rust/Java:** `tree-sitter` with language grammars (one library, all languages)
- **Fallback** for unknown/Markdown/YAML: recursive character splitter with ~40–80 line chunks and 10-line overlap

Each chunk gets metadata: `{path, language, symbol_name, symbol_kind, start_line, end_line, imports}`. This metadata is gold for filtering and for showing the LLM exactly where a snippet lives.

## 2. Hybrid Retrieval (Dense + Sparse)

Pure vector search under-performs on code because identifiers matter (searching for `useAuthStore` semantically is fuzzy; lexically it's exact). So combining both:

**Dense:** embed every chunk with a code-aware embedding model. Options I'm considering:

- `gemini-embedding-001` (Gemini API stable text model; use `output_dimensionality` 768/1536/3072 — we use 768 to match `vector(768)`. Older `text-embedding-004` is shut down per [deprecations](https://ai.google.dev/gemini-api/docs/deprecations).)
- `voyage-code-3` (best code quality if I want a second provider)
- `jina-embeddings-v2-base-code` (self-hostable)

**Sparse/lexical:** BM25 over a tokenizer that splits camelCase/snake_case (so `retrieveRelevantFiles` → `retrieve`, `relevant`, `files`). `rank_bm25` in Python is ~20 lines.

**Fusion:** Merge the two result lists with Reciprocal Rank Fusion (RRF). Score = `1 / (k + rank)` summed per doc — dead simple and beats weighted averages.

## 3. Store in Postgres with pgvector

Already running Postgres with asyncpg + SQLAlchemy + Alembic, so no need to add Pinecone/Chroma — just adding the `pgvector` extension and a `code_chunks` table:

```sql
-- new table
id, project_id (FK), path, language, symbol_name, start_line, end_line,
content, embedding vector(768), tsv tsvector
```

One index for vector (`ivfflat` or `hnsw`), one GIN index on `tsv` for BM25/full-text. Retrieval stays inside the existing DB and ties chunks to the `Project` row in `server/db/models.py`.

## 4. Ingest Once, Reuse Everywhere

Right now `analyze_repo` in `routes/ai.py` pulls the whole repo via `services/github.py`, and then `classify` and `tickets` endpoints each receive `repo_data` again from the client. Restructuring so:

- **`/ai/analyze`** ingests the repo once: pulls files → chunks → embeds → writes to `code_chunks` with `project_id`. Returns a `project_id` (plus the summary).
- **`/ai/classify`**, **`/ai/tickets`**, **`/ai/chat`** just take `project_id` and query the index. No more shipping `repo_data` around.

This alone will make large repos tractable and cut token usage dramatically.

## 5. Two-Stage ("Coarse-to-Fine") Retrieval

For each task:

**Stage 1 — File ranking:** combine (a) top chunk hits grouped by file, (b) explicit `file_hints` from the planner, (c) files in the same directory as top hits. Keep top N=8 files.

**Stage 2 — Chunk packing:** within those files, pick the top chunks by hybrid score, then expand each chunk with ~15 lines of surrounding context and a header noting what else is in the file. Pack until hitting a token budget.

This gives the LLM focused snippets plus neighborhood awareness, instead of either whole files or isolated functions.

## 6. LLM-Based Reranking (Optional, High ROI)

After hybrid retrieval returns ~30 candidates, one cheap Gemini call scores each for relevance to the task and keeps top 8–10. Models like `gemini-flash-lite` are fast and cheap enough that this is worth it for ticket generation quality. Skipping it for the chat endpoint if latency matters.

## 7. Repo-Level Summary (Separate from RAG)

`analyze_repo` wants breadth, not depth — RAG is the wrong tool there. Instead, doing hierarchical summarization during ingestion:

1. Summarize each file (or each module) with one Gemini call
2. Combine module summaries into a repo summary
3. Store both; feed the repo summary (small, ~2–5k tokens) to every downstream call as baseline context, and augment with RAG-retrieved chunks for the task-specific parts

## 8. Lightweight Graph Signals

No need for a full code graph, but two signals are cheap and high-value:

- **Import edges:** parse `import`/`from`/`require` in each file during chunking. If a task retrieves `chatHandler`, also surface files that import it (likely routes) and files it imports (likely services). This catches "the thing that calls the thing."
- **Co-change:** if there's git history access, files changed together historically are often relevant together. Optional, only worth it for larger installations.

## Dependencies

```
pgvector==0.3.6
sqlalchemy-pgvector        # or use pgvector.sqlalchemy
tree-sitter==0.23.*
tree-sitter-languages      # bundles grammars for py/ts/js/go/rs/java/...
rank-bm25==0.2.2
tiktoken                   # for accurate token packing
```

## MVP Build Order

Each step is independently useful — building in this order:

1. Add `pgvector` extension + `code_chunks` table via a new Alembic migration.
2. Write `services/indexing.py`: chunk with tree-sitter, embed with Gemini `gemini-embedding-001` (`output_dimensionality=768`), upsert to `code_chunks` keyed by `project_id`.
3. Replace `retrieve_relevant_files` with `services/retrieval.py`: dense cosine search over `code_chunks` when `project_id` + DB session are provided (`POST /ai/classify` and `/ai/tickets` body field `project_id`); otherwise keyword/path fallback on `repo_data`.
4. Add BM25 and RRF fusion.
5. Add the two-stage file → chunk packing with context expansion.
6. *(Optional)* Add LLM reranker for the ticket-writing path.