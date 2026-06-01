export function calcStair({ height, run, width, steps, railingEnabled, handrailHeight, postSpacing, pinOpening }) {
  const riserHeight = steps > 0 ? height / steps : 0;
  const treadDepth = steps > 0 ? run / steps : 0;
  const angleRad = Math.atan2(height, run);
  const angleDeg = (angleRad * 180) / Math.PI;
  const stringerLength = Math.sqrt(height * height + run * run);

  const effectiveSpacing = postSpacing > 0 ? postSpacing : 48;
  let postCount = 0;
  let handrailLength = 0;

  if (railingEnabled) {
    postCount = Math.ceil(stringerLength / effectiveSpacing) + 1;
    handrailLength = stringerLength;
  }

  // Tread centers in inches — x is horizontal center, y is top surface, origin at stair bottom-start
  const treadPositions = [];
  for (let i = 0; i < steps; i++) {
    treadPositions.push({ x: (i + 0.5) * treadDepth, y: (i + 1) * riserHeight, step: i });
  }

  // Post positions in inches along the stringer, t ∈ [0, 1] from bottom to top
  const postStations = [];
  if (railingEnabled && postCount > 0) {
    for (let i = 0; i < postCount; i++) {
      const t = i / Math.max(postCount - 1, 1);
      postStations.push({ t, x: t * run, y: t * height });
    }
  }

  const railEndpoints = railingEnabled
    ? { start: { x: 0, y: handrailHeight }, end: { x: run, y: height + handrailHeight } }
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
      postSp: { y: 0, x1: 0,     x2: Math.min(effectiveSpacing, run) },
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
  };
}

export function buildMaterialList({ height, run, width, steps, stringerLength, postCount, handrailLength, railingEnabled, handrailHeight, tubeSize }) {
  const items = [];

  items.push({ part: 'Side Stringer', qty: 2, lengthIn: stringerLength.toFixed(2), profile: `Square Tube ${tubeSize}`, note: 'Each side' });
  items.push({ part: 'Tread', qty: steps, lengthIn: width.toFixed(2), profile: `Square Tube ${tubeSize}`, note: 'Horizontal tread span' });

  if (railingEnabled && postCount > 0) {
    items.push({ part: 'Railing Post', qty: postCount, lengthIn: handrailHeight.toFixed(2), profile: `Square Tube ${tubeSize}`, note: 'Vertical posts' });
    items.push({ part: 'Handrail', qty: 1, lengthIn: handrailLength.toFixed(2), profile: `Square Tube ${tubeSize}`, note: 'Top rail, stringer length' });
  }

  return items;
}
