import supabase from './supabaseClient.js';

export async function saveProject({ project, stairConfig, calc, warnings, materials }) {
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

    const { error: versionError } = await supabase
      .from('stair_config_versions')
      .insert({
        project_id: projectId,
        version_label: 'v1',
        stair_config: stairConfig,
        calculated_results: calc,
        warnings: warnings,
        materials: materials,
      });

    if (versionError) {
      return { ok: false, error: versionError.message };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: 'Save failed. Please try again.' };
  }
}
