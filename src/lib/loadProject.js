import supabase from './supabaseClient.js';

export async function listProjects({ projectType } = {}) {
  if (!supabase) return { ok: false, error: 'Supabase is not configured.', projects: [] };
  try {
    let query = supabase
      .from('stair_projects')
      .select('id, project_name, client_name, created_at, updated_at')
      .order('updated_at', { ascending: false });
    if (projectType) query = query.eq('project_type', projectType);
    const { data, error } = await query;
    if (error) return { ok: false, error: error.message, projects: [] };
    return { ok: true, projects: data ?? [] };
  } catch {
    return { ok: false, error: 'Failed to load project list.', projects: [] };
  }
}

export async function loadProject(projectId) {
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };
  try {
    const { data: project, error: projectError } = await supabase
      .from('stair_projects')
      .select('id, project_name, client_name, units')
      .eq('id', projectId)
      .single();
    if (projectError) return { ok: false, error: projectError.message };

    const { data: version, error: versionError } = await supabase
      .from('stair_config_versions')
      .select('stair_config, manual_posts, manual_top_rails')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (versionError) return { ok: false, error: versionError.message };

    return { ok: true, project, version };
  } catch {
    return { ok: false, error: 'Failed to load project.' };
  }
}
