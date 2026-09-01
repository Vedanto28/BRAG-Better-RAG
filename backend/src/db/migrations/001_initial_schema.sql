-- Phase 1: Relational Schema for BRAG Neon PostgreSQL Persistence

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  provider_preferences JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS investigations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  investigation_id TEXT REFERENCES investigations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  investigation_id TEXT REFERENCES investigations(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS diagnostic_reports (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  investigation_id TEXT REFERENCES investigations(id) ON DELETE CASCADE,
  finding TEXT,
  root_cause TEXT,
  confidence TEXT,
  evidence_refs JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_metadata (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  investigation_id TEXT REFERENCES investigations(id) ON DELETE CASCADE,
  provider TEXT,
  model TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  tool_calls INTEGER DEFAULT 0,
  rag_chunks INTEGER DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investigations_user_id ON investigations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_investigation_id ON messages(investigation_id);
CREATE INDEX IF NOT EXISTS idx_evidence_investigation_id ON evidence(investigation_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_investigation_id ON diagnostic_reports(investigation_id);
CREATE INDEX IF NOT EXISTS idx_usage_metadata_investigation_id ON usage_metadata(investigation_id);
