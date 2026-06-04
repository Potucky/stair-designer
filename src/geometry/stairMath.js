import { getManualRailSegments, getManualBottomRailSegments, getManualMiddleRailSegments } from './railingGeometry.js';

export function calcStair({ height, run, width, steps, railingEnabled, handrailHeight, postSpacing, railingRunMode = 'matchStair', manualRailingRun }) {
  const riserHeight = steps > 0 ? height / steps : 0;
  const treadDepth = steps > 0 ? run / steps : 0;
  const angleRad = Math.atan2(height, run);
  const angleDeg = (angleRad * 180) / Math.PI;
  const stringerLength = Math.sqrt(height * height + run * run);

  // Railing run: either mirrors stair or manual override. Does not affect treads.
  const railingRun = railingRunMode === 'manual' && manualRailingRun > 0 ? manualRailingRun : run;
  // When run is < 1" the stair is pathological; use railingRun directly to avoid runaway ratios.
  const railingStringerLength = run >= 1
    ? (railingRun / run) * stringerLength
    : railingRun;

  const effectiveSpacing = postSpacing > 0 ? postSpacing : 48;
  const MAX_POST_COUNT = 100;
  let postCount = 0;
  let handrailLength = 0;
  let rawPostCount = 0;
  let postCountCapped = false;

  if (railingEnabled) {
    rawPostCount = Math.ceil(railingStringerLength / effectiveSpacing) + 1;
    postCountCapped = rawPostCount > MAX_POST_COUNT;
    postCount = Math.min(MAX_POST_COUNT, rawPostCount);
    handrailLength = railingStringerLength;
  }

  // Tread centers in inches — x is horizontal center, y is top surface, origin at stair bottom-start
  const treadPositions = [];
  for (let i = 0; i < steps; i++) {
    treadPositions.push({ x: (i + 0.5) * treadDepth, y: (i + 1) * riserHeight, step: i });
  }

  // Post positions along railingRun; y follows the same stair slope.
  // Clamp slope to 0 when run < 1" to prevent coordinate explosion on pathological inputs.
  const slope = run >= 1 ? height / run : 0;
  const postStations = [];
  if (railingEnabled && postCount > 0) {
    for (let i = 0; i < postCount; i++) {
      const t = i / Math.max(postCount - 1, 1);
      postStations.push({ t, x: t * railingRun, y: t * railingRun * slope });
    }
  }

  const railingEndHeight = railingRun * slope;
  const railEndpoints = railingEnabled
    ? { start: { x: 0, y: handrailHeight }, end: { x: railingRun, y: railingEndHeight + handrailHeight } }
    : null;

  // Key geometry endpoints in inches for dimension annotations (origin at stair bottom-start)
  const dimensionEndpoints = {
    rise:  { x: 0,   y1: 0,                    y2: height },
    run:   { y: 0,   x1: 0,                    x2: run },
    width: { z1: -width / 2,                   z2: width / 2 },
    riser: { x: run, y1: height - riserHeight, y2: height },
    tread: { y: height - riserHeight, x1: run - treadDepth, x2: run },
    ...(railingEnabled && {
      railH:  { x: 0, y1: height, y2: height + handrailHeight },
      postSp: { y: 0, x1: 0,     x2: Math.min(effectiveSpacing, railingRun) },
    }),
  };

  return {
    // Existing fields — unchanged
    riserHeight,
    treadDepth,
    angleDeg,
    stringerLength,
    postCount,
    handrailLength,
    // Shared geometry fields — all values in inches
    totalHeight: height,
    totalRun: run,
    width,
    steps,
    treadPositions,
    postStations,
    railEndpoints,
    dimensionEndpoints,
    railingRun,
    railingStringerLength,
    // Safe railing geometry (slope=0 when run<1 to prevent explosion)
    railingEndY: railingEndHeight,
    railingSlope: slope,
    // Post count capping info for warnings
    rawPostCount,
    postCountCapped,
    maxPostCount: MAX_POST_COUNT,
  };
}

export function buildMaterialList({ width, steps, stringerLength, railingEnabled, handrailHeight, tubeSize, manualPosts = [], manualTopRails = [], treadPositions = [], riserHeight = 0, run = 0, bottomLandingEnabled = false, bottomLandingLength = 36, topLandingEnabled = false, topLandingLength = 36, bottomRailEnabled = false, bottomRailHeight = 1, middleRailEnabled = false, middleRailHeights = [], middleRailHeight }) {
  const items = [];

  if (bottomLandingEnabled) {
    items.push({ part: 'Bottom Landing', qty: 1, lengthIn: bottomLandingLength.toFixed(2), profile: 'Flat Platform', note: `${width.toFixed(0)}" wide` });
  }
  if (topLandingEnabled) {
    items.push({ part: 'Top Landing', qty: 1, lengthIn: topLandingLength.toFixed(2), profile: 'Flat Platform', note: `${width.toFixed(0)}" wide` });
  }
  items.push({ part: 'Side Stringer', qty: 2, lengthIn: stringerLength.toFixed(2), profile: `Square Tube ${tubeSize}`, note: 'Each side' });
  const treadQty = topLandingEnabled && steps > 0 ? steps - 1 : steps;
  items.push({ part: 'Tread', qty: treadQty, lengthIn: width.toFixed(2), profile: `Square Tube ${tubeSize}`, note: 'Horizontal tread span' });

  if (manualPosts.length > 0) {
    const maxH = manualPosts.reduce((m, p) => Math.max(m, Number(p.heightIn) || 0), 0);
    items.push({ part: 'Manual Post', qty: manualPosts.length, lengthIn: maxH.toFixed(2), profile: `Square Tube ${tubeSize}`, note: 'Manually placed' });
  }

  if (manualTopRails.length > 0) {
    const segments = getManualRailSegments(manualTopRails, manualPosts, treadPositions, riserHeight, run);
    if (segments.length > 0) {
      const totalLen = segments.reduce((s, seg) => s + seg.lengthIn, 0);
      items.push({ part: 'Top Rail', qty: segments.length, lengthIn: totalLen.toFixed(2), profile: '2x1 Rect Tube', note: 'Total length' });
    }
  }

  if (bottomRailEnabled && manualTopRails.length > 0) {
    const segments = getManualBottomRailSegments(manualTopRails, manualPosts, treadPositions, riserHeight, run, bottomRailHeight);
    if (segments.length > 0) {
      const totalLen = segments.reduce((s, seg) => s + seg.lengthIn, 0);
      items.push({ part: 'Bottom Rail', qty: segments.length, lengthIn: totalLen.toFixed(2), profile: '2x1 Rect Tube', note: 'Total length' });
    }
  }

  if (middleRailEnabled && manualTopRails.length > 0) {
    const effectiveMiddleRailHeights = (Array.isArray(middleRailHeights) && middleRailHeights.length > 0)
      ? middleRailHeights
      : (middleRailHeight != null ? [middleRailHeight] : []);
    if (effectiveMiddleRailHeights.length > 0) {
      const allSegments = effectiveMiddleRailHeights.flatMap(h =>
        getManualMiddleRailSegments(manualTopRails, manualPosts, treadPositions, riserHeight, run, h)
      );
      if (allSegments.length > 0) {
        const totalLen = allSegments.reduce((s, seg) => s + seg.lengthIn, 0);
        items.push({ part: 'Middle Rail', qty: allSegments.length, lengthIn: totalLen.toFixed(2), profile: '1x1 Rect Tube', note: 'Total length' });
      }
    }
  }

  return items;
}
