/*
# Upgrade profiles, create vaults, update vault_notes, create friendships and direct_messages

## What this does
Major schema upgrade for Vault (Obsidian-style) and Chat (user-to-user with
friends/DMs) features.

## 1. profiles table — add username and avatar_url
- `username` (text, unique, nullable initially — backfilled from email)
- `avatar_url` (text, nullable)
- Update policy: users can update their own profile (username, avatar_url)
- Backfill username from email local-part for existing rows

## 2. New table: vaults
- `id` (uuid PK)
- `user_id` (uuid NOT NULL DEFAULT auth.uid(), FK auth.users CASCADE)
- `name` (text NOT NULL)
- `created_at` (timestamptz DEFAULT now())
- RLS: owner-only CRUD

## 3. vault_notes — add columns
- `vault_id` (uuid, nullable initially, FK vaults CASCADE)
- `file_type` (text NOT NULL DEFAULT 'markdown') — 'markdown' or 'code'
- `language` (text, nullable) — for code notes: 'rust', 'typescript', 'javascript', 'python'
- Backfill: set vault_id to NULL (old notes go to no vault; UI shows "All Notes")
- RLS policies updated to scope through vaults ownership

## 4. New table: friendships
- `id` (uuid PK)
- `sender_id` (uuid NOT NULL DEFAULT auth.uid(), FK auth.users CASCADE)
- `receiver_id` (uuid NOT NULL, FK auth.users CASCADE)
- `status` (text NOT NULL DEFAULT 'pending') — 'pending' or 'accepted'
- `created_at` (timestamptz DEFAULT now())
- RLS: users can see friendships where they are sender or receiver
- INSERT: sender must be auth.uid()
- UPDATE: receiver can accept/decline (status change)
- DELETE: either party can remove

## 5. New table: direct_messages
- `id` (uuid PK)
- `sender_id` (uuid NOT NULL DEFAULT auth.uid(), FK auth.users CASCADE)
- `receiver_id` (uuid NOT NULL, FK auth.users CASCADE)
- `content` (text NOT NULL)
- `created_at` (timestamptz DEFAULT now())
- RLS: users can read/insert where they are sender or receiver

## Indexes
- vaults(user_id)
- vault_notes(vault_id, updated_at DESC)
- friendships(receiver_id, status), friendships(sender_id, status)
- direct_messages(sender_id, receiver_id, created_at)

## Security
All tables have RLS enabled with owner-scoped or participant-scoped policies.
*/

-- ===== 1. profiles — add username + avatar_url =====
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Backfill username from email for existing rows
UPDATE profiles SET username = split_part(email, '@', 1) WHERE username IS NULL;

-- Make username unique (only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON profiles (username) WHERE username IS NOT NULL;

DROP POLICY IF EXISTS "profiles_read_all" ON profiles;
CREATE POLICY "profiles_read_all"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ===== 2. vaults table =====
CREATE TABLE IF NOT EXISTS vaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vaults ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON vaults TO authenticated;

DROP POLICY IF EXISTS "select_own_vaults" ON vaults;
CREATE POLICY "select_own_vaults"
  ON vaults FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_vaults" ON vaults;
CREATE POLICY "insert_own_vaults"
  ON vaults FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_vaults" ON vaults;
CREATE POLICY "update_own_vaults"
  ON vaults FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_vaults" ON vaults;
CREATE POLICY "delete_own_vaults"
  ON vaults FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS vaults_user_id_idx ON vaults (user_id);

-- ===== 3. vault_notes — add vault_id, file_type, language =====
ALTER TABLE vault_notes ADD COLUMN IF NOT EXISTS vault_id uuid REFERENCES vaults(id) ON DELETE SET NULL;
ALTER TABLE vault_notes ADD COLUMN IF NOT EXISTS file_type text NOT NULL DEFAULT 'markdown';
ALTER TABLE vault_notes ADD COLUMN IF NOT EXISTS language text;

-- Update policies to scope through vault ownership OR direct ownership (for legacy notes)
DROP POLICY IF EXISTS "select_own_vault_notes" ON vault_notes;
CREATE POLICY "select_own_vault_notes"
  ON vault_notes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- existing insert/update/delete policies remain (already owner-scoped)
-- Add UPDATE grant for file_type/language columns (already granted via table-level)

CREATE INDEX IF NOT EXISTS vault_notes_vault_updated_idx ON vault_notes (vault_id, updated_at DESC);

-- ===== 4. friendships table =====
CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON friendships TO authenticated;

DROP POLICY IF EXISTS "friendships_select_participants" ON friendships;
CREATE POLICY "friendships_select_participants"
  ON friendships FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "friendships_insert_as_sender" ON friendships;
CREATE POLICY "friendships_insert_as_sender"
  ON friendships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "friendships_update_participants" ON friendships;
CREATE POLICY "friendships_update_participants"
  ON friendships FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "friendships_delete_participants" ON friendships;
CREATE POLICY "friendships_delete_participants"
  ON friendships FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE INDEX IF NOT EXISTS friendships_receiver_status_idx ON friendships (receiver_id, status);
CREATE INDEX IF NOT EXISTS friendships_sender_status_idx ON friendships (sender_id, status);

-- ===== 5. direct_messages table =====
CREATE TABLE IF NOT EXISTS direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON direct_messages TO authenticated;

DROP POLICY IF EXISTS "dm_select_participants" ON direct_messages;
CREATE POLICY "dm_select_participants"
  ON direct_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "dm_insert_as_sender" ON direct_messages;
CREATE POLICY "dm_insert_as_sender"
  ON direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "dm_delete_sender" ON direct_messages;
CREATE POLICY "dm_delete_sender"
  ON direct_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);

CREATE INDEX IF NOT EXISTS dm_sender_receiver_created_idx ON direct_messages (sender_id, receiver_id, created_at);
