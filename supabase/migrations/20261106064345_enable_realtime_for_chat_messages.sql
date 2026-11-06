/*
# Enable realtime for chat message tables

## What this does
Adds the two chat message tables to the Supabase realtime publication so that
newly inserted messages are pushed to open browser sessions instead of only
appearing after a page reload.

## Modified publication
- `supabase_realtime` now includes `channel_messages` (server text channels)
- `supabase_realtime` now includes `direct_messages` (friend DMs)

## Security
- No table, column, grant or policy changes.
- Realtime delivery respects row level security: a client only receives
  INSERT events for rows its SELECT policy allows (channel members for
  `channel_messages`, sender or receiver for `direct_messages`).

## Important Notes
1. The statements are guarded so re-running the migration does nothing.
2. The table name `messages` does not exist in this project; the chat tables are the two above.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'channel_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'direct_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
  END IF;
END $$;
