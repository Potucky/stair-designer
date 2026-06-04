const NUMERIC_KEYS = new Set([
  'height', 'run', 'width', 'handrailHeight', 'pinOpening', 'postSpacing', 'manualRailingRun', 'bottomLandingLength',
]);
const ALL_STAIR_KEYS = [...NUMERIC_KEYS, 'steps', 'railingEnabled', 'tubeSize', 'railingRunMode', 'bottomLandingEnabled'];

function isValidStairValue(key, value) {
  if (key === 'steps') return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0;
  if (key === 'railingEnabled') return typeof value === 'boolean';
  if (key === 'bottomLandingEnabled') return typeof value === 'boolean';
  if (key === 'tubeSize') return typeof value === 'string' && value.length > 0;
  if (key === 'railingRunMode') return value === 'matchStair' || value === 'manual';
  if (NUMERIC_KEYS.has(key)) return typeof value === 'number' && Number.isFinite(value);
  return false;
}

function isValidManualTopRail(r) {
  if (!r || typeof r !== 'object' || typeof r.id !== 'string') return false;
  // New endpoint-based format (post-endpoint-foundation)
  if (r.startEndpoint || r.endEndpoint) {
    return typeof r.startEndpoint === 'object' && typeof r.endEndpoint === 'object';
  }
  // Old format: bare { id, startPostId, endPostId } — profile not required
  return (
    typeof r.startPostId === 'string' &&
    typeof r.endPostId === 'string' &&
    r.startPostId !== r.endPostId
  );
}

function isValidManualPost(p) {
  return (
    p && typeof p === 'object' &&
    typeof p.id === 'string' &&
    typeof p.stepIndex === 'number' && Number.isInteger(p.stepIndex) && p.stepIndex >= 0 &&
    (p.mount === 'top' || p.mount === 'side') &&
    (p.side === 'left' || p.side === 'right' || p.side === 'center') &&
    typeof p.xIn === 'number' && Number.isFinite(p.xIn) &&
    typeof p.zIn === 'number' && Number.isFinite(p.zIn) &&
    typeof p.offsetXIn === 'number' && Number.isFinite(p.offsetXIn) &&
    typeof p.offsetZIn === 'number' && Number.isFinite(p.offsetZIn) &&
    typeof p.heightIn === 'number' && Number.isFinite(p.heightIn) && p.heightIn > 0
  );
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
        const units = data.units === 'mm' ? 'mm' : 'in';
        // Load manualPosts; old files without this field default to []
        const manualPosts = Array.isArray(data.manualPosts)
          ? data.manualPosts.filter(isValidManualPost)
          : [];
        // Load manualTopRails; old files without this field default to [].
        // Old rails without profile default to '2x1'.
        const manualTopRails = Array.isArray(data.manualTopRails)
          ? data.manualTopRails
              .filter(isValidManualTopRail)
              .map(r => (r.profile ? r : { ...r, profile: '2x1' }))
          : [];
        onLoad({ project, stairConfig, units, manualPosts, manualTopRails });
      } catch (err) {
        onError(err.message || 'Invalid file');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

export function saveProjectJson({ project, stairConfig, calc, warnings, materials, units = 'in', manualPosts = [], manualTopRails = [] }) {
  const payload = {
    app: 'Stair Designer',
    version: 'v0.0.1 MVP',
    exportedAt: new Date().toISOString(),
    units,
    project,
    stairConfig,
    manualPosts,
    manualTopRails,
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
