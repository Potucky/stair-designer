import { TUBE_PROFILES } from '../data/materialProfiles.js';

export const INtoU = 0.5;       // scene units per inch
export const TREAD_THICK = 0.3; // visual tread thickness in scene units

export function getTubeProfile(tubeSize) {
  return TUBE_PROFILES[tubeSize] || TUBE_PROFILES['2x2'];
}

// Base center of a post in scene units (world coords: X offset by -run*INtoU/2)
export function getManualPostBase(post, treadPositions, riserHeight, run) {
  const tp = treadPositions[post.stepIndex];
  if (!tp) return null;
  const r_u = run * INtoU;
  const rH_u = riserHeight * INtoU;
  return {
    x: (post.xIn + post.offsetXIn) * INtoU - r_u / 2,
    y: tp.y * INtoU - rH_u / 2 + TREAD_THICK,
    z: (post.zIn + post.offsetZIn) * INtoU,
  };
}

// Top center of a post in scene units
export function getManualPostTop(post, treadPositions, riserHeight, run) {
  const base = getManualPostBase(post, treadPositions, riserHeight, run);
  if (!base) return null;
  return { x: base.x, y: base.y + post.heightIn * INtoU, z: base.z };
}

// Normalize an old-format rail { startPostId, endPostId } to the new endpoint shape.
// Idempotent: returns rail unchanged if endpoints already exist.
export function normalizeRailEndpoints(rail) {
  if (rail.startEndpoint && rail.endEndpoint) return rail;
  return {
    ...rail,
    startEndpoint: {
      anchorType: 'post',
      postId: rail.startPostId,
      pointIn: null,
      extension: { type: 'none', lengthIn: 0 },
    },
    endEndpoint: {
      anchorType: 'post',
      postId: rail.endPostId,
      pointIn: null,
      extension: { type: 'none', lengthIn: 0 },
    },
  };
}

// Resolve an endpoint to a scene-unit { x, y, z } point. Returns null if unresolvable.
function resolveRailEndpoint(endpoint, manualPosts, treadPositions, riserHeight, run) {
  if (endpoint.anchorType === 'post') {
    const post = manualPosts.find(p => p.id === endpoint.postId);
    if (!post) return null;
    return getManualPostTop(post, treadPositions, riserHeight, run);
  }
  if (endpoint.anchorType === 'fixed' && endpoint.pointIn) {
    return {
      x: endpoint.pointIn.xIn * INtoU,
      y: endpoint.pointIn.yIn * INtoU,
      z: endpoint.pointIn.zIn * INtoU,
    };
  }
  return null;
}

// Valid rail segments with start/end in scene units and lengthIn in inches.
// Handles both old { startPostId, endPostId } and new { startEndpoint, endEndpoint } shapes.
// Applies straight endpoint extensions when configured (type: 'straight', lengthIn > 0).
export function getManualRailSegments(manualTopRails, manualPosts, treadPositions, riserHeight, run) {
  const segments = [];
  for (const rail of manualTopRails) {
    const r = normalizeRailEndpoints(rail);
    const start = resolveRailEndpoint(r.startEndpoint, manualPosts, treadPositions, riserHeight, run);
    const end = resolveRailEndpoint(r.endEndpoint, manualPosts, treadPositions, riserHeight, run);
    if (!start || !end) continue;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const coreScene = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const startExt = r.startEndpoint.extension?.type === 'straight'
      ? Math.max(0, Number(r.startEndpoint.extension.lengthIn) || 0)
      : 0;
    const endExt = r.endEndpoint.extension?.type === 'straight'
      ? Math.max(0, Number(r.endEndpoint.extension.lengthIn) || 0)
      : 0;

    const totalLengthIn = coreScene / INtoU + startExt + endExt;

    let extStart = start;
    let extEnd = end;
    if (coreScene > 0.001 && (startExt > 0 || endExt > 0)) {
      const ux = dx / coreScene;
      const uy = dy / coreScene;
      const uz = dz / coreScene;
      if (startExt > 0) {
        extStart = {
          x: start.x - ux * startExt * INtoU,
          y: start.y - uy * startExt * INtoU,
          z: start.z - uz * startExt * INtoU,
        };
      }
      if (endExt > 0) {
        extEnd = {
          x: end.x + ux * endExt * INtoU,
          y: end.y + uy * endExt * INtoU,
          z: end.z + uz * endExt * INtoU,
        };
      }
    }

    segments.push({ rail: r, start: extStart, end: extEnd, lengthIn: totalLengthIn });
  }
  return segments;
}
