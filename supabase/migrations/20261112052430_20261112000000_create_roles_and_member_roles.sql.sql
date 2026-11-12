/*
# Create roles and member_roles tables for server role hierarchy

1. New Tables
- `roles`
  - `id` (uuid, primary key)
  - `server_id` (uuid, not null, references servers ON DELETE CASCADE)
  - `name` (text, not null) — e.g. "Admin", "Moderator", "Mitglied"
  - `color` (text, not null, default '#99aab5') — hex color for name display
  - `position` (integer, not null, default 0) — higher = higher hierarchy
  - `created_at` (timestamptz, default now())

- `member_roles`
  - `id` (uuid, primary key)
  - `server_id` (uuid, not null, references servers ON DELETE CASCADE)
  - `user_id` (uuid, not null, references auth.users ON DELETE CASCADE)
  - `role_id` (uuid, not null, references roles ON DELETE CASCADE)
  - `created_at` (timestamptz, default now())
  - UNIQUE constraint on (server_id, user_id, role_id) to prevent duplicate assignments

2. Indexes
- `roles_server_idx` on roles (server_id, position DESC)
- `member_roles_server_user_idx` on member_roles (server_id, user_id)
- `member_roles_role_idx` on member_roles (role_id)

3. Security (RLS)
- roles: SELECT for all authenticated (shared server space); INSERT/UPDATE/DELETE only server owner
- member_roles: SELECT for all authenticated; INSERT/UPDATE/DELETE only server owner
- Grants: SELECT, INSERT, UPDATE, DELETE on both tables to authenticated

4. Important Notes
1. The server owner automatically gets the highest role conceptually — but we also
   seed a default "Mitglied" role is NOT created here; roles are managed by the owner.
2. Each member can have multiple roles; the frontend picks the highest position as
   the display role.
3. Deleting a server cascades to all its roles and member_roles entries.
4. Deleting a user cascades their member_roles entries.
*/

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#99aab5',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON roles TO authenticated;

DROP POLICY IF EXISTS "roles_select_all" ON roles;
CREATE POLICY "roles_select_all"
  ON roles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "roles_insert_owner" ON roles;
CREATE POLICY "roles_insert_owner"
  ON roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM servers s WHERE s.id = roles.server_id AND s.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "roles_update_owner" ON roles;
CREATE POLICY "roles_update_owner"
  ON roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM servers s WHERE s.id = roles.server_id AND s.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM servers s WHERE s.id = roles.server_id AND s.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "roles_delete_owner" ON roles;
CREATE POLICY "roles_delete_owner"
  ON roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM servers s WHERE s.id = roles.server_id AND s.owner_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS member_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (server_id, user_id, role_id)
);

ALTER TABLE member_roles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON member_roles TO authenticated;

DROP POLICY IF EXISTS "member_roles_select_all" ON member_roles;
CREATE POLICY "member_roles_select_all"
  ON member_roles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "member_roles_insert_owner" ON member_roles;
CREATE POLICY "member_roles_insert_owner"
  ON member_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM servers s WHERE s.id = member_roles.server_id AND s.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "member_roles_update_owner" ON member_roles;
CREATE POLICY "member_roles_update_owner"
  ON member_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM servers s WHERE s.id = member_roles.server_id AND s.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM servers s WHERE s.id = member_roles.server_id AND s.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "member_roles_delete_owner" ON member_roles;
CREATE POLICY "member_roles_delete_owner"
  ON member_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM servers s WHERE s.id = member_roles.server_id AND s.owner_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS roles_server_idx ON roles (server_id, position DESC);
CREATE INDEX IF NOT EXISTS member_roles_server_user_idx ON member_roles (server_id, user_id);
CREATE INDEX IF NOT EXISTS member_roles_role_idx ON member_roles (role_id);