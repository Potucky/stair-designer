export function saveProjectJson({ project, stairConfig, calc, warnings, materials }) {
  const payload = {
    app: 'Stair Designer',
    version: 'v0.0.1 MVP',
    exportedAt: new Date().toISOString(),
    project,
    stairConfig,
    calculations: calc,
    warnings: warnings.map((w) => ({ level: w.level, message: w.msg })),
    materialList: materials,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (project.name || 'project').replace(/[^a-z0-9_-]/gi, '_');
  a.href = url;
  a.download = `${safeName}_stair_designer.json`;
  a.click();
  URL.revokeObjectURL(url);
}
