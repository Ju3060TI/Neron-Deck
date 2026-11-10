DROP POLICY IF EXISTS "channel_messages_insert_as_sender" ON channel_messages;
CREATE POLICY "channel_messages_insert_as_member"
  ON channel_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1
      FROM channels ch
      JOIN servers s ON s.id = ch.server_id
      LEFT JOIN server_members sm ON sm.server_id = s.id AND sm.user_id = auth.uid()
      WHERE ch.id = channel_messages.channel_id
        AND (sm.user_id IS NOT NULL OR s.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "server_messages_select_all" ON server_messages;
CREATE POLICY "server_messages_select_members"
  ON server_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM channels ch
      JOIN servers s ON s.id = ch.server_id
      LEFT JOIN server_members sm ON sm.server_id = s.id AND sm.user_id = auth.uid()
      WHERE ch.id = server_messages.channel_id
        AND (sm.user_id IS NOT NULL OR s.owner_id = auth.uid())
    )
  );

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
