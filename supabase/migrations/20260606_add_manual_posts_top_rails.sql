-- =============================================================================
-- Migration: add manual_posts and manual_top_rails to stair_config_versions
-- =============================================================================
-- How to apply:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this file and click Run
-- =============================================================================

ALTER TABLE stair_config_versions
  ADD COLUMN IF NOT EXISTS manual_posts     jsonb,
  ADD COLUMN IF NOT EXISTS manual_top_rails jsonb;
