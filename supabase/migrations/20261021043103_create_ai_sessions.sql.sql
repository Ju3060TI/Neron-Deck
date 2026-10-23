/*
# Create ai_sessions and ai_session_messages tables

## What this does
Adds persistent AI chat sessions for the Agents tab. Each user can have
multiple sessions (conversations), each with a sequence of messages.

## New Tables

### ai_sessions
- `id` (uuid, primary key, default gen_random_uuid())
- `user_id` (uuid, not null, default auth.uid(), references auth.users ON DELETE CASCADE)
- `title` (text, not null, default 'New Chat')
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### ai_session_messages
- `id` (uuid, primary key, default gen_random_uuid())
- `session_id` (uuid, not null, references ai_sessions ON DELETE CASCADE)
- `role` (text, not null) — 'user' | 'assistant' | 'system'
- `content` (text, not null)
- `created_at` (timestamptz, default now())

## Indexes
- `ai_sessions_user_created_idx` on (user_id, created_at DESC)
- `ai_session_messages_session_created_idx` on (session_id, created_at)

## Security (RLS)
- ai_sessions: owner-only CRUD (auth.uid() = user_id)
- ai_session_messages: SELECT/INSERT for messages whose session belongs to
  the authenticated user (via subquery on ai_sessions). DELETE/UPDATE
  cascades from session ownership.

## Important Notes
1. owner_id columns default to auth.uid() so frontend inserts without
   user_id succeed.
2. Messages cascade-delete with their session.
*/

CREATE TABLE IF NOT EXISTS ai_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Chat',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ai_sessions" ON ai_sessions;
CREATE POLICY "select_own_ai_sessions"
  ON ai_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_ai_sessions" ON ai_sessions;
CREATE POLICY "insert_own_ai_sessions"
  ON ai_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_ai_sessions" ON ai_sessions;
CREATE POLICY "update_own_ai_sessions"
  ON ai_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_ai_sessions" ON ai_sessions;
CREATE POLICY "delete_own_ai_sessions"
  ON ai_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS ai_session_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_session_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ai_session_messages" ON ai_session_messages;
CREATE POLICY "select_own_ai_session_messages"
  ON ai_session_messages FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM ai_sessions s WHERE s.id = ai_session_messages.session_id AND s.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_own_ai_session_messages" ON ai_session_messages;
CREATE POLICY "insert_own_ai_session_messages"
  ON ai_session_messages FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM ai_sessions s WHERE s.id = ai_session_messages.session_id AND s.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_own_ai_session_messages" ON ai_session_messages;
CREATE POLICY "delete_own_ai_session_messages"
  ON ai_session_messages FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM ai_sessions s WHERE s.id = ai_session_messages.session_id AND s.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS ai_sessions_user_created_idx
  ON ai_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_session_messages_session_created_idx
  ON ai_session_messages (session_id, created_at);

-- auto-update updated_at on session change
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_sessions_touch_updated_at ON ai_sessions;
CREATE TRIGGER ai_sessions_touch_updated_at
  BEFORE UPDATE ON ai_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();
