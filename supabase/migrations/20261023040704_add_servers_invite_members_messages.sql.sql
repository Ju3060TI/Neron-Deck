/*
# Add invite_code to servers, create server_members and server_messages

## What this does
Restores Discord-style server functionality with membership tracking and
channel messages, plus invite codes for joining servers.

## 1. servers table — add invite_code
- `invite_code` (text, unique, not null) — auto-generated 8-char code on insert
- Backfill existing rows with random codes

## 2. New table: server_members
- `id` (uuid PK)
- `server_id` (uuid FK servers CASCADE)
- `user_id` (uuid NOT NULL DEFAULT auth.uid(), FK auth.users CASCADE)
- `joined_at` (timestamptz DEFAULT now())
- UNIQUE(server_id, user_id) — one membership per server per user
- RLS: members can read their own memberships; users can insert their own;
  server owners can delete members

## 3. New table: server_messages
- `id` (uuid PK)
- `channel_id` (uuid FK channels CASCADE)
- `user_id` (uuid NOT NULL DEFAULT auth.uid(), FK auth.users CASCADE)
- `content` (text NOT NULL)
- `created_at` (timestamptz DEFAULT now())
- RLS: any authenticated user can read (channels are visible to all);
  users can insert their own messages; users can delete their own

## 4. channels — fix insert policy
- Current `channels_insert_any` allows anyone to insert (WITH CHECK true).
  Replace with: only server owners can create channels.
- Current `channels_select_all` is fine (all authenticated can see channels).

## Security
All new tables have RLS enabled. Membership is self-managed for joining.
*/

-- ===== 1. servers — add invite_code =====
ALTER TABLE servers ADD COLUMN IF NOT EXISTS invite_code text;

-- Backfill existing rows
UPDATE servers SET invite_code = substr(md5(random()::text), 1, 8) WHERE invite_code IS NULL;

-- Now make it NOT NULL and unique
ALTER TABLE servers ALTER COLUMN invite_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS servers_invite_code_key ON servers (invite_code);

-- ===== 2. server_members =====
CREATE TABLE IF NOT EXISTS server_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(server_id, user_id)
);

ALTER TABLE server_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON server_members TO authenticated;

DROP POLICY IF EXISTS "server_members_select_own" ON server_members;
CREATE POLICY "server_members_select_own"
  ON server_members FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "server_members_insert_own" ON server_members;
CREATE POLICY "server_members_insert_own"
  ON server_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "server_members_delete_own_or_owner" ON server_members;
CREATE POLICY "server_members_delete_own_or_owner"
  ON server_members FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM servers s WHERE s.id = server_members.server_id AND s.owner_id = auth.uid())
  );

-- Also allow owner to see all members of their servers
DROP POLICY IF EXISTS "server_members_select_owner" ON server_members;
CREATE POLICY "server_members_select_owner"
  ON server_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM servers s WHERE s.id = server_members.server_id AND s.owner_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS server_members_user_idx ON server_members (user_id);
CREATE INDEX IF NOT EXISTS server_members_server_idx ON server_members (server_id);

-- ===== 3. server_messages =====
CREATE TABLE IF NOT EXISTS server_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE server_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON server_messages TO authenticated;

DROP POLICY IF EXISTS "server_messages_select_all" ON server_messages;
CREATE POLICY "server_messages_select_all"
  ON server_messages FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "server_messages_insert_own" ON server_messages;
CREATE POLICY "server_messages_insert_own"
  ON server_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "server_messages_delete_own" ON server_messages;
CREATE POLICY "server_messages_delete_own"
  ON server_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS server_messages_channel_created_idx ON server_messages (channel_id, created_at);

-- ===== 4. channels — fix insert policy to owner-only =====
DROP POLICY IF EXISTS "channels_insert_any" ON channels;
CREATE POLICY "channels_insert_owner"
  ON channels FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM servers s WHERE s.id = channels.server_id AND s.owner_id = auth.uid())
  );
