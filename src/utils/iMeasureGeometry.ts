export type IMeasurePoint2D = {
  xIn: number;
  yIn: number;
};

export type IMeasureLevelKind = "bottomLanding" | "step" | "topLanding";

export type IMeasureLevelPoint = {
  levelIndex: number;
  kind: IMeasureLevelKind;
  xIn: number;
  yIn: number;
};

export type IMeasureGeometryInput = {
  quantityStep: number;
  post1LevelIndex: number;
  post2LevelIndex: number;
  postCenterDistanceIn: number;
  angleDeg: number;
  bcLowIn: number;
  bcHighIn: number;
  bottomChannelClearanceIn?: number;
  stepWidthIn?: number;
  handrailHeightIn?: number;
};

export type IMeasureGeometryResult = {
  valid: boolean;
  reason?: string;

  quantityStep: number;
  post1LevelIndex: number;
  post2LevelIndex: number;
  spanIntervals: number;

  angleDeg: number;
  postCenterDistanceIn: number;

  horizontalProjectionIn: number;
  verticalProjectionIn: number;

  runPerIntervalIn: number;
  risePerIntervalIn: number;

  bottomChannelClearanceIn: number;

  bottomChannelLowerStart: IMeasurePoint2D;
  bottomChannelLowerEnd: IMeasurePoint2D;

  channelDirection: IMeasurePoint2D;
  stairSideNormal: IMeasurePoint2D;

  nosingReferenceStart: IMeasurePoint2D;
  nosingReferenceEnd: IMeasurePoint2D;

  levels: IMeasureLevelPoint[];
};

