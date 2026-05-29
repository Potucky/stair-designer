export function calcStair({ height, run, width, steps, railingEnabled, handrailHeight, postSpacing, pinOpening }) {
  const riserHeight = steps > 0 ? height / steps : 0;
  const treadDepth = steps > 0 ? run / steps : 0;
  const angleRad = Math.atan2(height, run);
  const angleDeg = (angleRad * 180) / Math.PI;
  const stringerLength = Math.sqrt(height * height + run * run);

  let postCount = 0;
  let handrailLength = 0;

  if (railingEnabled) {
    const spacing = postSpacing > 0 ? postSpacing : 48;
    postCount = Math.ceil(stringerLength / spacing) + 1;
    handrailLength = stringerLength;
  }

  return {
    riserHeight,
    treadDepth,
    angleDeg,
    stringerLength,
    postCount,
    handrailLength,
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
