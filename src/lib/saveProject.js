import supabase from './supabaseClient.js';

export async function saveProject({
  project,
  stairConfig,
  calc,
  warnings,
  materials,
  manualPosts = [],
  manualTopRails = [],
  structureOffsetXIn = 0,
  structureOffsetZIn = 0,
  topRailPathMode = 'standard',
}) {
  if (!supabase) {
    return { ok: false, error: 'Supabase is not configured.' };
  }

  try {
    const projectId = crypto.randomUUID();

    const { error: projectError } = await supabase
      .from('stair_projects')
      .insert({
        id: projectId,
        project_name: project.name || 'Untitled',
        client_name: project.client || null,
        units: 'inches',
        notes: null,
      });

    if (projectError) {
      return { ok: false, error: projectError.message };
    }

    // stair_config holds the full user-configurable state so no new columns
    // are needed when additional settings are added to the app.
    const fullConfig = {
      ...stairConfig,
      structureOffsetXIn,
      structureOffsetZIn,
      topRailPathMode,
    };

    const { error: versionError } = await supabase
      .from('stair_config_versions')
      .insert({
        project_id: projectId,
        version_label: 'v1',
        stair_config: fullConfig,
        calculated_results: calc,
        warnings: warnings,
        materials: materials,
        manual_posts: manualPosts,
        manual_top_rails: manualTopRails,
      });

    if (versionError) {
      return { ok: false, error: versionError.message };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: 'Save failed. Please try again.' };
  }
}
