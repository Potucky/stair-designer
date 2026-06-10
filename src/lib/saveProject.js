import supabase from './supabaseClient.js';

export async function saveProject({
  project,
  stairConfig,
  calc,
  warnings,
  materials,
  manualDimensions = [],
  manualPosts = [],
  manualTopRails = [],
  manualTextAnnotations = [],
  structureOffsetXIn = 0,
  structureOffsetZIn = 0,
  pdfMirrored = false,
  topRailPathMode = 'standard',
  units = 'in',
  currentProjectId = null,
}) {
  if (!supabase) {
    return { ok: false, error: 'Supabase is not configured.' };
  }

  try {
    let projectId = currentProjectId;

    if (projectId) {
      // Update existing project metadata
      const { error: updateError } = await supabase
        .from('stair_projects')
        .update({
          project_name: project.name || 'Untitled',
          client_name: project.client || null,
          units,
        })
        .eq('id', projectId);
      if (updateError) return { ok: false, error: updateError.message };
    } else {
      // Create new project row
      projectId = crypto.randomUUID();
      const { error: projectError } = await supabase
        .from('stair_projects')
        .insert({
          id: projectId,
          project_name: project.name || 'Untitled',
          client_name: project.client || null,
          units,
          notes: null,
        });
      if (projectError) return { ok: false, error: projectError.message };
    }

    // Count existing versions to generate a label
    const { count } = await supabase
      .from('stair_config_versions')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);
    const versionLabel = `v${(count ?? 0) + 1}`;

    // stair_config holds the full user-configurable state so no new columns
    // are needed when additional settings are added to the app.
    const fullConfig = {
      ...stairConfig,
      structureOffsetXIn,
      structureOffsetZIn,
      pdfMirrored,
      topRailPathMode,
      units,
      manualDimensions,
      manualTextAnnotations,
    };

    const { error: versionError } = await supabase
      .from('stair_config_versions')
      .insert({
        project_id: projectId,
        version_label: versionLabel,
        stair_config: fullConfig,
        calculated_results: calc,
        warnings: warnings,
        materials: materials,
        manual_posts: manualPosts,
        manual_top_rails: manualTopRails,
      });

    if (versionError) return { ok: false, error: versionError.message };

    return { ok: true, projectId };
  } catch {
    return { ok: false, error: 'Save failed. Please try again.' };
  }
}
