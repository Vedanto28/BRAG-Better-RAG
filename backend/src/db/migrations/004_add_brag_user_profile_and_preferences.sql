-- Phase 2: BRAG User Profile and Application Preferences Schema

CREATE TABLE IF NOT EXISTS user_profile (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  headline TEXT DEFAULT 'Engineering Team Member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
  default_provider TEXT NOT NULL DEFAULT 'gemini',
  theme TEXT NOT NULL DEFAULT 'dark',
  telemetry_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  auto_scroll_console BOOLEAN NOT NULL DEFAULT TRUE,
  max_diagnostic_length TEXT NOT NULL DEFAULT 'balanced',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profile_userId ON user_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_userId ON user_preferences(user_id);
