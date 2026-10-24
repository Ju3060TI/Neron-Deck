/*
# Tighten channel_messages SELECT RLS policy

## What this does
The existing `channel_messages_select_all` policy uses `USING (true)`, which lets any
authenticated user read messages from any channel — even servers they haven't joined.

This migration replaces it with a policy that checks the user is a member of the server
that owns the channel (via `server_members`) OR is the owner of that server.

## Security changes
- Drops `channel_messages_select_all`
- Creates `channel_messages_select_members` — requires server membership or ownership
*/

DROP POLICY IF EXISTS "channel_messages_select_all" ON channel_messages;

CREATE POLICY "channel_messages_select_members"
  ON channel_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM channels ch
      JOIN servers s ON s.id = ch.server_id
      LEFT JOIN server_members sm ON sm.server_id = s.id AND sm.user_id = auth.uid()
      WHERE ch.id = channel_messages.channel_id
        AND (sm.user_id IS NOT NULL OR s.owner_id = auth.uid())
    )
  );
