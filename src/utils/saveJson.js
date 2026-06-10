const NUMERIC_KEYS = new Set([
  'height', 'run', 'width', 'handrailHeight', 'pinOpening', 'postSpacing', 'manualRailingRun', 'bottomLandingLength', 'topLandingLength', 'bottomRailHeight', 'railLowerExtensionIn', 'railUpperExtensionIn',
]);
const ALL_STAIR_KEYS = [...NUMERIC_KEYS, 'steps', 'railingEnabled', 'tubeSize', 'railingRunMode', 'bottomLandingEnabled', 'topLandingEnabled', 'bottomRailEnabled', 'railingColorMode', 'middleRailEnabled'];

function isValidStairValue(key, value) {
  if (key === 'steps') return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0;
  if (key === 'railingEnabled') return typeof value === 'boolean';
  if (key === 'bottomLandingEnabled') return typeof value === 'boolean';
  if (key === 'topLandingEnabled') return typeof value === 'boolean';
  if (key === 'bottomRailEnabled') return typeof value === 'boolean';
  if (key === 'tubeSize') return typeof value === 'string' && value.length > 0;
  if (key === 'railingRunMode') return value === 'matchStair' || value === 'manual';
  if (key === 'railingColorMode') return value === 'work' || value === 'black';
  if (key === 'middleRailEnabled') return typeof value === 'boolean';
  if (key === 'bottomLandingLength' || key === 'topLandingLength')
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
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

function isValidManualTextAnnotation(a) {
  if (!a || typeof a !== 'object' || typeof a.id !== 'string') return false;
  if (typeof a.text !== 'string') return false;
  return isFinite(Number(a.xIn)) && isFinite(Number(a.yIn));
}

function isValidManualDimension(d) {
  if (!d || typeof d !== 'object' || typeof d.id !== 'string') return false;
  const aOk = d.a && isFinite(Number(d.a.xIn)) && isFinite(Number(d.a.yIn)) && isFinite(Number(d.a.zIn));
  const bOk = d.b && isFinite(Number(d.b.xIn)) && isFinite(Number(d.b.yIn)) && isFinite(Number(d.b.zIn));
  return aOk && bOk;
}

function isValidManualPost(p) {
  if (!p || typeof p !== 'object' || typeof p.id !== 'string') return false;
  if (typeof p.xIn !== 'number' || !Number.isFinite(p.xIn)) return false;
  if (typeof p.zIn !== 'number' || !Number.isFinite(p.zIn)) return false;
  if (typeof p.offsetXIn !== 'number' || !Number.isFinite(p.offsetXIn)) return false;
  if (typeof p.offsetZIn !== 'number' || !Number.isFinite(p.offsetZIn)) return false;
  if (typeof p.heightIn !== 'number' || !Number.isFinite(p.heightIn) || p.heightIn <= 0) return false;
  // Landing posts don't need stepIndex/mount/side
  if (p.surfaceType === 'bottomLanding' || p.surfaceType === 'topLanding') return true;
  // Tread posts require stepIndex, mount, side (backward compat)
  return (
    typeof p.stepIndex === 'number' && Number.isInteger(p.stepIndex) && p.stepIndex >= 0 &&
    (p.mount === 'top' || p.mount === 'side') &&
    (p.side === 'left' || p.side === 'right' || p.side === 'center')
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
        // Load manualDimensions; old files without this field default to [].
        // Accept top-level or stairConfig.manualDimensions fallback.
        const rawDims = Array.isArray(data.manualDimensions)
          ? data.manualDimensions
          : Array.isArray(data.stairConfig?.manualDimensions)
            ? data.stairConfig.manualDimensions
            : [];
        const manualDimensions = rawDims
          .filter(isValidManualDimension)
          .map(d => ({ ...d, label: typeof d.label === 'string' ? d.label : `${Number(d.measuredValueIn || 0).toFixed(2)}"` }));
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
        if (!('bottomRailEnabled' in stairConfig)) stairConfig.bottomRailEnabled = false;
        if (!('bottomRailHeight' in stairConfig)) stairConfig.bottomRailHeight = 1;
        if (!('railingColorMode' in stairConfig)) stairConfig.railingColorMode = 'work';
        if (!('middleRailEnabled' in stairConfig)) stairConfig.middleRailEnabled = false;
        if (!('railLowerExtensionIn' in stairConfig)) stairConfig.railLowerExtensionIn = 0;
        if (!('railUpperExtensionIn' in stairConfig)) stairConfig.railUpperExtensionIn = 0;
        // middleRailHeights is an array — handle separately with safe validation
        if (Array.isArray(data.stairConfig?.middleRailHeights)) {
          const valid = data.stairConfig.middleRailHeights.filter(
            h => typeof h === 'number' && Number.isFinite(h) && h > 0
          );
          stairConfig.middleRailHeights = valid.length > 0 ? valid : [18];
        } else {
          // legacy scalar fallback
          const legacy = data.stairConfig?.middleRailHeight;
          stairConfig.middleRailHeights = (typeof legacy === 'number' && Number.isFinite(legacy) && legacy > 0)
            ? [legacy]
            : [18];
        }
        const structureOffsetXIn = typeof data.structureOffsetXIn === 'number' && Number.isFinite(data.structureOffsetXIn)
          ? data.structureOffsetXIn : 0;
        const structureOffsetZIn = typeof data.structureOffsetZIn === 'number' && Number.isFinite(data.structureOffsetZIn)
          ? data.structureOffsetZIn : 0;
        const topRailPathMode = data.topRailPathMode === 'manual' ? 'manual' : 'standard';
        const manualTextAnnotations = Array.isArray(data.manualTextAnnotations)
          ? data.manualTextAnnotations.filter(isValidManualTextAnnotation)
          : [];
        onLoad({ project, stairConfig, units, manualDimensions, manualPosts, manualTopRails, structureOffsetXIn, structureOffsetZIn, topRailPathMode, manualTextAnnotations });
      } catch (err) {
        onError(err.message || 'Invalid file');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

export function saveProjectJson({ project, stairConfig, calc, warnings, materials, units = 'in', manualDimensions = [], manualPosts = [], manualTopRails = [], structureOffsetXIn = 0, structureOffsetZIn = 0, topRailPathMode = 'standard', manualTextAnnotations = [] }) {
  const payload = {
    app: 'Stair Designer',
    version: 'v0.0.1 MVP',
    exportedAt: new Date().toISOString(),
    units,
    project,
    stairConfig,
    manualDimensions,
    manualPosts,
    manualTopRails,
    manualTextAnnotations,
    structureOffsetXIn,
    structureOffsetZIn,
    topRailPathMode,
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
