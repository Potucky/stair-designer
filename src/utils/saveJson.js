const NUMERIC_KEYS = new Set([
  'height', 'run', 'width', 'handrailHeight', 'pinOpening', 'postSpacing',
]);
const ALL_STAIR_KEYS = [...NUMERIC_KEYS, 'steps', 'railingEnabled', 'tubeSize'];

function isValidStairValue(key, value) {
  if (key === 'steps') return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0;
  if (key === 'railingEnabled') return typeof value === 'boolean';
  if (key === 'tubeSize') return typeof value === 'string' && value.length > 0;
  if (NUMERIC_KEYS.has(key)) return typeof value === 'number' && Number.isFinite(value);
  return false;
}

export function openProjectJson(onLoad, onError) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.app !== 'Stair Designer') throw new Error('Not a Stair Designer file');
        const project = {};
        if (data.project && typeof data.project === 'object') {
          if (typeof data.project.name === 'string') project.name = data.project.name;
          if (typeof data.project.client === 'string') project.client = data.project.client;
          if (typeof data.project.notes === 'string') project.notes = data.project.notes;
        }
        const stairConfig = {};
        if (data.stairConfig && typeof data.stairConfig === 'object') {
          for (const key of ALL_STAIR_KEYS) {
            if (key in data.stairConfig && isValidStairValue(key, data.stairConfig[key])) {
              stairConfig[key] = data.stairConfig[key];
            }
          }
        }
        onLoad({ project, stairConfig });
      } catch (err) {
        onError(err.message || 'Invalid file');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

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
