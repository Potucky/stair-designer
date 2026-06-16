import { formatDimensionByUnit } from '../utils/units.js';

function fmtV(val, units) {
  if (units === 'mm') return `${(val * 25.4).toFixed(1)} mm`;
  return `${formatDimensionByUnit(val, units)}"`;
}

export function validateStair({ angleDeg, riserHeight, treadDepth, width, steps, handrailHeight, pinOpening, railingEnabled, railingRunMode, manualRailingRun, run, rawPostCount, postCountCapped, maxPostCount = 100, units = 'in8' }) {
  const warnings = [];

  if (steps < 1) {
    warnings.push({ level: 'error', msg: 'Invalid step count. Minimum 1 step required.' });
  }

  if (run > 0 && run < 1) {
    warnings.push({ level: 'warning', msg: `Total Run ${fmtV(run, units)} is extremely small (< 1"). Railing geometry uses a safe flat approximation.` });
  }

  if (angleDeg > 40) {
    warnings.push({ level: 'warning', msg: `Stair angle ${angleDeg.toFixed(1)}° is steep. Common maximum is 40°.` });
  } else if (angleDeg < 25 && angleDeg > 0) {
    warnings.push({ level: 'warning', msg: `Stair angle ${angleDeg.toFixed(1)}° is shallow. Common minimum is 25°.` });
  }

  if (riserHeight > 7.75) {
    warnings.push({ level: 'error', msg: `Riser height ${fmtV(riserHeight, units)} exceeds residential maximum of 7¾".` });
  }

  if (treadDepth < 10 && steps >= 2) {
    warnings.push({ level: 'error', msg: `Tread depth ${fmtV(treadDepth, units)} is below residential minimum of 10".` });
  }

  if (width < 36) {
    warnings.push({ level: 'warning', msg: `Stair width ${fmtV(width, units)} is below typical residential minimum of 36".` });
  }

  if (railingEnabled && railingRunMode === 'manual' && manualRailingRun > 0 && run > 0) {
    if (manualRailingRun < run) {
      warnings.push({ level: 'warning', msg: `Manual railing run ${fmtV(manualRailingRun, units)} is shorter than stair run ${fmtV(run, units)}. Railing will not cover the full stair.` });
    } else if (manualRailingRun > run * 2) {
      warnings.push({ level: 'warning', msg: `Manual railing run ${fmtV(manualRailingRun, units)} is very large compared to stair run ${fmtV(run, units)}.` });
    }
  }

  if (railingEnabled) {
    if (handrailHeight < 34) {
      warnings.push({ level: 'error', msg: `Handrail height ${fmtV(handrailHeight, units)} is below minimum of 34".` });
    } else if (handrailHeight > 38) {
      warnings.push({ level: 'error', msg: `Handrail height ${fmtV(handrailHeight, units)} exceeds maximum of 38".` });
    }

    if (pinOpening > 4) {
      warnings.push({ level: 'error', msg: `Guard/pin opening ${fmtV(pinOpening, units)} exceeds 4" sphere rule.` });
    } else if (pinOpening > 3.875) {
      warnings.push({ level: 'warning', msg: `Pin opening ${fmtV(pinOpening, units)} exceeds shop target of 3⅞". Stay at or below 3.875" for safety margin.` });
    }

    if (postCountCapped && rawPostCount != null) {
      warnings.push({ level: 'warning', msg: `Post count capped at ${maxPostCount} (calculated: ${rawPostCount}). Verify post spacing for very long railing runs.` });
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