// ---- private helpers ----

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function isFiniteNumber(v: number): boolean {
  return typeof v === "number" && isFinite(v);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeVector(v: IMeasurePoint2D): IMeasurePoint2D {
  const len = Math.sqrt(v.xIn * v.xIn + v.yIn * v.yIn);
  if (len === 0) return { xIn: 0, yIn: 0 };
  return { xIn: v.xIn / len, yIn: v.yIn / len };
}

// Returns a perpendicular vector (rotated 90° CCW).
function perpendicularVector(v: IMeasurePoint2D): IMeasurePoint2D {
  return { xIn: -v.yIn, yIn: v.xIn };
}

// Chooses whichever of the two perpendicular directions has negative yIn
// (pointing downward in side-view), so the clearance offset goes toward stairs.
function chooseDownwardNormal(v: IMeasurePoint2D): IMeasurePoint2D {
  const perp = perpendicularVector(v);
  // If perp already points downward (yIn < 0) use it; otherwise negate.
  return perp.yIn <= 0 ? perp : { xIn: -perp.xIn, yIn: -perp.yIn };
}

// ---- public API ----

export function calculateIMeasureGeometry(
  input: IMeasureGeometryInput
): IMeasureGeometryResult {
  const invalidResult = (reason: string): IMeasureGeometryResult => ({
    valid: false,
    reason,
    quantityStep: input.quantityStep,
    post1LevelIndex: input.post1LevelIndex,
    post2LevelIndex: input.post2LevelIndex,
    spanIntervals: 0,
    angleDeg: input.angleDeg,
    postCenterDistanceIn: input.postCenterDistanceIn,
    horizontalProjectionIn: 0,
    verticalProjectionIn: 0,
    runPerIntervalIn: 0,
    risePerIntervalIn: 0,
    bottomChannelClearanceIn: input.bottomChannelClearanceIn ?? 1,
    bottomChannelLowerStart: { xIn: 0, yIn: 0 },
    bottomChannelLowerEnd: { xIn: 0, yIn: 0 },
    channelDirection: { xIn: 0, yIn: 0 },
    stairSideNormal: { xIn: 0, yIn: 0 },
    nosingReferenceStart: { xIn: 0, yIn: 0 },
    nosingReferenceEnd: { xIn: 0, yIn: 0 },
    levels: [],
  });

  const {
    quantityStep,
    postCenterDistanceIn,
    angleDeg,
    bcLowIn,
    bcHighIn,
  } = input;

  const bottomChannelClearanceIn = input.bottomChannelClearanceIn ?? 1;

  if (!Number.isInteger(quantityStep) || quantityStep < 1) {
    return invalidResult("quantityStep must be an integer >= 1");
  }

  if (!isFiniteNumber(postCenterDistanceIn) || postCenterDistanceIn <= 0) {
    return invalidResult("postCenterDistanceIn must be a positive finite number");
  }

  if (!isFiniteNumber(angleDeg)) {
    return invalidResult("angleDeg must be a finite number");
  }

  if (!isFiniteNumber(bcLowIn)) {
    return invalidResult("bcLowIn must be a finite number");
  }

  if (!isFiniteNumber(bcHighIn)) {
    return invalidResult("bcHighIn must be a finite number");
  }

  const post1LevelIndex = clamp(
    Math.round(input.post1LevelIndex),
    0,
    quantityStep
  );
  const post2LevelIndex = clamp(
    Math.round(input.post2LevelIndex),
    0,
    quantityStep
  );

  const spanIntervals = Math.abs(post2LevelIndex - post1LevelIndex);

  if (spanIntervals <= 0) {
    return invalidResult(
      "post1LevelIndex and post2LevelIndex must not be the same level"
    );
  }

  const rad = degToRad(angleDeg);
  const horizontalProjectionIn = postCenterDistanceIn * Math.cos(rad);
  const verticalProjectionIn = postCenterDistanceIn * Math.sin(rad);

  const runPerIntervalIn = horizontalProjectionIn / spanIntervals;
  const risePerIntervalIn = verticalProjectionIn / spanIntervals;

  // Bottom Channel lower edge in 2D side-view (xIn = run, yIn = height).
  // bcLowIn and bcHighIn are local offsets from their respective post bases.
  // Post 1 base is at y=0; post 2 base is at y=verticalProjectionIn.
  const bottomChannelLowerStart: IMeasurePoint2D = { xIn: 0, yIn: bcLowIn };
  const bottomChannelLowerEnd: IMeasurePoint2D = {
    xIn: horizontalProjectionIn,
    yIn: verticalProjectionIn + bcHighIn,
  };

  // Direction along the bottom channel lower edge, normalized.
  const rawDirection: IMeasurePoint2D = {
    xIn: bottomChannelLowerEnd.xIn - bottomChannelLowerStart.xIn,
    yIn: bottomChannelLowerEnd.yIn - bottomChannelLowerStart.yIn,
  };
  const channelDirection = normalizeVector(rawDirection);

  // Perpendicular normal pointing toward the stairs (downward in side-view).
  // Clearance is the shortest distance from the channel lower edge to the nosing,
  // measured perpendicular to the channel — NOT vertically.
  const stairSideNormal = chooseDownwardNormal(channelDirection);

  const nosingReferenceStart: IMeasurePoint2D = {
    xIn: bottomChannelLowerStart.xIn + stairSideNormal.xIn * bottomChannelClearanceIn,
    yIn: bottomChannelLowerStart.yIn + stairSideNormal.yIn * bottomChannelClearanceIn,
  };
  const nosingReferenceEnd: IMeasurePoint2D = {
    xIn: bottomChannelLowerEnd.xIn + stairSideNormal.xIn * bottomChannelClearanceIn,
    yIn: bottomChannelLowerEnd.yIn + stairSideNormal.yIn * bottomChannelClearanceIn,
  };

  // Generate one level point per level index 0..quantityStep.
  const levels: IMeasureLevelPoint[] = [];
  for (let levelIndex = 0; levelIndex <= quantityStep; levelIndex++) {
    const t = levelIndex / quantityStep;
    const xIn =
      nosingReferenceStart.xIn +
      (nosingReferenceEnd.xIn - nosingReferenceStart.xIn) * t;
    const yIn =
      nosingReferenceStart.yIn +
      (nosingReferenceEnd.yIn - nosingReferenceStart.yIn) * t;

    let kind: IMeasureLevelKind;
    if (levelIndex === 0) {
      kind = "bottomLanding";
    } else if (levelIndex === quantityStep) {
      kind = "topLanding";
    } else {
      kind = "step";
    }

    levels.push({ levelIndex, kind, xIn, yIn });
  }

  return {
    valid: true,
    quantityStep,
    post1LevelIndex,
    post2LevelIndex,
    spanIntervals,
    angleDeg,
    postCenterDistanceIn,
    horizontalProjectionIn,
    verticalProjectionIn,
    runPerIntervalIn,
    risePerIntervalIn,
    bottomChannelClearanceIn,
    bottomChannelLowerStart,
    bottomChannelLowerEnd,
    channelDirection,
    stairSideNormal,
    nosingReferenceStart,
    nosingReferenceEnd,
    levels,
  };
}
