/*
# Create profiles and user_messages tables for user-to-user chat

## What this does
Adds support for direct user-to-user messaging. A `profiles` table mirrors
basic user info (id + email) from auth.users so the app can list registered
users to start a conversation with. A `user_messages` table stores the actual
1:1 messages between users. A trigger auto-creates a profile row whenever a
new user signs up.

## New Tables

### profiles
- `id` (uuid, primary key) — matches the user's id in auth.users
- `email` (text, not null) — the user's email, copied from auth.users
- `created_at` (timestamptz, default now())

### user_messages
- `id` (uuid, primary key, default gen_random_uuid())
- `sender_id` (uuid, not null, references auth.users ON DELETE CASCADE)
- `receiver_id` (uuid, not null, references auth.users ON DELETE CASCADE)
- `content` (text, not null)
- `created_at` (timestamptz, default now())

## Indexes
- `user_messages_sender_receiver_idx` on (sender_id, receiver_id) for fast
  conversation lookups.
- `user_messages_receiver_created_idx` on (receiver_id, created_at) for
  inbox-style queries.

## Security (RLS)

### profiles
- SELECT: any authenticated user can read all profiles (needed to list users
  to chat with). No INSERT/UPDATE/DELETE via the API — profiles are created
  solely by the database trigger.

### user_messages
- SELECT: authenticated users can read messages where they are the sender OR
  the receiver.
- INSERT: authenticated users can insert only messages where they are the
  sender (sender_id = auth.uid()). receiver_id can be any user.
- UPDATE: disabled (messages are immutable once sent).
- DELETE: authenticated users can delete messages they sent.

## Trigger
- `on_auth_user_created` — AFTER INSERT on auth.users, inserts a matching row
  into profiles. Runs as SECURITY DEFINER so it bypasses RLS.

## Important Notes
1. The profiles table is populated automatically by the trigger. Existing
   users who signed up before this migration will not have a profile row
   until they next interact with auth; a backfill is included below.
2. Messages are immutable — users cannot edit a sent message. They can delete
   their own sent messages.
*/

-- ===== profiles table =====
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read_all" ON profiles;
CREATE POLICY "profiles_read_all"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- ===== user_messages table =====
CREATE TABLE IF NOT EXISTS user_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_participants" ON user_messages;
CREATE POLICY "messages_select_participants"
  ON user_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "messages_insert_as_sender" ON user_messages;
CREATE POLICY "messages_insert_as_sender"
  ON user_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "messages_delete_own_sent" ON user_messages;
CREATE POLICY "messages_delete_own_sent"
  ON user_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);

-- ===== Indexes =====
CREATE INDEX IF NOT EXISTS user_messages_sender_receiver_idx
  ON user_messages (sender_id, receiver_id);

CREATE INDEX IF NOT EXISTS user_messages_receiver_created_idx
  ON user_messages (receiver_id, created_at);

-- ===== Backfill existing profiles =====
INSERT INTO profiles (id, email)
SELECT u.id, u.email
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id);

-- ===== Trigger: auto-create profile on signup =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
