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

// Valid rail segments with start/end in scene units and lengthIn in inches.
// Old saves without manualTopRails default to [] at the call site.
export function getManualRailSegments(manualTopRails, manualPosts, treadPositions, riserHeight, run) {
  const segments = [];
  for (const rail of manualTopRails) {
    const sp = manualPosts.find(p => p.id === rail.startPostId);
    const ep = manualPosts.find(p => p.id === rail.endPostId);
    if (!sp || !ep) continue;
    const start = getManualPostTop(sp, treadPositions, riserHeight, run);
    const end = getManualPostTop(ep, treadPositions, riserHeight, run);
    if (!start || !end) continue;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const lenScene = Math.sqrt(dx * dx + dy * dy + dz * dz);
    segments.push({ rail, start, end, lengthIn: lenScene / INtoU });
  }
  return segments;
}
