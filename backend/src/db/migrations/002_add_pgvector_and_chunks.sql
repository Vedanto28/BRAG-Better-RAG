-- Phase 3: Enable pgvector and create knowledge_chunks table for hybrid RAG

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chunk_text TEXT NOT NULL,
  embedding vector(768) NOT NULL,
  category TEXT NOT NULL,
  source TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_category ON knowledge_chunks(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
