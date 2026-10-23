/*
# Create servers, channels, and channel_messages tables

## What this does
Adds Discord-style shared chat: users can create servers, each server has
channels, and each channel has messages from any authenticated user.

## New Tables

### servers
- `id` (uuid, primary key, default gen_random_uuid())
- `name` (text, not null)
- `owner_id` (uuid, not null, default auth.uid(), references auth.users ON DELETE CASCADE)
- `created_at` (timestamptz, default now())

### channels
- `id` (uuid, primary key, default gen_random_uuid())
- `server_id` (uuid, not null, references servers ON DELETE CASCADE)
- `name` (text, not null)
- `created_at` (timestamptz, default now())

### channel_messages
- `id` (uuid, primary key, default gen_random_uuid())
- `channel_id` (uuid, not null, references channels ON DELETE CASCADE)
- `sender_id` (uuid, not null, default auth.uid(), references auth.users ON DELETE CASCADE)
- `content` (text, not null)
- `created_at` (timestamptz, default now())

## Indexes
- `channels_server_idx` on (server_id)
- `channel_messages_channel_created_idx` on (channel_id, created_at)

## Security (RLS)

### servers
- SELECT: any authenticated user can see all servers (shared space)
- INSERT: authenticated users can create servers (owner = themselves)
- UPDATE: only the server owner
- DELETE: only the server owner

### channels
- SELECT: any authenticated user can see channels (shared space)
- INSERT: any authenticated user can create a channel in any server
- UPDATE: only server owner
- DELETE: only server owner

### channel_messages
- SELECT: any authenticated user can read messages in any channel
- INSERT: authenticated users can post as themselves (sender_id = auth.uid())
- DELETE: only the message sender
- No UPDATE (messages are immutable)

## Important Notes
1. This is a shared-space model (like Discord), not private DMs.
2. sender_id defaults to auth.uid() so frontend inserts omitting it succeed.
3. Messages cascade-delete with their channel, channels with their server.
*/

CREATE TABLE IF NOT EXISTS servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE servers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "servers_select_all" ON servers;
CREATE POLICY "servers_select_all"
  ON servers FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "servers_insert_own" ON servers;
CREATE POLICY "servers_insert_own"
  ON servers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "servers_update_owner" ON servers;
CREATE POLICY "servers_update_owner"
  ON servers FOR UPDATE
  TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "servers_delete_owner" ON servers;
CREATE POLICY "servers_delete_owner"
  ON servers FOR DELETE
  TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "channels_select_all" ON channels;
CREATE POLICY "channels_select_all"
  ON channels FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "channels_insert_any" ON channels;
CREATE POLICY "channels_insert_any"
  ON channels FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "channels_update_owner" ON channels;
CREATE POLICY "channels_update_owner"
  ON channels FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM servers s WHERE s.id = channels.server_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM servers s WHERE s.id = channels.server_id AND s.owner_id = auth.uid()));

DROP POLICY IF EXISTS "channels_delete_owner" ON channels;
CREATE POLICY "channels_delete_owner"
  ON channels FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM servers s WHERE s.id = channels.server_id AND s.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS channel_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "channel_messages_select_all" ON channel_messages;
CREATE POLICY "channel_messages_select_all"
  ON channel_messages FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "channel_messages_insert_as_sender" ON channel_messages;
CREATE POLICY "channel_messages_insert_as_sender"
  ON channel_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "channel_messages_delete_sender" ON channel_messages;
CREATE POLICY "channel_messages_delete_sender"
  ON channel_messages FOR DELETE
  TO authenticated USING (auth.uid() = sender_id);

CREATE INDEX IF NOT EXISTS channels_server_idx ON channels (server_id);
CREATE INDEX IF NOT EXISTS channel_messages_channel_created_idx ON channel_messages (channel_id, created_at);
