/*
# Create vault_notes table (multi-user, owner-scoped)

1. New Tables
- `vault_notes` — encrypted-at-rest personal notes, one row per note.
  - `id` (uuid, primary key, defaults to a random uuid)
  - `user_id` (uuid, not null, references auth.users, defaults to the authenticated user, cascades on account deletion)
  - `title` (text, not null, defaults to 'Untitled note')
  - `content` (text, not null, defaults to '' — markdown body)
  - `created_at` (timestamptz, defaults to now)
  - `updated_at` (timestamptz, defaults to now, auto-updated by trigger on every edit)

2. Security
- Enable Row Level Security on `vault_notes`.
- Four separate owner-scoped policies for SELECT, INSERT, UPDATE, DELETE, each scoped
  `TO authenticated` with `auth.uid() = user_id`, so a user can only ever access their own notes.
- Trigger `set_updated_at` keeps `updated_at` fresh on updates.

3. Important Notes
- `user_id` defaults to `auth.uid()` so client inserts that omit the owner still pass the INSERT policy.
- An index on `user_id, updated_at` keeps the notes list query fast.
*/

CREATE TABLE IF NOT EXISTS vault_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled note',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_notes_user_updated ON vault_notes (user_id, updated_at DESC);

ALTER TABLE vault_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_vault_notes" ON vault_notes;
CREATE POLICY "select_own_vault_notes" ON vault_notes
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_vault_notes" ON vault_notes;
CREATE POLICY "insert_own_vault_notes" ON vault_notes
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_vault_notes" ON vault_notes;
CREATE POLICY "update_own_vault_notes" ON vault_notes
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_vault_notes" ON vault_notes;
CREATE POLICY "delete_own_vault_notes" ON vault_notes
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vault_notes_updated_at ON vault_notes;
CREATE TRIGGER trg_vault_notes_updated_at
BEFORE UPDATE ON vault_notes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();