# Supabase Database Setup

## Apply the schema

1. Open [Supabase Dashboard](https://app.supabase.com) and select your project.
2. Go to **SQL Editor**.
3. Paste the contents of `supabase/schema.sql` into the editor.
4. Click **Run**.
5. Open **Table Editor** and confirm these four tables exist:
   - `stair_projects`
   - `stair_config_versions`
   - `pdf_exports`
   - `app_checkpoints`
6. Verify the seed row in `app_checkpoints` shows label `MVP Printable PDF`.

## Security notes

- **Do not expose the `service_role` key** to the frontend or commit it to the repo.
- **Do not add Supabase client keys to the app yet.** The frontend is not connected.
- Row Level Security (RLS) is enabled on all tables. No public policies exist until
  authentication is implemented, so all data is admin-only for now.

## Next steps (future phases)

- Add Supabase `anon` key to the frontend using environment variables.
- Implement authentication (Supabase Auth).
- Create RLS policies scoped to authenticated users (`auth.uid()`).
- Wire up project save/load in the Stair Designer UI.
