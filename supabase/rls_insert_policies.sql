-- =============================================================================
-- RLS INSERT POLICIES -- MVP ONLY (TEMPORARY)
-- =============================================================================
-- WARNING: These policies allow unauthenticated (anon) INSERT access.
-- This is intentional for MVP/prototype use only.
-- MUST be replaced with owner-based policies once authentication is added.
-- Replace with: USING (auth.uid() = owner_id) CHECK (auth.uid() = owner_id)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- stair_projects: allow anon INSERT only
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "anon insert stair_projects" ON stair_projects;

CREATE POLICY "anon insert stair_projects"
  ON stair_projects
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- No SELECT, UPDATE, or DELETE policies are created here intentionally.

-- -----------------------------------------------------------------------------
-- stair_config_versions: allow anon INSERT only
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "anon insert stair_config_versions" ON stair_config_versions;

CREATE POLICY "anon insert stair_config_versions"
  ON stair_config_versions
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- No SELECT, UPDATE, or DELETE policies are created here intentionally.
