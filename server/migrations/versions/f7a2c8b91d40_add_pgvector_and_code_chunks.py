"""add pgvector extension and code_chunks table

Revision ID: f7a2c8b91d40
Revises: 8fb265f18564
Create Date: 2026-04-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7a2c8b91d40"
down_revision: Union[str, Sequence[str], None] = "8fb265f18564"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Enable pgvector and create code_chunks (768-dim embeddings, e.g. text-embedding-004)."""
    op.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector"))
    op.execute(
        sa.text(
            """
            CREATE TABLE code_chunks (
                id BIGSERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                path TEXT NOT NULL,
                language VARCHAR(64) NOT NULL,
                symbol_name VARCHAR(512),
                start_line INTEGER,
                end_line INTEGER,
                content TEXT NOT NULL,
                embedding vector(768),
                tsv tsvector
            )
            """
        )
    )
    op.execute(
        sa.text("CREATE INDEX ix_code_chunks_project_id ON code_chunks (project_id)")
    )
    op.execute(
        sa.text(
            "CREATE INDEX ix_code_chunks_embedding_hnsw ON code_chunks "
            "USING hnsw (embedding vector_cosine_ops)"
        )
    )
    op.execute(
        sa.text(
            "CREATE INDEX ix_code_chunks_tsv_gin ON code_chunks USING gin (tsv)"
        )
    )


def downgrade() -> None:
    """Drop code_chunks; leave vector extension installed (may be shared)."""
    op.execute(sa.text("DROP TABLE IF EXISTS code_chunks"))
