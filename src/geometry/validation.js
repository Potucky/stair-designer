export function validateStair({ angleDeg, riserHeight, treadDepth, width, steps, handrailHeight, pinOpening, railingEnabled }) {
  const warnings = [];

  if (steps < 2) {
    warnings.push({ level: 'error', msg: 'Invalid step count. Minimum 2 steps required.' });
  }

  if (angleDeg > 40) {
    warnings.push({ level: 'warning', msg: `Stair angle ${angleDeg.toFixed(1)}° is steep. Common maximum is 40°.` });
  } else if (angleDeg < 25 && angleDeg > 0) {
    warnings.push({ level: 'warning', msg: `Stair angle ${angleDeg.toFixed(1)}° is shallow. Common minimum is 25°.` });
  }

  if (riserHeight > 7.75) {
    warnings.push({ level: 'error', msg: `Riser height ${riserHeight.toFixed(3)}" exceeds residential maximum of 7¾".` });
  }

  if (treadDepth < 10 && steps >= 2) {
    warnings.push({ level: 'error', msg: `Tread depth ${treadDepth.toFixed(3)}" is below residential minimum of 10".` });
  }

  if (width < 36) {
    warnings.push({ level: 'warning', msg: `Stair width ${width}" is below typical residential minimum of 36".` });
  }

  if (railingEnabled) {
    if (handrailHeight < 34) {
      warnings.push({ level: 'error', msg: `Handrail height ${handrailHeight}" is below minimum of 34".` });
    } else if (handrailHeight > 38) {
      warnings.push({ level: 'error', msg: `Handrail height ${handrailHeight}" exceeds maximum of 38".` });
    }

    if (pinOpening > 4) {
      warnings.push({ level: 'error', msg: `Guard/pin opening ${pinOpening}" exceeds 4" sphere rule.` });
    } else if (pinOpening > 3.875) {
      warnings.push({ level: 'warning', msg: `Pin opening ${pinOpening}" exceeds shop target of 3⅞". Stay at or below 3.875" for safety margin.` });
    }

    if (steps >= 4) {
      // handrail present — no warning needed
    }
  } else if (steps >= 4) {
    warnings.push({ level: 'warning', msg: 'Handrail required on at least one side for flights with 4 or more risers (FBC Residential).' });
  }

  warnings.push({
    level: 'info',
    msg: 'Fabrication helper only. Verify all field measurements, local code requirements, and structural requirements before building.',
  });

  return warnings;
}
