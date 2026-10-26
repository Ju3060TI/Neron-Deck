/*
# Add voice channel support

## What this does
Adds a `type` column to `channels` to distinguish text channels from voice channels.
Existing channels default to 'text'. A CHECK constraint restricts to the two valid values.

## Security changes
- No policy changes needed — existing channel policies already cover all rows.
- The new column inherits the table's RLS. INSERT/UPDATE WITH CHECK policies
  that reference `channels.server_id` continue to work since `type` has a safe default.
*/

ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'text';

ALTER TABLE channels
  ADD CONSTRAINT channels_type_check CHECK (type IN ('text', 'voice'));
