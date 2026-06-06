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

// Identifies which endpoints are terminal (open) vs internal joints.
// A start endpoint is open if no other rail's end arrives at the same post.
// An end endpoint is open if no other rail's start departs from the same post.
// Fixed endpoints are always treated as open (no chaining through a fixed point).
function getOpenEndFlags(normalizedRails) {
  const startsSet = new Set(
    normalizedRails
      .filter(r => r.startEndpoint.anchorType === 'post')
      .map(r => r.startEndpoint.postId)
  );
  const endsSet = new Set(
    normalizedRails
      .filter(r => r.endEndpoint.anchorType === 'post')
      .map(r => r.endEndpoint.postId)
  );
  return {
    isOpenStart: (ep) => ep.anchorType !== 'post' || !endsSet.has(ep.postId),
    isOpenEnd: (ep) => ep.anchorType !== 'post' || !startsSet.has(ep.postId),
  };
}

// Valid rail segments with start/end in scene units and lengthIn in inches.
// Handles both old { startPostId, endPostId } and new { startEndpoint, endEndpoint } shapes.
// Applies straight endpoint extensions when configured (type: 'straight', lengthIn > 0).
// Also applies global open-end extensions: railLowerExtensionIn at the start of terminal segments,
// railUpperExtensionIn at the end of terminal segments. Internal joints are not extended.
export function getManualRailSegments(manualTopRails, manualPosts, treadPositions, riserHeight, run, railLowerExtensionIn = 0, railUpperExtensionIn = 0) {
  const segments = [];
  const normalizedRails = manualTopRails.map(normalizeRailEndpoints);
  const flags = getOpenEndFlags(normalizedRails);

  for (const r of normalizedRails) {
    const start = resolveRailEndpoint(r.startEndpoint, manualPosts, treadPositions, riserHeight, run);
    const end = resolveRailEndpoint(r.endEndpoint, manualPosts, treadPositions, riserHeight, run);
    if (!start || !end) continue;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const coreScene = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Per-rail endpoint extensions (existing per-segment feature)
    const perRailStartExt = r.startEndpoint.extension?.type === 'straight'
      ? Math.max(0, Number(r.startEndpoint.extension.lengthIn) || 0)
      : 0;
    const perRailEndExt = r.endEndpoint.extension?.type === 'straight'
      ? Math.max(0, Number(r.endEndpoint.extension.lengthIn) || 0)
      : 0;

    // Global open-end extensions: only applied at terminal endpoints
    const globalStartExt = flags.isOpenStart(r.startEndpoint) ? Math.max(0, railLowerExtensionIn) : 0;
    const globalEndExt = flags.isOpenEnd(r.endEndpoint) ? Math.max(0, railUpperExtensionIn) : 0;

    const startExt = perRailStartExt + globalStartExt;
    const endExt = perRailEndExt + globalEndExt;

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

// Resolve a bottom rail endpoint: post-anchored points sit bottomRailHeightIn above the stair
// nosing line at the post's x position, so the rail runs parallel to the stair slope and the
// tube bottom never intersects tread plates regardless of where intermediate treads fall.
function resolveBottomRailEndpoint(endpoint, manualPosts, treadPositions, riserHeight, run, bottomRailHeightIn) {
  if (endpoint.anchorType === 'post') {
    const post = manualPosts.find(p => p.id === endpoint.postId);
    if (!post) return null;
    const base = getManualPostBase(post, treadPositions, riserHeight, run);
    if (!base) return null;

    const steps = treadPositions.length;
    const treadDepth = steps > 0 ? run / steps : run;
    const rH_u = riserHeight * INtoU;
    const treadD_u = treadDepth * INtoU;
    const r_u = run * INtoU;

    // Stair nosing line: passes through tread-0 front edge at (x=-r_u/2, y=0.5*rH_u+TREAD_THICK)
    // and rises at slope rH_u/treadD_u. Evaluate at this post's x.
    const nosingY = (rH_u / treadD_u) * (base.x + r_u / 2) + 0.5 * rH_u + TREAD_THICK;

    // Endpoint y = nosing line + clearance. The renderer lifts midV by RAIL_H/2 so the box
    // bottom face sits at approximately this height (exact for flat rails; ~0.08" high for typical
    // stair angles, which is acceptable).
    return { x: base.x, y: nosingY + bottomRailHeightIn * INtoU, z: base.z };
  }
  if (endpoint.anchorType === 'fixed' && endpoint.pointIn) {
    const steps = treadPositions.length;
    const treadDepth = steps > 0 ? run / steps : run;
    const rH_u = riserHeight * INtoU;
    const treadD_u = treadDepth * INtoU;
    const r_u = run * INtoU;
    const x_u = endpoint.pointIn.xIn * INtoU;
    const nosingY = (rH_u / treadD_u) * (x_u + r_u / 2) + 0.5 * rH_u + TREAD_THICK;
    return {
      x: x_u,
      y: nosingY + bottomRailHeightIn * INtoU,
      z: endpoint.pointIn.zIn * INtoU,
    };
  }
  return null;
}

// Middle rail segments reusing the same post-to-post connections as manualTopRails,
// but with endpoints at middleRailHeightIn inches above the stair nosing line.
// Extensions are accepted for API compatibility but callers pass 0 — only Top Rail extends.
export function getManualMiddleRailSegments(manualTopRails, manualPosts, treadPositions, riserHeight, run, middleRailHeightIn, railLowerExtensionIn = 0, railUpperExtensionIn = 0) {
  const segments = [];
  const normalizedRails = manualTopRails.map(normalizeRailEndpoints);
  const flags = getOpenEndFlags(normalizedRails);

  for (const r of normalizedRails) {
    const start = resolveBottomRailEndpoint(r.startEndpoint, manualPosts, treadPositions, riserHeight, run, middleRailHeightIn);
    const end = resolveBottomRailEndpoint(r.endEndpoint, manualPosts, treadPositions, riserHeight, run, middleRailHeightIn);
    if (!start || !end) continue;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const coreScene = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const startExt = flags.isOpenStart(r.startEndpoint) ? Math.max(0, railLowerExtensionIn) : 0;
    const endExt = flags.isOpenEnd(r.endEndpoint) ? Math.max(0, railUpperExtensionIn) : 0;
    const totalLengthIn = coreScene / INtoU + startExt + endExt;

    let extStart = start;
    let extEnd = end;
    if (coreScene > 0.001 && (startExt > 0 || endExt > 0)) {
      const ux = dx / coreScene;
      const uy = dy / coreScene;
      const uz = dz / coreScene;
      if (startExt > 0) {
        extStart = { x: start.x - ux * startExt * INtoU, y: start.y - uy * startExt * INtoU, z: start.z - uz * startExt * INtoU };
      }
      if (endExt > 0) {
        extEnd = { x: end.x + ux * endExt * INtoU, y: end.y + uy * endExt * INtoU, z: end.z + uz * endExt * INtoU };
      }
    }

    segments.push({ rail: r, start: extStart, end: extEnd, lengthIn: totalLengthIn });
  }
  return segments;
}

// Top rail segments with dogleg support. Returns multiple sub-segments per rail when
// doglegEnabled is true. For straight rails returns the identical result as getManualRailSegments
// but with an added segKey field (equals rail.id) for React keying.
// Segment A: start (+ start extension) → first 90° turn point
// Segment B: perpendicular sideways for doglegOffsetIn
// Segment C: resumes original direction (+ end extension) on the parallel shifted line
// Callers of getManualRailSegments (PDF, material calc, bottom/middle rail) are unaffected.
export function getManualTopRailDoglegSegments(manualTopRails, manualPosts, treadPositions, riserHeight, run, railLowerExtensionIn = 0, railUpperExtensionIn = 0) {
  const segments = [];
  const normalizedRails = manualTopRails.map(normalizeRailEndpoints);
  const flags = getOpenEndFlags(normalizedRails);

  for (const r of normalizedRails) {
    const start = resolveRailEndpoint(r.startEndpoint, manualPosts, treadPositions, riserHeight, run);
    const end = resolveRailEndpoint(r.endEndpoint, manualPosts, treadPositions, riserHeight, run);
    if (!start || !end) continue;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const coreScene = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (coreScene < 0.001) continue;

    const ux = dx / coreScene;
    const uy = dy / coreScene;
    const uz = dz / coreScene;

    const perRailStartExt = r.startEndpoint.extension?.type === 'straight'
      ? Math.max(0, Number(r.startEndpoint.extension.lengthIn) || 0) : 0;
    const perRailEndExt = r.endEndpoint.extension?.type === 'straight'
      ? Math.max(0, Number(r.endEndpoint.extension.lengthIn) || 0) : 0;
    const globalStartExt = flags.isOpenStart(r.startEndpoint) ? Math.max(0, railLowerExtensionIn) : 0;
    const globalEndExt = flags.isOpenEnd(r.endEndpoint) ? Math.max(0, railUpperExtensionIn) : 0;
    const startExt = perRailStartExt + globalStartExt;
    const endExt = perRailEndExt + globalEndExt;

    const extStart = startExt > 0
      ? { x: start.x - ux * startExt * INtoU, y: start.y - uy * startExt * INtoU, z: start.z - uz * startExt * INtoU }
      : start;

    if (!r.doglegEnabled) {
      const extEnd = endExt > 0
        ? { x: end.x + ux * endExt * INtoU, y: end.y + uy * endExt * INtoU, z: end.z + uz * endExt * INtoU }
        : end;
      segments.push({ rail: r, segKey: r.id, start: extStart, end: extEnd, lengthIn: coreScene / INtoU + startExt + endExt });
    } else {
      const doglegStartIn = Math.max(0, Number(r.doglegStartIn) || 0);
      const doglegOffsetIn = Math.max(0, Number(r.doglegOffsetIn) || 0);
      const doglegAfterIn = Math.max(0, Number(r.doglegAfterIn) || 0);
      const coreLengthIn = coreScene / INtoU;
      const doglegStartClampedIn = Math.min(doglegStartIn, coreLengthIn);

      // Horizontal perpendicular (90° in XZ plane, no Y component)
      const horizLen = Math.sqrt(ux * ux + uz * uz);
      let px = 1, pz = 0;
      if (horizLen > 0.001) {
        const hx = ux / horizLen;
        const hz = uz / horizLen;
        if (r.doglegSide === 'right') { px = hz; pz = -hx; }
        else { px = -hz; pz = hx; } // left (default)
      }

      // pointA: first turn — end of Segment A / start of Segment B
      const pointA = {
        x: start.x + ux * doglegStartClampedIn * INtoU,
        y: start.y + uy * doglegStartClampedIn * INtoU,
        z: start.z + uz * doglegStartClampedIn * INtoU,
      };

      // pointB: second turn — end of Segment B / start of Segment C
      const pointB = {
        x: pointA.x + px * doglegOffsetIn * INtoU,
        y: pointA.y,
        z: pointA.z + pz * doglegOffsetIn * INtoU,
      };

      // shiftedEnd: original rail end shifted sideways by dogleg offset
      const shiftedEnd = {
        x: end.x + px * doglegOffsetIn * INtoU,
        y: end.y,
        z: end.z + pz * doglegOffsetIn * INtoU,
      };

      // extEndC: end of Segment C (includes end extension along original rail direction)
      const extEndC = {
        x: shiftedEnd.x + ux * endExt * INtoU,
        y: shiftedEnd.y + uy * endExt * INtoU,
        z: shiftedEnd.z + uz * endExt * INtoU,
      };

      const segmentCLengthIn = Math.max(0, coreLengthIn - doglegStartClampedIn) + endExt;

      const lenA_scene = Math.sqrt(
        (pointA.x - extStart.x) ** 2 + (pointA.y - extStart.y) ** 2 + (pointA.z - extStart.z) ** 2
      );
      if (lenA_scene > 0.001) {
        segments.push({ rail: r, segKey: r.id + '-A', start: extStart, end: pointA, lengthIn: doglegStartClampedIn + startExt });
      }
      if (doglegOffsetIn > 0) {
        segments.push({ rail: r, segKey: r.id + '-B', start: pointA, end: pointB, lengthIn: doglegOffsetIn });
      }
      if (segmentCLengthIn > 0) {
        segments.push({ rail: r, segKey: r.id + '-C', start: pointB, end: extEndC, lengthIn: segmentCLengthIn });
      }
    }
  }
  return segments;
}

// Bottom rail segments reusing the same post-to-post connections as manualTopRails,
// but with endpoints at bottomRailHeightIn inches above each post base (tread surface).
// Extensions are accepted for API compatibility but callers pass 0 — only Top Rail extends.
export function getManualBottomRailSegments(manualTopRails, manualPosts, treadPositions, riserHeight, run, bottomRailHeightIn, railLowerExtensionIn = 0, railUpperExtensionIn = 0) {
  const segments = [];
  const normalizedRails = manualTopRails.map(normalizeRailEndpoints);
  const flags = getOpenEndFlags(normalizedRails);

  for (const r of normalizedRails) {
    const start = resolveBottomRailEndpoint(r.startEndpoint, manualPosts, treadPositions, riserHeight, run, bottomRailHeightIn);
    const end = resolveBottomRailEndpoint(r.endEndpoint, manualPosts, treadPositions, riserHeight, run, bottomRailHeightIn);
    if (!start || !end) continue;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const coreScene = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const startExt = flags.isOpenStart(r.startEndpoint) ? Math.max(0, railLowerExtensionIn) : 0;
    const endExt = flags.isOpenEnd(r.endEndpoint) ? Math.max(0, railUpperExtensionIn) : 0;
    const totalLengthIn = coreScene / INtoU + startExt + endExt;

    let extStart = start;
    let extEnd = end;
    if (coreScene > 0.001 && (startExt > 0 || endExt > 0)) {
      const ux = dx / coreScene;
      const uy = dy / coreScene;
      const uz = dz / coreScene;
      if (startExt > 0) {
        extStart = { x: start.x - ux * startExt * INtoU, y: start.y - uy * startExt * INtoU, z: start.z - uz * startExt * INtoU };
      }
      if (endExt > 0) {
        extEnd = { x: end.x + ux * endExt * INtoU, y: end.y + uy * endExt * INtoU, z: end.z + uz * endExt * INtoU };
      }
    }

    segments.push({ rail: r, start: extStart, end: extEnd, lengthIn: totalLengthIn });
  }
  return segments;
}
