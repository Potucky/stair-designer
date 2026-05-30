-- =============================================================================
-- Stair Designer — Supabase Database Schema
-- =============================================================================
-- How to apply:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this entire file and click Run
--   3. Verify four tables appear in Table Editor
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: automatically update updated_at timestamp
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Table: stair_projects
-- ---------------------------------------------------------------------------
create table if not exists stair_projects (
  id           uuid        primary key default gen_random_uuid(),
  project_name text        not null,
  client_name  text,
  units        text        not null default 'inches',
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_stair_projects_updated_at
  before update on stair_projects
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Table: stair_config_versions
-- ---------------------------------------------------------------------------
create table if not exists stair_config_versions (
  id                 uuid        primary key default gen_random_uuid(),
  project_id         uuid        not null references stair_projects(id) on delete cascade,
  version_label      text        not null default 'v1',
  stair_config       jsonb       not null,
  calculated_results jsonb,
  warnings           jsonb,
  materials          jsonb,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Table: pdf_exports
-- ---------------------------------------------------------------------------
create table if not exists pdf_exports (
  id                uuid        primary key default gen_random_uuid(),
  project_id        uuid        not null references stair_projects(id) on delete cascade,
  config_version_id uuid        references stair_config_versions(id) on delete set null,
  file_name         text,
  storage_path      text,
  export_metadata   jsonb,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Table: app_checkpoints
-- ---------------------------------------------------------------------------
create table if not exists app_checkpoints (
  id          uuid        primary key default gen_random_uuid(),
  label       text        not null,
  git_commit  text,
  git_tag     text,
  description text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- RLS is enabled on all tables.
-- No public insert/update/delete policies are created here because
-- authentication is not yet implemented.
--
-- When auth is added, create policies such as:
--
--   create policy "Users can read own projects"
--     on stair_projects for select
--     using (auth.uid() = owner_id);
--
-- Until then, all access is restricted to the service_role key (admin only).
-- Do NOT expose the service_role key to the frontend.
-- ---------------------------------------------------------------------------
alter table stair_projects        enable row level security;
alter table stair_config_versions enable row level security;
alter table pdf_exports           enable row level security;
alter table app_checkpoints       enable row level security;

-- ---------------------------------------------------------------------------
-- Seed: initial app checkpoint
-- ---------------------------------------------------------------------------
insert into app_checkpoints (label, git_commit, git_tag, description)
values (
  'MVP Printable PDF',
  '4379356',
  'checkpoint/2026-05-29-2155-github-ready',
  'GitHub-ready Stair Designer MVP with printable side-view PDF drawing sheet.'
);
