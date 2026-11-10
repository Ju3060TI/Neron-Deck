/*
# Create channel categories and link channels to them

1. New Tables
- `channel_categories`
  - `id` (uuid, primary key, default gen_random_uuid())
  - `server_id` (uuid, not null, references servers ON DELETE CASCADE)
  - `name` (text, not null)
  - `position` (integer, not null, default 0) — sort order within the server
  - `created_at` (timestamptz, default now())

2. Modified Tables
- `channels`: new nullable column `category_id` (uuid, references channel_categories ON DELETE SET NULL).
  NULL means the channel has no category and appears in the uncategorized group.

3. Indexes
- `channel_categories_server_idx` on (server_id, position)
- `channels_category_idx` on (category_id)

4. Security (RLS)
- channel_categories follows the exact same model as `channels`:
  - SELECT: any authenticated user can read categories of all servers (shared space)
  - INSERT / UPDATE / DELETE: only the server owner (checked via servers.owner_id)
- `channels.category_id` is covered by the existing channels policies.
- Grants: SELECT, INSERT, UPDATE, DELETE on channel_categories to authenticated.

5. Important Notes
1. Deleting a category does NOT delete its channels — category_id is set to NULL instead.
2. Cascades: deleting a server deletes its categories.
*/

CREATE TABLE IF NOT EXISTS channel_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE channel_categories ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON channel_categories TO authenticated;

DROP POLICY IF EXISTS "channel_categories_select_all" ON channel_categories;
CREATE POLICY "channel_categories_select_all"
  ON channel_categories FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "channel_categories_insert_owner" ON channel_categories;
CREATE POLICY "channel_categories_insert_owner"
  ON channel_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM servers s WHERE s.id = channel_categories.server_id AND s.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "channel_categories_update_owner" ON channel_categories;
CREATE POLICY "channel_categories_update_owner"
  ON channel_categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM servers s WHERE s.id = channel_categories.server_id AND s.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM servers s WHERE s.id = channel_categories.server_id AND s.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "channel_categories_delete_owner" ON channel_categories;
CREATE POLICY "channel_categories_delete_owner"
  ON channel_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM servers s WHERE s.id = channel_categories.server_id AND s.owner_id = auth.uid())
  );

-- channels get a nullable link to their category; NULL = uncategorized
ALTER TABLE channels ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES channel_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS channel_categories_server_idx ON channel_categories (server_id, position);
CREATE INDEX IF NOT EXISTS channels_category_idx ON channels (category_id);
