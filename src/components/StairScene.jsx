import { useEffect, useLayoutEffect, useRef, useMemo, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { fmtUnit } from '../utils/format.js';
import { getTubeProfile, getManualPostBase, getManualPostTop, resolveTopRailSegments, getManualBottomRailSegments, getManualMiddleRailSegments, calcInfillCount, resolveManualPostSection, isLegacyCompactDuplicateRail, resolveCompactPostAnchors, INtoU as INtoU_GEO } from '../geometry/railingGeometry.js';

// Stair center Y in scene units for default config: 108in * 0.5 (INtoU) / 2 = 27
const SCENE_CENTER_Y = 27;

// Parse "W x H" section string (e.g. "2 x 2") into {w, h} in inches.
// Falls back to defaultW / defaultH when the string is absent or unparseable.
function parseSectionIn(section, defaultW, defaultH) {
  if (section) {
    const parts = String(section).split(/\s*[xX]\s*/).map(s => parseFloat(s.trim()));
    if (parts.length === 2 && parts.every(n => Number.isFinite(n) && n > 0)) {
      return { w: parts[0], h: parts[1] };
    }
  }
  return { w: defaultW, h: defaultH };
}

// Parse cable size fraction string (e.g. "1/8") into decimal inches. Falls back to 0.125.
function parseCableDiameterIn(cableSize) {
  if (cableSize) {
    const parts = String(cableSize).split('/').map(s => parseFloat(s.trim()));
    if (parts.length === 2 && parts.every(n => Number.isFinite(n) && n > 0)) return parts[0] / parts[1];
    const val = parseFloat(cableSize);
    if (Number.isFinite(val) && val > 0) return val;
  }
  return 0.125;
}

// Visual tread thickness in scene units (shared by StairModel and ManualPostsRenderer)
const TREAD_THICK = 0.3;

function CanvasCaptureHelper({ captureRef }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    if (captureRef) captureRef.current = () => {
      const origBg = scene.background;
      scene.background = new THREE.Color('#ffffff');
      gl.render(scene, camera);
      const dataUrl = gl.domElement.toDataURL('image/png');
      scene.background = origBg;
      return dataUrl;
    };
    return () => { if (captureRef) captureRef.current = null; };
  }, [gl, scene, camera, captureRef]);
  return null;
}

function KeyboardNudge({ controlsRef }) {
  const { camera } = useThree();

  useEffect(() => {
    const onKey = (e) => {
      const ctrl = controlsRef.current;
      if (!ctrl) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const dist = camera.position.distanceTo(ctrl.target);
      const step = dist * 0.04;

      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());

      let delta;
      if (e.key === 'ArrowLeft')       delta = right.multiplyScalar(-step);
      else if (e.key === 'ArrowRight') delta = right.multiplyScalar(step);
      else if (e.key === 'ArrowUp')    delta = up.multiplyScalar(step);
      else if (e.key === 'ArrowDown')  delta = up.multiplyScalar(-step);
      else return;

      e.preventDefault();
      camera.position.add(delta);
      ctrl.target.add(delta);
      ctrl.update();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [camera, controlsRef]);

  return null;
}

function CameraController({ view, viewResetToken, controlsRef, height, run, width }) {
  const { camera } = useThree();
  // Refs so dims are read at reset time without triggering extra resets on every config edit
  const heightRef = useRef(height);
  const runRef = useRef(run);
  const widthRef = useRef(width);
  useLayoutEffect(() => {
    heightRef.current = height;
    runRef.current = run;
    widthRef.current = width;
  }, [height, run, width]);

  useEffect(() => {
    const INtoU = 0.5;
    let targetY = SCENE_CENTER_Y;
    if (view === 'top') {
      camera.position.set(0, 150, 0.01);
      camera.up.set(0, 0, -1);
    } else if (view === 'side') {
      camera.position.set(160, SCENE_CENTER_Y, 0);
      camera.up.set(0, 1, 0);
    } else {
      // Construction isometric: ~35° elevation above stair, front-left angle
      const h = heightRef.current * INtoU;
      const r = runRef.current * INtoU;
      const dist = Math.max(r, h, 50);
      targetY = h / 2;
      camera.position.set(r * 0.5, h / 2 + dist * 1.4, dist * 2.0);
      camera.up.set(0, 1, 0);
    }
    camera.lookAt(0, targetY, 0);
    const ctrl = controlsRef.current;
    if (ctrl) {
      ctrl.target.set(0, targetY, 0);
      ctrl.update();
    }
    camera.updateProjectionMatrix();
  }, [view, viewResetToken, camera, controlsRef]);

  return null;
}

const MEASURE_COLOR = '#10b981';
const MEASURE_LABEL_STYLE = {
  background: 'rgba(5, 150, 105, 0.92)',
  color: '#f0fdf4',
  fontSize: '10px',
  fontFamily: 'ui-monospace, monospace',
  padding: '2px 6px',
  borderRadius: '3px',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  userSelect: 'none',
  letterSpacing: '0.02em',
};

const SHOW_INLINE_DIMS = false;
const DIM_COLOR = '#1e3a5f';
const EXT_COLOR = '#4a7fad';
const LABEL_STYLE = {
  background: 'rgba(30, 58, 92, 0.88)',
  color: '#e8f0fe',
  fontSize: '9px',
  fontFamily: 'ui-monospace, monospace',
  padding: '1px 4px',
  borderRadius: '2px',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  userSelect: 'none',
};

const S = 1.4;  // arrowhead length (scene units) — standard stair dims
const AW = S * 0.28; // arrowhead half-width — standard stair dims
const MANUAL_S = 2.5;  // arrowhead length for manual 3D dimensions
const MANUAL_AW = MANUAL_S * 0.32; // arrowhead half-width for manual 3D dimensions

function ArrowHead({ tip, wingA, wingB }) {
  const verts = useMemo(
    () => new Float32Array([...tip, ...wingA, ...wingB]),
    [tip, wingA, wingB]
  );
  return (
    <mesh userData={{ isDimMarker: true }}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={verts} count={3} itemSize={3} />
      </bufferGeometry>
      <meshBasicMaterial color={DIM_COLOR} side={THREE.DoubleSide} />
    </mesh>
  );
}

function VDim({ x, z, y1, y2, label }) {
  const lo = Math.min(y1, y2);
  const hi = Math.max(y1, y2);
  if (hi - lo < 2 * S + 0.5) return null;
  return (
    <>
      <Line points={[[x, lo + S, z], [x, hi - S, z]]} color={DIM_COLOR} lineWidth={1.5} />
      <ArrowHead tip={[x, lo, z]} wingA={[x - AW, lo + S, z]} wingB={[x + AW, lo + S, z]} />
      <ArrowHead tip={[x, hi, z]} wingA={[x - AW, hi - S, z]} wingB={[x + AW, hi - S, z]} />
      <Html position={[x, (lo + hi) / 2, z]} center>
        <div style={LABEL_STYLE}>{label}</div>
      </Html>
    </>
  );
}

function HDimX({ y, z, x1, x2, label }) {
  const lo = Math.min(x1, x2);
  const hi = Math.max(x1, x2);
  if (hi - lo < 2 * S + 0.5) return null;
  return (
    <>
      <Line points={[[lo + S, y, z], [hi - S, y, z]]} color={DIM_COLOR} lineWidth={1.5} />
      <ArrowHead tip={[lo, y, z]} wingA={[lo + S, y - AW, z]} wingB={[lo + S, y + AW, z]} />
      <ArrowHead tip={[hi, y, z]} wingA={[hi - S, y - AW, z]} wingB={[hi - S, y + AW, z]} />
      <Html position={[(lo + hi) / 2, y, z]} center>
        <div style={LABEL_STYLE}>{label}</div>
      </Html>
    </>
  );
}

function HDimZ({ x, y, z1, z2, label }) {
  const lo = Math.min(z1, z2);
  const hi = Math.max(z1, z2);
  if (hi - lo < 2 * S + 0.5) return null;
  return (
    <>
      <Line points={[[x, y, lo + S], [x, y, hi - S]]} color={DIM_COLOR} lineWidth={1.5} />
      <ArrowHead tip={[x, y, lo]} wingA={[x, y - AW, lo + S]} wingB={[x, y + AW, lo + S]} />
      <ArrowHead tip={[x, y, hi]} wingA={[x, y - AW, hi - S]} wingB={[x, y + AW, hi - S]} />
      <Html position={[x, y, (lo + hi) / 2]} center>
        <div style={LABEL_STYLE}>{label}</div>
      </Html>
    </>
  );
}

function ExtLine({ p1, p2 }) {
  return <Line points={[p1, p2]} color={EXT_COLOR} lineWidth={0.8} />;
}

function DimensionLabels({ stairConfig, calc, units }) {
  const INtoU = 0.5;
  const { height, run, width, railingEnabled, handrailHeight } = stairConfig;

  const h = height * INtoU;
  const r = run * INtoU;
  const w = width * INtoU;
  const riserH = calc.riserHeight * INtoU;
  const treadD = calc.treadDepth * INtoU;
  const railH = handrailHeight * INtoU;

  const riseX  = -r / 2 - 10;
  const runY   = -7;
  const widthX = r / 2 + 10;
  const riserX = r / 2 + 5;
  const treadY = h - riserH - 3;
  const railX  = -r / 2 - 20;

  return (
    <>
      {/* Total Rise */}
      <ExtLine p1={[-r / 2, 0, 0]} p2={[riseX, 0, 0]} />
      <ExtLine p1={[-r / 2, h, 0]} p2={[riseX, h, 0]} />
      <VDim x={riseX} z={0} y1={0} y2={h} label={`Rise: ${fmtUnit(height, units)}`} />

      {/* Total Run */}
      <ExtLine p1={[-r / 2, 0, 0]} p2={[-r / 2, runY, 0]} />
      <ExtLine p1={[r / 2, 0, 0]} p2={[r / 2, runY, 0]} />
      <HDimX y={runY} z={0} x1={-r / 2} x2={r / 2} label={`Run: ${fmtUnit(run, units)}`} />

      {/* Stair Width */}
      <ExtLine p1={[r / 2, h / 2, -w / 2]} p2={[widthX, h / 2, -w / 2]} />
      <ExtLine p1={[r / 2, h / 2, w / 2]} p2={[widthX, h / 2, w / 2]} />
      <HDimZ x={widthX} y={h / 2} z1={-w / 2} z2={w / 2} label={`W: ${fmtUnit(width, units)}`} />

      {/* Riser (last step) */}
      <VDim x={riserX} z={0} y1={h - riserH} y2={h} label={`Riser: ${fmtUnit(calc.riserHeight, units)}`} />

      {/* Tread (last step) */}
      <HDimX y={treadY} z={0} x1={r / 2 - treadD} x2={r / 2} label={`Tread: ${fmtUnit(calc.treadDepth, units)}`} />

      {/* Railing dims */}
      {railingEnabled && (
        <>
          <ExtLine p1={[-r / 2, h, 0]} p2={[railX, h, 0]} />
          <ExtLine p1={[-r / 2, h + railH, 0]} p2={[railX, h + railH, 0]} />
          <VDim x={railX} z={0} y1={h} y2={h + railH} label={`Rail H: ${fmtUnit(handrailHeight, units)}`} />
        </>
      )}
    </>
  );
}

function StairModel({ height, run, width, steps, handrailHeight, treadPositions, postPlacementMode, onAddManualPost, fastRailsMode, onFastRailsPost }) {
  const INtoU = 0.5;

  const h = height * INtoU;
  const r = run * INtoU;
  const w = width * INtoU;
  const riserH = steps > 0 ? h / steps : h;
  const treadD = steps > 0 ? r / steps : r;

  const treadMat = <meshStandardMaterial color="#64748b" metalness={0.4} roughness={0.5} />;

  const treads = treadPositions.map(({ x, y }, i) => {
    const tx = x * INtoU;
    const ty = y * INtoU;

    const handleTreadClick = (postPlacementMode || fastRailsMode) ? (e) => {
      e.stopPropagation();
      const normal = e.face?.normal;
      let mount = 'top';
      let side = 'center';
      let zIn = 0;

      // Detect side face: normal primarily in Z direction
      if (normal && Math.abs(normal.z) > Math.abs(normal.y) && Math.abs(normal.z) > Math.abs(normal.x)) {
        mount = 'side';
        side = normal.z > 0 ? 'right' : 'left';
        zIn = normal.z > 0 ? width / 2 : -(width / 2);
      }

      const postData = {
        stepIndex: i,
        mount,
        side,
        xIn: x,
        zIn,
        offsetXIn: 0,
        offsetZIn: 0,
        heightIn: handrailHeight,
      };
      if (fastRailsMode) {
        onFastRailsPost(postData);
      } else {
        onAddManualPost(postData);
      }
    } : undefined;

    return (
      <mesh
        key={i}
        position={[tx - r / 2, ty - riserH / 2 + TREAD_THICK / 2, 0]}
        onClick={handleTreadClick}
      >
        <boxGeometry args={[treadD, TREAD_THICK, w]} />
        {treadMat}
      </mesh>
    );
  });

  return (
    <group position={[0, 0, 0]}>
      {treads}
    </group>
  );
}

function BottomLanding({ run, width, bottomLandingLength, treadDepth, postPlacementMode, onAddManualPost, handrailHeight, fastRailsMode, onFastRailsPost }) {
  const INtoU = 0.5;
  const r = run * INtoU;
  const w = width * INtoU;
  const landLen = bottomLandingLength * INtoU;

  const handleClick = (postPlacementMode || fastRailsMode) ? (e) => {
    e.stopPropagation();
    const xIn = e.point.x / INtoU + run / 2;  // stair-relative inches (negative for bottom landing)
    if (xIn < -treadDepth || xIn > 0) return;
    const zIn = e.point.z / INtoU;
    const postData = {
      surfaceType: 'bottomLanding',
      mount: 'top',
      side: 'center',
      xIn,
      zIn,
      offsetXIn: 0,
      offsetZIn: 0,
      heightIn: handrailHeight,
    };
    if (fastRailsMode) onFastRailsPost(postData);
    else onAddManualPost(postData);
  } : undefined;

  return (
    <mesh position={[-r / 2 - landLen / 2, TREAD_THICK / 2, 0]} onClick={handleClick}>
      <boxGeometry args={[landLen, TREAD_THICK, w]} />
      <meshStandardMaterial color="#7c8da0" metalness={0.3} roughness={0.6} />
    </mesh>
  );
}

function TopLanding({ run, width, topLandingWidth, height, steps, topLandingLength, postPlacementMode, onAddManualPost, handrailHeight, treadPositions, fastRailsMode, onFastRailsPost }) {
  const INtoU = 0.5;
  const r = run * INtoU;
  const stairW = width * INtoU;
  const w = (topLandingWidth ?? width) * INtoU;
  const h = height * INtoU;
  const riserH = steps > 0 ? h / steps : h;
  const treadD = steps > 0 ? r / steps : 0;
  const treadDepth = steps > 0 ? run / steps : 0;
  const landLen = topLandingLength * INtoU;

  const hasTreads = treadPositions && treadPositions.length > 0;
  const handleClick = ((postPlacementMode || fastRailsMode) && hasTreads) ? (e) => {
    e.stopPropagation();
    const xIn = e.point.x / INtoU + run / 2;  // stair-relative inches; top landing stair-side edge is at run - treadDepth
    if (xIn < run - treadDepth || xIn > run) return;
    const zIn = e.point.z / INtoU;
    const postData = {
      surfaceType: 'topLanding',
      mount: 'top',
      side: 'center',
      xIn,
      zIn,
      offsetXIn: 0,
      offsetZIn: 0,
      heightIn: handrailHeight,
    };
    if (fastRailsMode) {
      onFastRailsPost(postData);
    } else {
      onAddManualPost(postData);
    }
  } : undefined;

  return (
    <mesh position={[r / 2 - treadD + landLen / 2, h - riserH / 2 + TREAD_THICK / 2, -stairW / 2 + w / 2]} onClick={handleClick}>
      <boxGeometry args={[landLen, TREAD_THICK, w]} />
      <meshStandardMaterial color="#7c8da0" metalness={0.3} roughness={0.6} />
    </mesh>
  );
}

// Renders manually placed posts from the manualPosts array.
function ManualPostsRenderer({ manualPosts, treadPositions, riserHeight, run, tubeSize, selectedManualPostId, onSelectManualPost, topRailMode, topRailFirstPostId, onTopRailPostClick, railingColorMode, fastRailsMode, fastRailsPrevPostId, onFastRailsPostSelect, isDims, post1Section, post2Section }) {
  const INtoU = 0.5;
  const profile = getTubeProfile(tubeSize);

  return (
    <>
      {manualPosts.map((post) => {
        const { id, heightIn } = post;
        const base = getManualPostBase(post, treadPositions, riserHeight, run);
        if (!base) return null;

        const postH = heightIn * INtoU;
        const worldX = base.x;
        const worldY = base.y + postH / 2;
        const worldZ = base.z;

        // Compact posts use live stairConfig section; regular posts use their stored section
        const resolvedSection =
          post.compactSlot === 'post1' ? (post1Section ?? post.section) :
          post.compactSlot === 'post2' ? (post2Section ?? post.section) :
          post.section;
        const { w: secW, h: secD } = parseSectionIn(resolvedSection, profile.width, profile.width);
        const postW = secW * INtoU;
        const postD = secD * INtoU;

        const basePostColor = railingColorMode === 'black' ? '#111111' : '#1a5fb4';
        let color = basePostColor;
        if (id === topRailFirstPostId) color = '#3b82f6';
        else if (fastRailsMode && id === fastRailsPrevPostId) color = '#22c55e';
        else if (id === selectedManualPostId) color = '#f59e0b';

        const handleClick = (e) => {
          e.stopPropagation();
          if (isDims) return;
          if (topRailMode) {
            onTopRailPostClick(id);
          } else if (fastRailsMode) {
            onFastRailsPostSelect(id);
          } else {
            onSelectManualPost(id);
          }
        };

        return (
          <mesh
            key={id}
            position={[worldX, worldY, worldZ]}
            onClick={handleClick}
          >
            <boxGeometry args={[postW, postH, postD]} />
            <meshStandardMaterial
              color={color}
              metalness={0.55}
              roughness={0.35}
            />
          </mesh>
        );
      })}
    </>
  );
}

// Renders top rail beams. Handles post-anchored, fixed/detached endpoints, and straight extensions.
function ManualTopRailsRenderer({ manualTopRails, manualPosts, treadPositions, riserHeight, run, railingColorMode, railLowerExtensionIn = 0, railUpperExtensionIn = 0, topRailPathMode = 'standard', handrailSection }) {
  const INtoU = 0.5;
  // Parse handrailSection ("W x H") — default to 2×1 to match previous hardcoded values
  const { w: railWIn, h: railHIn } = parseSectionIn(handrailSection, 2, 1);
  const RAIL_W = railWIn * INtoU;
  const RAIL_H = railHIn * INtoU;

  const segments = useMemo(() => resolveTopRailSegments(
    manualTopRails, manualPosts, treadPositions, riserHeight, run, railLowerExtensionIn, railUpperExtensionIn, topRailPathMode
  ), [topRailPathMode, manualTopRails, manualPosts, treadPositions, riserHeight, run, railLowerExtensionIn, railUpperExtensionIn]);

  return (
    <>
      {segments.map(({ segKey, start, end }) => {
        const startV = new THREE.Vector3(start.x, start.y, start.z);
        const endV = new THREE.Vector3(end.x, end.y, end.z);
        const length = startV.distanceTo(endV);
        if (length < 0.01) return null;

        const midV = startV.clone().lerp(endV, 0.5);
        // Perpendicular lift: bottom face seats on post tops with 0.25 in overlap to close slope gap
        const rDx = endV.x - startV.x, rDy = endV.y - startV.y, rDz = endV.z - startV.z;
        const rLen = Math.sqrt(rDx * rDx + rDy * rDy + rDz * rDz);
        const cosSlope = rLen > 0 ? Math.sqrt(rDx * rDx + rDz * rDz) / rLen : 1;
        midV.y += (RAIL_H / 2) * cosSlope - 0.125;
        const direction = endV.clone().sub(startV).normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction);

        return (
          <mesh key={segKey} position={midV.toArray()} quaternion={quat}>
            <boxGeometry args={[length, RAIL_H, RAIL_W]} />
            <meshStandardMaterial color={railingColorMode === 'black' ? '#111111' : '#e07820'} metalness={0.3} roughness={0.5} />
          </mesh>
        );
      })}
    </>
  );
}

function ManualBottomRailsRenderer({ manualTopRails, manualPosts, treadPositions, riserHeight, run, bottomRailHeight, railingColorMode, bottomChannelSection }) {
  const INtoU = 0.5;
  // Parse bottomChannelSection ("W x H") — default to 2×1 to match previous hardcoded values
  const { w: railWIn, h: railHIn } = parseSectionIn(bottomChannelSection, 2, 1);
  const RAIL_W = railWIn * INtoU;
  const RAIL_H = railHIn * INtoU;

  const segments = useMemo(
    () => getManualBottomRailSegments(manualTopRails, manualPosts, treadPositions, riserHeight, run, bottomRailHeight, 0, 0),
    [manualTopRails, manualPosts, treadPositions, riserHeight, run, bottomRailHeight]
  );

  return (
    <>
      {segments.map(({ rail, start, end }) => {
        const startV = new THREE.Vector3(start.x, start.y, start.z);
        const endV = new THREE.Vector3(end.x, end.y, end.z);
        const length = startV.distanceTo(endV);
        if (length < 0.01) return null;

        const midV = startV.clone().lerp(endV, 0.5);
        midV.y += RAIL_H / 2;
        const direction = endV.clone().sub(startV).normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction);

        return (
          <mesh key={`br-${rail.id}`} position={midV.toArray()} quaternion={quat}>
            <boxGeometry args={[length, RAIL_H, RAIL_W]} />
            <meshStandardMaterial color={railingColorMode === 'black' ? '#111111' : '#2a8a3a'} metalness={0.3} roughness={0.5} />
          </mesh>
        );
      })}
    </>
  );
}

function ManualMiddleRailsRenderer({ manualTopRails, manualPosts, treadPositions, riserHeight, run, middleRailHeights, railingColorMode }) {
  const INtoU = 0.5;
  const RAIL_W = 1 * INtoU;
  const RAIL_H = 1 * INtoU;

  const allSegments = useMemo(
    () => middleRailHeights.flatMap(h =>
      getManualMiddleRailSegments(manualTopRails, manualPosts, treadPositions, riserHeight, run, h, 0, 0).map(seg => ({ ...seg, height: h }))
    ),
    [manualTopRails, manualPosts, treadPositions, riserHeight, run, middleRailHeights]
  );

  return (
    <>
      {allSegments.map(({ rail, start, end, height }) => {
        const startV = new THREE.Vector3(start.x, start.y, start.z);
        const endV = new THREE.Vector3(end.x, end.y, end.z);
        const length = startV.distanceTo(endV);
        if (length < 0.01) return null;

        const midV = startV.clone().lerp(endV, 0.5);
        midV.y += RAIL_H / 2;
        const direction = endV.clone().sub(startV).normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction);

        return (
          <mesh key={`mr-${rail.id}-${height}`} position={midV.toArray()} quaternion={quat}>
            <boxGeometry args={[length, RAIL_H, RAIL_W]} />
            <meshStandardMaterial color={railingColorMode === 'black' ? '#111111' : '#2F7D7A'} metalness={0.3} roughness={0.5} />
          </mesh>
        );
      })}
    </>
  );
}

// Compact handrail: rectangular beam from Post 1 top to Post 2 top.
function CompactHandrailRenderer({ manualPosts, treadPositions, riserHeight, run, handrailSection, railingColorMode }) {
  const INtoU = 0.5;
  const { w: railWIn, h: railHIn } = parseSectionIn(handrailSection, 2, 1);
  const RAIL_W = railWIn * INtoU;
  const RAIL_H = railHIn * INtoU;

  const p1 = manualPosts.find(p => p.compactSlot === 'post1');
  const p2 = manualPosts.find(p => p.compactSlot === 'post2');
  if (!p1 || !p2) return null;

  const p1Top = getManualPostTop(p1, treadPositions, riserHeight, run);
  const p2Top = getManualPostTop(p2, treadPositions, riserHeight, run);
  if (!p1Top || !p2Top) return null;

  const startV = new THREE.Vector3(p1Top.x, p1Top.y, p1Top.z);
  const endV = new THREE.Vector3(p2Top.x, p2Top.y, p2Top.z);
  const length = startV.distanceTo(endV);
  if (length < 0.01) return null;

  const midV = startV.clone().lerp(endV, 0.5);
  const dx = endV.x - startV.x, dz = endV.z - startV.z;
  const cosSlope = length > 0 ? Math.sqrt(dx * dx + dz * dz) / length : 1;
  midV.y += (RAIL_H / 2) * cosSlope;
  const direction = endV.clone().sub(startV).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction);

  return (
    <mesh position={midV.toArray()} quaternion={quat}>
      <boxGeometry args={[length, RAIL_H, RAIL_W]} />
      <meshStandardMaterial color={railingColorMode === 'black' ? '#111111' : '#e07820'} metalness={0.3} roughness={0.5} />
    </mesh>
  );
}

// Compact U-channel (bottom channel): П-shaped, open on the bottom, between Post 1 and Post 2.
// Built from 3 rectangular pieces: top web + left wall + right wall. Wall thickness: 0.125 in (visual only).
function CompactBottomChannelRenderer({ manualPosts, treadPositions, riserHeight, run, bottomChannelSection, railingColorMode }) {
  const INtoU = 0.5;
  const { w: chanWIn, h: chanHIn } = parseSectionIn(bottomChannelSection, 2, 1);
  const chanW = chanWIn * INtoU;
  const chanH = chanHIn * INtoU;
  const wallT = 0.125 * INtoU; // 0.125 in visual wall thickness for 3D display

  const p1 = manualPosts.find(p => p.compactSlot === 'post1');
  const p2 = manualPosts.find(p => p.compactSlot === 'post2');
  if (!p1 || !p2) return null;

  const p1Base = getManualPostBase(p1, treadPositions, riserHeight, run);
  const p2Base = getManualPostBase(p2, treadPositions, riserHeight, run);
  if (!p1Base || !p2Base) return null;

  // Side offset: align channel center to post centerline.
  const chanCenterZ = p1Base.z;

  // Stair surface reference: use nosing-line Y at each post's actual X position.
  // For landing posts use the flat landing surface (p_Base.y from getManualPostBase)
  // instead of the nosing-slope formula, which would overshoot a flat landing.
  const r_u = run * INtoU;
  const rH_u = riserHeight * INtoU;
  const steps = treadPositions.length;
  const tD_u = steps > 0 ? (run / steps) * INtoU : 0;
  const nosingSlope = tD_u > 0 ? rH_u / tD_u : 0;
  const p1IsLanding = p1.surfaceType === 'bottomLanding' || p1.surfaceType === 'topLanding';
  const p2IsLanding = p2.surfaceType === 'bottomLanding' || p2.surfaceType === 'topLanding';
  const p1SurfaceY = p1IsLanding ? p1Base.y : (tD_u > 0 ? nosingSlope * (p1Base.x + r_u / 2) + 0.5 * rH_u + TREAD_THICK : p1Base.y);
  const p2SurfaceY = p2IsLanding ? p2Base.y : (tD_u > 0 ? nosingSlope * (p2Base.x + r_u / 2) + 0.5 * rH_u + TREAD_THICK : p2Base.y);

  // Channel center: 1.0 inch clearance above stair surface + half channel height.
  // This places the bottom lower edge exactly 1.0 inch above the stair tread corner reference line.
  const clearanceIn = 1.0;
  const p1CenterY = p1SurfaceY + (clearanceIn + chanHIn / 2) * INtoU;
  const p2CenterY = p2SurfaceY + (clearanceIn + chanHIn / 2) * INtoU;

  const startV = new THREE.Vector3(p1Base.x, p1CenterY, chanCenterZ);
  const endV = new THREE.Vector3(p2Base.x, p2CenterY, chanCenterZ);
  const length = startV.distanceTo(endV);
  if (length < 0.01) return null;

  const midV = startV.clone().lerp(endV, 0.5);
  const direction = endV.clone().sub(startV).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction);
  const color = railingColorMode === 'black' ? '#111111' : '#2a8a3a';

  // In beam-local frame: X = length, Y = up, Z = width. Channel opens at local -Y (downward).
  return (
    <group position={midV.toArray()} quaternion={quat}>
      {/* Top web: full width, sits at top of bounding box */}
      <mesh position={[0, chanH / 2 - wallT / 2, 0]}>
        <boxGeometry args={[length, wallT, chanW]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.5} />
      </mesh>
      {/* Left side wall: hangs from web to open bottom */}
      <mesh position={[0, -wallT / 2, -(chanW / 2 - wallT / 2)]}>
        <boxGeometry args={[length, chanH - wallT, wallT]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.5} />
      </mesh>
      {/* Right side wall: hangs from web to open bottom */}
      <mesh position={[0, -wallT / 2, chanW / 2 - wallT / 2]}>
        <boxGeometry args={[length, chanH - wallT, wallT]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.5} />
      </mesh>
    </group>
  );
}

// Renders vertical pickets or horizontal pickets/cables between Post 1 and Post 2.
// Count is derived automatically so every clear gap stays within 3 7/8" (3.875").
function InfillRenderer({ manualPosts, treadPositions, riserHeight, run, infillType, verticalPicketThicknessIn, verticalPicketDepthIn, horizontalPicketThicknessIn, horizontalPicketWidthIn, horizontalCableDiameterIn, bottomRailHeightIn, tubeSize, railingColorMode, compactTopHandrailEnabled = true, compactBottomChannelEnabled = true, post1Section, post2Section, handrailSection, bottomChannelSection }) {
  const INtoU = INtoU_GEO;

  const meshSpecs = useMemo(() => {
    if (!infillType || infillType === 'none') return [];
    if (!manualPosts || manualPosts.length < 2) return [];

    const p1 = manualPosts.find(p => p.compactSlot === 'post1');
    const p2 = manualPosts.find(p => p.compactSlot === 'post2');
    if (!p1 || !p2) return [];

    const p1Base = getManualPostBase(p1, treadPositions, riserHeight, run);
    const p2Base = getManualPostBase(p2, treadPositions, riserHeight, run);
    const p1Top = getManualPostTop(p1, treadPositions, riserHeight, run);
    const p2Top = getManualPostTop(p2, treadPositions, riserHeight, run);

    if (!p1Base || !p2Base || !p1Top || !p2Top) return [];

    const fallbackPostWidthIn = getTubeProfile(tubeSize).width;
    const post1WidthIn = parseSectionIn(post1Section, fallbackPostWidthIn, fallbackPostWidthIn).w;
    const post2WidthIn = parseSectionIn(post2Section, fallbackPostWidthIn, fallbackPostWidthIn).w;
    // Guard against undefined/NaN bottomRailHeightIn so geometry stays safe
    const safeBottomRailHeightIn = Number.isFinite(bottomRailHeightIn) && bottomRailHeightIn >= 0 ? bottomRailHeightIn : 1;

    // Span vector (scene units) from P1 base to P2 base
    const sdx = p2Base.x - p1Base.x;
    const sdy = p2Base.y - p1Base.y;
    const sdz = p2Base.z - p1Base.z;
    const spanScene = Math.sqrt(sdx * sdx + sdy * sdy + sdz * sdz);
    const spanIn = spanScene / INtoU;

    if (spanIn < 0.1) return [];

    // Y of bottom channel bottom face at each post.
    // When compact bottom channel is active, use nosing-line Y + 1.0 inch clearance so
    // the channel bottom lower edge stays 1.0 inch above the stair tread corner reference line
    // (mirrors the correction in CompactBottomChannelRenderer).
    // When inactive, fall back to legacy bottomRailHeightIn above post base.
    const r_u = run * INtoU;
    const rH_u = riserHeight * INtoU;
    const stepsCount = treadPositions.length;
    const tD_u = stepsCount > 0 ? (run / stepsCount) * INtoU : 0;
    let btmP1y, btmP2y;
    if (compactBottomChannelEnabled && tD_u > 0) {
      const nosingSlope = rH_u / tD_u;
      const btmP1IsLanding = p1.surfaceType === 'bottomLanding' || p1.surfaceType === 'topLanding';
      const btmP2IsLanding = p2.surfaceType === 'bottomLanding' || p2.surfaceType === 'topLanding';
      const p1SurfY = btmP1IsLanding ? p1Base.y : nosingSlope * (p1Base.x + r_u / 2) + 0.5 * rH_u + TREAD_THICK;
      const p2SurfY = btmP2IsLanding ? p2Base.y : nosingSlope * (p2Base.x + r_u / 2) + 0.5 * rH_u + TREAD_THICK;
      btmP1y = p1SurfY + 1.0 * INtoU;
      btmP2y = p2SurfY + 1.0 * INtoU;
    } else {
      btmP1y = p1Base.y + safeBottomRailHeightIn * INtoU;
      btmP2y = p2Base.y + safeBottomRailHeightIn * INtoU;
    }
    const topP1y = p1Top.y;
    const topP2y = p2Top.y;

    // Clamp picket depth to the narrower of handrail / channel envelope widths.
    const handrailEnvWIn = parseSectionIn(handrailSection, 2, 1).w;
    const chanEnvWIn = parseSectionIn(bottomChannelSection, 2, 1).w;
    const envelopeZIn = Math.min(
      compactTopHandrailEnabled ? handrailEnvWIn : Infinity,
      compactBottomChannelEnabled ? chanEnvWIn : Infinity
    );
    const effectiveVPicketDepthIn = Math.min(verticalPicketDepthIn, envelopeZIn);
    const effectiveHPicketWidthIn = Math.min(horizontalPicketWidthIn, envelopeZIn);

    const specs = [];

    if (infillType === 'vertical' || infillType === 'verticalPicket') {
      const thickIn = verticalPicketThicknessIn;
      const clearIn = spanIn - post1WidthIn / 2 - post2WidthIn / 2;
      const n = calcInfillCount(clearIn, thickIn);
      if (n <= 0) return [];

      const gapIn = (clearIn - n * thickIn) / (n + 1);
      const halfPostIn = post1WidthIn / 2;

      // Welding insertion depth: picket bottom penetrates the Bottom Channel by this amount.
      const BOTTOM_CHANNEL_PICKET_INSERTION_IN = 0.5;
      const btmInsertionU = compactBottomChannelEnabled ? BOTTOM_CHANNEL_PICKET_INSERTION_IN * INtoU : 0;

      // When compact bottom channel is active, align picket Z to post centerline.
      let picketZ = null;
      if (compactBottomChannelEnabled) {
        picketZ = p1Base.z;
      }

      const depthU = effectiveVPicketDepthIn * INtoU;
      const halfDepthU = depthU / 2;

      for (let i = 0; i < n; i++) {
        const distIn = halfPostIn + gapIn + i * (gapIn + thickIn) + thickIn / 2;
        // Normalized span positions of the two span-direction edges A (near) and B (far)
        const tA = (distIn - thickIn / 2) / spanIn;
        const tB = (distIn + thickIn / 2) / spanIn;
        const tc = distIn / spanIn;

        const pz = picketZ !== null ? picketZ : p1Base.z + tc * sdz;

        const xA = p1Base.x + tA * sdx;
        const xB = p1Base.x + tB * sdx;

        // Top Y: handrail underside at each edge — both edges must touch the slope
        const topYA = topP1y + tA * (topP2y - topP1y);
        const topYB = topP1y + tB * (topP2y - topP1y);

        // Bottom Y: channel bottom opening + insertion depth at each edge
        const btmYA = btmP1y + tA * (btmP2y - btmP1y) + btmInsertionU;
        const btmYB = btmP1y + tB * (btmP2y - btmP1y) + btmInsertionU;

        if (topYA - btmYA < 0.01 || topYB - btmYB < 0.01) continue;

        const zA = pz - halfDepthU;
        const zB = pz + halfDepthU;

        // 8 vertices of the sloped-cut prism in world space
        const verts = new Float32Array([
          xA, topYA, zA,   // 0 top-A-front
          xA, topYA, zB,   // 1 top-A-back
          xB, topYB, zA,   // 2 top-B-front
          xB, topYB, zB,   // 3 top-B-back
          xA, btmYA, zA,   // 4 bot-A-front
          xA, btmYA, zB,   // 5 bot-A-back
          xB, btmYB, zA,   // 6 bot-B-front
          xB, btmYB, zB,   // 7 bot-B-back
        ]);

        // 12 triangles (6 faces × 2): CCW winding from outside
        const idx = new Uint16Array([
          0, 1, 3,  0, 3, 2,   // top face
          4, 6, 7,  4, 7, 5,   // bottom face
          0, 4, 5,  0, 5, 1,   // side A
          2, 3, 7,  2, 7, 6,   // side B
          0, 2, 6,  0, 6, 4,   // front face
          1, 5, 7,  1, 7, 3,   // back face
        ]);

        specs.push({ kind: 'sloped-prism', key: `vp-${i}`, verts, idx });
      }

    } else if (infillType === 'horizontalPicket' || infillType === 'horizontalCable') {
      const thickIn = infillType === 'horizontalPicket' ? horizontalPicketThicknessIn : horizontalCableDiameterIn;
      // Lower boundary = top face of Bottom Channel (not its bottom face)
      const { h: chanHIn } = parseSectionIn(bottomChannelSection, 2, 1);
      const hPicketBtmP1y = btmP1y + chanHIn * INtoU;
      const hPicketBtmP2y = btmP2y + chanHIn * INtoU;
      // Free vertical opening between channel top face and handrail underside
      const openingIn = (topP1y - hPicketBtmP1y) / INtoU;
      const n = calcInfillCount(openingIn, thickIn);
      if (n <= 0) return [];

      const gapIn = (openingIn - n * thickIn) / (n + 1);

      // Normalized span positions of the post inside faces
      const tStart = (post1WidthIn / 2) / spanIn;
      const tEnd = 1 - (post2WidthIn / 2) / spanIn;

      // World-space X/Z endpoints at the post inside faces
      const hpSX = p1Base.x + tStart * sdx;
      const hpSZ = p1Base.z + tStart * sdz;
      const hpEX = p1Base.x + tEnd * sdx;
      const hpEZ = p1Base.z + tEnd * sdz;

      // Channel top and handrail underside Y interpolated to each endpoint
      const chanTopAtStart = hPicketBtmP1y + tStart * (hPicketBtmP2y - hPicketBtmP1y);
      const handrailBtmAtStart = topP1y + tStart * (topP2y - topP1y);
      const chanTopAtEnd = hPicketBtmP1y + tEnd * (hPicketBtmP2y - hPicketBtmP1y);
      const handrailBtmAtEnd = topP1y + tEnd * (topP2y - topP1y);

      for (let i = 0; i < n; i++) {
        const hvIn = gapIn + i * (gapIn + thickIn) + thickIn / 2;
        const tv = hvIn / openingIn;

        const sy = chanTopAtStart + tv * (handrailBtmAtStart - chanTopAtStart);
        const ey = chanTopAtEnd + tv * (handrailBtmAtEnd - chanTopAtEnd);

        if (infillType === 'horizontalPicket') {
          const halfThickU = (thickIn * INtoU) / 2;
          const halfDepthU = (effectiveHPicketWidthIn * INtoU) / 2;

          // 8-vertex mitered prism: start face at post1 inside face, end face at post2 inside face
          const verts = new Float32Array([
            // Start face (v0–v3) all at hpSX, hpSZ
            hpSX, sy + halfThickU, hpSZ - halfDepthU,  // v0: top-start-front
            hpSX, sy + halfThickU, hpSZ + halfDepthU,  // v1: top-start-back
            hpSX, sy - halfThickU, hpSZ - halfDepthU,  // v2: bot-start-front
            hpSX, sy - halfThickU, hpSZ + halfDepthU,  // v3: bot-start-back
            // End face (v4–v7) all at hpEX, hpEZ
            hpEX, ey + halfThickU, hpEZ - halfDepthU,  // v4: top-end-front
            hpEX, ey + halfThickU, hpEZ + halfDepthU,  // v5: top-end-back
            hpEX, ey - halfThickU, hpEZ - halfDepthU,  // v6: bot-end-front
            hpEX, ey - halfThickU, hpEZ + halfDepthU,  // v7: bot-end-back
          ]);

          const idx = new Uint16Array([
            // top face
            0, 4, 5,   0, 5, 1,
            // bottom face
            2, 3, 7,   2, 7, 6,
            // front face (z-front)
            0, 2, 6,   0, 6, 4,
            // back face (z-back)
            1, 5, 7,   1, 7, 3,
            // start face (post1 inside)
            0, 1, 3,   0, 3, 2,
            // end face (post2 inside)
            4, 6, 7,   4, 7, 5,
          ]);

          specs.push({ kind: 'h-miter-prism', key: `hp-${i}`, verts, idx });
        } else {
          // horizontalCable: keep as flat-ended box
          const seg = Math.sqrt((hpEX - hpSX) ** 2 + (ey - sy) ** 2 + (hpEZ - hpSZ) ** 2);
          if (seg < 0.01) continue;

          specs.push({
            kind: 'box',
            key: `hc-${i}`,
            x: (hpSX + hpEX) / 2, y: (sy + ey) / 2, z: (hpSZ + hpEZ) / 2,
            length: seg,
            height: thickIn * INtoU,
            depth: thickIn * INtoU,
            ux: (hpEX - hpSX) / seg,
            uy: (ey - sy) / seg,
            uz: (hpEZ - hpSZ) / seg,
          });
        }
      }
    }

    return specs;
  }, [manualPosts, treadPositions, riserHeight, run, infillType, verticalPicketThicknessIn, verticalPicketDepthIn, horizontalPicketThicknessIn, horizontalPicketWidthIn, horizontalCableDiameterIn, bottomRailHeightIn, tubeSize, INtoU, compactTopHandrailEnabled, compactBottomChannelEnabled, post1Section, post2Section, handrailSection, bottomChannelSection]);

  if (meshSpecs.length === 0) return null;

  const infillColor = (() => {
    if (railingColorMode === 'black') return '#111111';
    if (infillType === 'horizontalCable') return '#dc2626';
    if (infillType === 'horizontalPicket') return '#8b5cf6';
    return '#2F7D7A'; // verticalPicket / vertical
  })();

  return (
    <>
      {meshSpecs.map((s) => {
        if (s.kind === 'sloped-prism' || s.kind === 'h-miter-prism') {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(s.verts, 3));
          geo.setIndex(new THREE.BufferAttribute(s.idx, 1));
          geo.computeVertexNormals();
          return (
            <mesh key={s.key} geometry={geo}>
              <meshStandardMaterial
                color={infillColor}
                metalness={0.55}
                roughness={0.35}
                side={THREE.DoubleSide}
              />
            </mesh>
          );
        }
        const isAlignedY = s.ux === 0 && s.uz === 0;
        const quat = isAlignedY
          ? new THREE.Quaternion()
          : new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(1, 0, 0),
              new THREE.Vector3(s.ux, s.uy, s.uz)
            );
        return (
          <mesh key={s.key} position={[s.x, s.y, s.z]} quaternion={quat}>
            <boxGeometry args={[s.length, s.height, s.depth]} />
            <meshStandardMaterial
              color={infillColor}
              metalness={0.55}
              roughness={0.35}
            />
          </mesh>
        );
      })}
    </>
  );
}

function MeasureTool({ active, units }) {
  const [phase, setPhase] = useState('idle'); // 'idle' | 'placing'
  const [startPt, setStartPt] = useState(null);
  const [endPt, setEndPt] = useState(null);
  const [cursorPt, setCursorPt] = useState(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!active) {
      setPhase('idle');
      setStartPt(null);
      setEndPt(null);
      setCursorPt(null);
    }
  }, [active]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && active && phase === 'placing') {
        setPhase('idle');
        setStartPt(null);
        setCursorPt(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, phase]);

  const onMove = (e) => {
    e.stopPropagation();
    setCursorPt(e.point.clone());
  };

  const onLeave = (e) => {
    e.stopPropagation();
    setCursorPt(null);
  };

  const onDown = (e) => e.stopPropagation();

  const onClickPlane = (e) => {
    e.stopPropagation();
    if (phase === 'idle') {
      setStartPt(e.point.clone());
      setEndPt(null);
      setPhase('placing');
    } else {
      setEndPt(e.point.clone());
      setPhase('idle');
    }
  };

  const INtoU = 0.5;
  const dist = (a, b) => {
    if (!a || !b) return '';
    return fmtUnit(a.distanceTo(b) / INtoU, units);
  };

  const livePt = phase === 'placing' ? cursorPt : endPt;

  if (!active) return null;

  return (
    <>
      {/* Ground plane intercepts pointer events while measure is active */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        onPointerDown={onDown}
        onClick={onClickPlane}
      >
        <planeGeometry args={[5000, 5000]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Measurement line + markers */}
      {startPt && livePt && (
        <>
          <Line
            points={[startPt.toArray(), livePt.toArray()]}
            color={MEASURE_COLOR}
            lineWidth={phase === 'placing' ? 1.5 : 2}
          />
          {/* Start point */}
          <mesh position={startPt.toArray()}>
            <sphereGeometry args={[0.5, 10, 10]} />
            <meshBasicMaterial color={MEASURE_COLOR} />
          </mesh>
          {/* End / cursor point */}
          <mesh position={livePt.toArray()}>
            <sphereGeometry args={[0.5, 10, 10]} />
            <meshBasicMaterial color={MEASURE_COLOR} />
          </mesh>
          {/* Distance label at midpoint, slightly elevated */}
          <Html
            position={[
              (startPt.x + livePt.x) / 2,
              (startPt.y + livePt.y) / 2 + 2,
              (startPt.z + livePt.z) / 2,
            ]}
            center
          >
            <div style={MEASURE_LABEL_STYLE}>{dist(startPt, livePt)}</div>
          </Html>
        </>
      )}

      {/* Start marker shown after first click before mouse moves */}
      {startPt && !livePt && (
        <mesh position={startPt.toArray()}>
          <sphereGeometry args={[0.5, 10, 10]} />
          <meshBasicMaterial color={MEASURE_COLOR} />
        </mesh>
      )}

      {/* Cursor ring indicator */}
      {cursorPt && (
        <mesh position={cursorPt.toArray()} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.9, 16]} />
          <meshBasicMaterial color={MEASURE_COLOR} side={THREE.DoubleSide} transparent opacity={0.75} />
        </mesh>
      )}
    </>
  );
}

function PersistedDim({ dim }) {
  const INtoU = 0.5;
  const { camera, gl } = useThree();
  const labelRef = useRef(null);
  const geomRef = useRef(null);

  const geom = useMemo(() => {
    let aScene, bScene;
    if (dim.projection === 'side') {
      // Side/elevation view: project to Z=0 plane (XY)
      aScene = new THREE.Vector3(dim.a.xIn * INtoU, dim.a.yIn * INtoU, 0);
      bScene = new THREE.Vector3(dim.b.xIn * INtoU, dim.b.yIn * INtoU, 0);
    } else if (dim.projection === 'top') {
      // Top/plan view: project to Y=0 plane (XZ)
      aScene = new THREE.Vector3(dim.a.xIn * INtoU, 0, dim.a.zIn * INtoU);
      bScene = new THREE.Vector3(dim.b.xIn * INtoU, 0, dim.b.zIn * INtoU);
    } else {
      // free3d or legacy (no projection): full 3D coords
      aScene = new THREE.Vector3(dim.a.xIn * INtoU, dim.a.yIn * INtoU, dim.a.zIn * INtoU);
      bScene = new THREE.Vector3(dim.b.xIn * INtoU, dim.b.yIn * INtoU, dim.b.zIn * INtoU);
    }

    const dist = aScene.distanceTo(bScene);
    if (dist < 2 * MANUAL_S + 0.5) return null;

    const dir = bScene.clone().sub(aScene).normalize();
    let perp;
    if (dim.projection === 'side') {
      // XY plane: wings perpendicular using Z axis as the up-direction
      perp = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 0, 1));
      if (perp.lengthSq() < 0.0001) perp = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(1, 0, 0));
    } else {
      perp = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
      if (perp.lengthSq() < 0.0001) perp = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(1, 0, 0));
    }
    perp.normalize().multiplyScalar(MANUAL_AW);

    const aInner = aScene.clone().add(dir.clone().multiplyScalar(MANUAL_S));
    const bInner = bScene.clone().sub(dir.clone().multiplyScalar(MANUAL_S));
    const mid = aScene.clone().lerp(bScene, 0.5);

    return {
      aScene, bScene, aInner, bInner, mid,
      wingA1: aInner.clone().add(perp), wingA2: aInner.clone().sub(perp),
      wingB1: bInner.clone().add(perp), wingB2: bInner.clone().sub(perp),
    };
  }, [dim.a.xIn, dim.a.yIn, dim.a.zIn, dim.b.xIn, dim.b.yIn, dim.b.zIn, dim.projection]);

  useLayoutEffect(() => {
    geomRef.current = geom;
  }, [geom]);

  useFrame(() => {
    const g = geomRef.current;
    if (!g || !labelRef.current) return;
    const w = gl.domElement.clientWidth;
    const h = gl.domElement.clientHeight;
    const toScreen = (v) => {
      const c = v.clone().project(camera);
      return { x: (c.x + 1) * 0.5 * w, y: (1 - c.y) * 0.5 * h };
    };
    const sa = toScreen(g.aScene);
    const sb = toScreen(g.bScene);
    let angleDeg = Math.atan2(sb.y - sa.y, sb.x - sa.x) * (180 / Math.PI);
    if (angleDeg > 90) angleDeg -= 180;
    else if (angleDeg < -90) angleDeg += 180;
    labelRef.current.style.transform = `rotate(${angleDeg.toFixed(2)}deg) translateY(-8px)`;
  });

  if (!geom) return null;

  return (
    <>
      <Line points={[geom.aInner.toArray(), geom.bInner.toArray()]} color={DIM_COLOR} lineWidth={1.5} />
      <ArrowHead tip={geom.aScene.toArray()} wingA={geom.wingA1.toArray()} wingB={geom.wingA2.toArray()} />
      <ArrowHead tip={geom.bScene.toArray()} wingA={geom.wingB1.toArray()} wingB={geom.wingB2.toArray()} />
      <Html position={geom.mid.toArray()} center>
        <div ref={labelRef} style={LABEL_STYLE}>{String(dim.label ?? "")}</div>
      </Html>
    </>
  );
}

function ManualDimTool({ active, showDimensions, manualDimensions, onAddManualDimension, units, stairHeight, view }) {
  const [pendingPointA, setPendingPointA] = useState(null);
  const pendingPointARef = useRef(null);
  const phaseRef = useRef('idle');
  const { camera, scene, gl } = useThree();
  const INtoU = 0.5;

  const unitsRef = useRef(units);
  const onAddRef = useRef(onAddManualDimension);
  const stairHeightRef = useRef(stairHeight);
  const viewRef = useRef(view);
  useLayoutEffect(() => {
    unitsRef.current = units;
    onAddRef.current = onAddManualDimension;
    stairHeightRef.current = stairHeight;
    viewRef.current = view;
  }, [units, onAddManualDimension, stairHeight, view]);

  // Derived state: clear pending point when tool deactivates (avoids setState in effect)
  const [prevActive, setPrevActive] = useState(active);
  if (prevActive !== active) {
    setPrevActive(active);
    if (!active) setPendingPointA(null);
  }

  const setPending = (pt) => {
    pendingPointARef.current = pt;
    setPendingPointA(pt);
  };

  // Reset refs when tool deactivates (no setState needed here)
  useLayoutEffect(() => {
    if (!active) {
      phaseRef.current = 'idle';
      pendingPointARef.current = null;
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const canvas = gl.domElement;
    let downX = 0, downY = 0;
    let clickTimer = null;

    const getMouseNDC = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
      };
    };

    const commitPoint = (pt) => {
      if (phaseRef.current === 'idle') {
        setPending(pt);
        phaseRef.current = 'placing';
      } else {
        const a = pendingPointARef.current;
        if (!a) { phaseRef.current = 'idle'; return; }

        const projection = viewRef.current === 'side' ? 'side' : viewRef.current === 'top' ? 'top' : 'free3d';
        const dxIn = (pt.x - a.x) / INtoU;
        const dyIn = (pt.y - a.y) / INtoU;
        const dzIn = (pt.z - a.z) / INtoU;
        let measuredValueIn;
        if (projection === 'side') {
          measuredValueIn = Math.sqrt(dxIn * dxIn + dyIn * dyIn);
        } else if (projection === 'top') {
          measuredValueIn = Math.sqrt(dxIn * dxIn + dzIn * dzIn);
        } else {
          measuredValueIn = Math.sqrt(dxIn * dxIn + dyIn * dyIn + dzIn * dzIn);
        }

        const label = fmtUnit(measuredValueIn, unitsRef.current);
        const id = `dim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        onAddRef.current({
          id,
          a: { xIn: a.x / INtoU, yIn: a.y / INtoU, zIn: a.z / INtoU },
          b: { xIn: pt.x / INtoU, yIn: pt.y / INtoU, zIn: pt.z / INtoU },
          label,
          measuredValueIn,
          projection,
        });
        setPending(null);
        phaseRef.current = 'idle';
      }
    };

    const commitModelPick = (ev) => {
      const { x: nx, y: ny } = getMouseNDC(ev);
      const ray = new THREE.Raycaster();
      ray.setFromCamera({ x: nx, y: ny }, camera);

      // Only raycast against real model meshes — exclude grid, helpers, dim markers, and transparent planes.
      // Using isMeshStandardMaterial as the positive filter: all stair/post/rail/landing geometry uses it;
      // dimension markers (meshBasicMaterial), Grid (ShaderMaterial), and invisible planes are all excluded.
      const targets = [];
      scene.traverse(obj => {
        if (!obj.isMesh || !obj.visible) return;
        if (obj.userData.isDimMarker || obj.userData.isDimension || obj.userData.isHelper || obj.userData.ignoreDimensionPick) return;
        const m = obj.material;
        if (!m || !m.isMeshStandardMaterial) return;
        targets.push(obj);
      });

      const hits = ray.intersectObjects(targets, false);
      if (hits.length === 0) return; // no valid model geometry hit — do nothing
      commitPoint(hits[0].point.clone());
    };

    const commitFreePoint = (ev) => {
      const { x: nx, y: ny } = getMouseNDC(ev);
      const ray = new THREE.Raycaster();
      ray.setFromCamera({ x: nx, y: ny }, camera);

      // Plane perpendicular to camera direction.
      // If Point A is pending, the plane passes through it; otherwise through the stair center.
      let planeCenter;
      if (pendingPointARef.current) {
        planeCenter = pendingPointARef.current.clone();
      } else {
        planeCenter = new THREE.Vector3(0, (stairHeightRef.current ?? 0) * INtoU / 2, 0);
      }

      const cameraDir = new THREE.Vector3();
      camera.getWorldDirection(cameraDir);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(cameraDir, planeCenter);

      const pt = new THREE.Vector3();
      if (!ray.ray.intersectPlane(plane, pt)) return; // ray parallel to plane — ignore
      commitPoint(pt);
    };

    const onPointerDown = (e) => { downX = e.clientX; downY = e.clientY; };

    const onClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      if (dx * dx + dy * dy > 64) return;

      // Delay 250 ms so a subsequent dblclick can cancel this timer before model-pick runs.
      const snapshot = { clientX: e.clientX, clientY: e.clientY };
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        clickTimer = null;
        commitModelPick(snapshot);
      }, 250);
    };

    const onDblClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Cancel any pending single-click model-pick so it doesn't fire after the dblclick.
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }

      commitFreePoint(e);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') {
        phaseRef.current = 'idle';
        setPending(null);
        if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('click', onClick, true);
    canvas.addEventListener('dblclick', onDblClick, true);
    window.addEventListener('keydown', onKey);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('click', onClick, true);
      canvas.removeEventListener('dblclick', onDblClick, true);
      window.removeEventListener('keydown', onKey);
      if (clickTimer) clearTimeout(clickTimer);
    };
  }, [active, camera, scene, gl]);

  const showPersistedDims = showDimensions || active;

  return (
    <>
      {showPersistedDims && (manualDimensions || []).map(dim => (
        <PersistedDim key={dim.id} dim={dim} />
      ))}
      {active && pendingPointA && (() => {
        const pos = view === 'side'
          ? [pendingPointA.x, pendingPointA.y, 0]
          : view === 'top'
            ? [pendingPointA.x, 0, pendingPointA.z]
            : pendingPointA.toArray();
        return (
          <mesh position={pos} userData={{ isDimMarker: true }}>
            <sphereGeometry args={[0.5, 10, 10]} />
            <meshBasicMaterial color={DIM_COLOR} />
          </mesh>
        );
      })()}
    </>
  );
}

const TEXT_ANNOTATION_STYLE = {
  background: 'rgba(255, 255, 255, 0.93)',
  color: '#1a1a2e',
  fontSize: '10px',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  padding: '3px 7px',
  borderRadius: '3px',
  border: '1px solid rgba(30,58,92,0.25)',
  pointerEvents: 'none',
  userSelect: 'none',
  maxWidth: '200px',
  whiteSpace: 'pre-wrap',
  lineHeight: '1.45',
};

function ManualTextAnnotationsRenderer({ annotations }) {
  const INtoU = 0.5;
  if (!annotations || annotations.length === 0) return null;
  return (
    <>
      {annotations.map((ann) => {
        let pos;
        if (ann.projection === 'side') {
          pos = [ann.xIn * INtoU, ann.yIn * INtoU, 0];
        } else if (ann.projection === 'top') {
          pos = [ann.xIn * INtoU, 0, ann.zIn * INtoU];
        } else {
          pos = [ann.xIn * INtoU, ann.yIn * INtoU, ann.zIn * INtoU];
        }
        return (
          <Html key={ann.id} position={pos} center>
            <div style={TEXT_ANNOTATION_STYLE}>{ann.text}</div>
          </Html>
        );
      })}
    </>
  );
}

function ManualTextTool({ active, onAddManualTextAnnotation, stairHeight, view }) {
  const { camera, scene, gl } = useThree();
  const INtoU = 0.5;
  const viewRef = useRef(view);
  const onAddRef = useRef(onAddManualTextAnnotation);
  const stairHeightRef = useRef(stairHeight);
  useLayoutEffect(() => {
    viewRef.current = view;
    onAddRef.current = onAddManualTextAnnotation;
    stairHeightRef.current = stairHeight;
  }, [view, onAddManualTextAnnotation, stairHeight]);

  useEffect(() => {
    if (!active) return;
    const canvas = gl.domElement;

    const getMouseNDC = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
      };
    };

    const placeAnnotation = (pt) => {
      const projection = viewRef.current === 'side' ? 'side' : viewRef.current === 'top' ? 'top' : 'free3d';
      const id = `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      onAddRef.current({ id, text: 'Text', xIn: pt.x / INtoU, yIn: pt.y / INtoU, zIn: pt.z / INtoU, projection });
    };

    const tryModelPick = (ev) => {
      const { x: nx, y: ny } = getMouseNDC(ev);
      const ray = new THREE.Raycaster();
      ray.setFromCamera({ x: nx, y: ny }, camera);
      const targets = [];
      scene.traverse(obj => {
        if (!obj.isMesh || !obj.visible) return;
        if (obj.userData.isDimMarker || obj.userData.isHelper || obj.userData.ignoreDimensionPick) return;
        const m = obj.material;
        if (!m || !m.isMeshStandardMaterial) return;
        targets.push(obj);
      });
      const hits = ray.intersectObjects(targets, false);
      if (hits.length > 0) { placeAnnotation(hits[0].point.clone()); return true; }
      return false;
    };

    const tryFreePick = (ev) => {
      const { x: nx, y: ny } = getMouseNDC(ev);
      const ray = new THREE.Raycaster();
      ray.setFromCamera({ x: nx, y: ny }, camera);
      const planeCenter = new THREE.Vector3(0, (stairHeightRef.current ?? 0) * INtoU / 2, 0);
      const cameraDir = new THREE.Vector3();
      camera.getWorldDirection(cameraDir);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(cameraDir, planeCenter);
      const pt = new THREE.Vector3();
      if (!ray.ray.intersectPlane(plane, pt)) return;
      placeAnnotation(pt);
    };

    const onDblClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (!tryModelPick(e)) tryFreePick(e);
    };

    canvas.addEventListener('dblclick', onDblClick, true);
    return () => canvas.removeEventListener('dblclick', onDblClick, true);
  }, [active, camera, scene, gl]);

  return null;
}

function PdfModePanel({ mode, pdfDraft, activeTool, onAddPdfDimension, onAddPdfText, onDeleteLast, onExit, selectedDimId, onSelectDim }) {
  const [pendingA, setPendingA] = useState(null);
  const overlayRef = useRef(null);
  const [sz, setSz] = useState({ w: 1, h: 1 });

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const sync = () => setSz({ w: el.clientWidth || 1, h: el.clientHeight || 1 });
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') setPendingA(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const getNorm = (e) => {
    const r = overlayRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const handleDblClick = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (activeTool === 'dimension') {
      const pt = getNorm(e);
      if (!pendingA) {
        setPendingA(pt);
      } else {
        onAddPdfDimension({ id: `pdim-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, ax: pendingA.x, ay: pendingA.y, bx: pt.x, by: pt.y, label: 'DIM' });
        setPendingA(null);
      }
    } else if (activeTool === 'text') {
      onAddPdfText({ id: `ptxt-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, ...getNorm(e), text: 'Text' });
    }
  };

  const dims = pdfDraft?.dimensions ?? [];
  const texts = pdfDraft?.texts ?? [];
  const { w, h } = sz;
  const isDimTool = activeTool === 'dimension';
  const isTextTool = activeTool === 'text';

  return (
    <div ref={overlayRef} className="pdf-mode-overlay">
      <div className="pdf-print-frame" />

      {/* Capture layer: double-click to place dims/text, single click to deselect */}
      <div
        style={{ position: 'absolute', inset: 0, cursor: isDimTool || isTextTool ? 'crosshair' : 'default', pointerEvents: 'all', zIndex: 1 }}
        onDoubleClick={isDimTool || isTextTool ? handleDblClick : undefined}
        onClick={() => onSelectDim && onSelectDim(null)}
      />

      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', zIndex: 2 }}>
        {dims.map(dim => {
          const ax = dim.ax * w, ay = dim.ay * h;
          const bx = dim.bx * w, by = dim.by * h;
          const len = Math.hypot(bx - ax, by - ay);
          if (len < 4) return null;

          const midX = (ax + bx) / 2, midY = (ay + by) / 2;

          // Original direction unit vector (A→B)
          const oux = (bx - ax) / len, ouy = (by - ay) / len;

          // Normalize direction to "rightward or upward" so the label always sits
          // on a consistent visual side (above horizontal, left of vertical)
          let nux = oux, nuy = ouy;
          if (nux < 0 || (nux === 0 && nuy > 0)) { nux = -nux; nuy = -nuy; }

          // "Above" perpendicular in screen coords (y-down):
          // Rotate normalized direction 90° CW-in-screen (mathematically: (nuy, -nux))
          const perpX = nuy, perpY = -nux;
          const LABEL_OFFSET = 14;
          const lx = midX + perpX * LABEL_OFFSET;
          const ly = midY + perpY * LABEL_OFFSET;

          // SVG rotation angle (CW-positive), normalized to [-90, 90) so text is always readable
          let angleDeg = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
          if (angleDeg >= 90) angleDeg -= 180;
          else if (angleDeg < -90) angleDeg += 180;

          // Filled arrowheads at A and B
          const ARROW_LEN = 10, ARROW_W = 4;
          const apx = -ouy, apy = oux; // perpendicular (used for arrowhead wings)
          const arrowA = `${ax},${ay} ${ax + oux * ARROW_LEN + apx * ARROW_W},${ay + ouy * ARROW_LEN + apy * ARROW_W} ${ax + oux * ARROW_LEN - apx * ARROW_W},${ay + ouy * ARROW_LEN - apy * ARROW_W}`;
          const arrowB = `${bx},${by} ${bx - oux * ARROW_LEN + apx * ARROW_W},${by - ouy * ARROW_LEN + apy * ARROW_W} ${bx - oux * ARROW_LEN - apx * ARROW_W},${by - ouy * ARROW_LEN - apy * ARROW_W}`;

          const lbl = String(dim.label ?? 'DIM');
          const lblW = Math.max(32, lbl.length * 6.5 + 14);
          const isSelected = selectedDimId === dim.id;
          const dimColor = isSelected ? '#1565c0' : '#1e3a5f';
          const borderColor = isSelected ? '#1565c0' : '#c0c8d5';

          return (
            <g
              key={dim.id}
              pointerEvents="all"
              style={{ cursor: 'pointer' }}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onSelectDim && onSelectDim(dim.id); }}
            >
              {/* Wide invisible hit area */}
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke="transparent" strokeWidth={14} />
              {/* Dimension line */}
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke={dimColor} strokeWidth={isSelected ? 2 : 1.5} />
              {/* Arrowheads */}
              <polygon points={arrowA} fill={dimColor} />
              <polygon points={arrowB} fill={dimColor} />
              {/* Label rotated parallel to line, offset above/left */}
              <g transform={`translate(${lx},${ly}) rotate(${angleDeg})`}>
                <rect x={-lblW / 2} y={-8} width={lblW} height={14} fill="white" stroke={borderColor} strokeWidth={isSelected ? 1.5 : 0.7} rx={2} />
                <text x={0} y={3.5} textAnchor="middle" fontSize={10} fill={dimColor} fontWeight="bold" fontFamily="ui-monospace,monospace">{lbl}</text>
              </g>
            </g>
          );
        })}
        {texts.map(ann => {
          const tx = ann.x * w, ty = ann.y * h;
          const lbl = String(ann.text ?? '');
          const lblW = Math.max(40, lbl.length * 6.5 + 14);
          return (
            <g key={ann.id}>
              <rect x={tx} y={ty - 12} width={lblW} height={16} fill="rgba(255,255,255,0.93)" stroke="#c0c8d5" strokeWidth={0.7} rx={2} />
              <text x={tx + 4} y={ty} fontSize={10} fill="#1a1a2e" fontFamily="ui-sans-serif,sans-serif">{lbl}</text>
            </g>
          );
        })}
        {pendingA && (
          <circle cx={pendingA.x * w} cy={pendingA.y * h} r={5} fill="#1e3a5f" stroke="white" strokeWidth={1.5} />
        )}
      </svg>

      <div className="pdf-mode-badge">
        <span className="pdf-mode-badge-label">{mode === '3d' ? '3D PDF ACTIVE' : 'SIDE PDF ACTIVE'}</span>
        {isDimTool && <span style={{ fontSize: '10px', color: '#94a3b8' }}>{pendingA ? '→ dbl-click pt B' : '→ dbl-click pt A'}</span>}
        {isTextTool && <span style={{ fontSize: '10px', color: '#94a3b8' }}>→ dbl-click to place</span>}
        <button
          className="panel-btn panel-btn-danger"
          style={{ fontSize: '10px', padding: '2px 7px' }}
          onClick={e => { e.stopPropagation(); if (pendingA) { setPendingA(null); } else { onDeleteLast(); } }}
          disabled={dims.length === 0 && texts.length === 0 && !pendingA}
        >
          Delete Last
        </button>
        <button
          className="panel-btn panel-btn-primary"
          style={{ fontSize: '10px', padding: '2px 7px' }}
          onClick={e => { e.stopPropagation(); setPendingA(null); onExit(); }}
        >
          Exit PDF Mode
        </button>
      </div>
    </div>
  );
}

export default function StairScene({ stairConfig, calc, view, viewResetToken, units, showDimensions, activeTool, manualPosts, postPlacementMode, onAddManualPost, selectedManualPostId, onSelectManualPost, topRailMode, topRailFirstPostId, onTopRailPostClick, manualTopRails, railingColorMode, structureOffsetXIn = 0, structureOffsetZIn = 0, topRailPathMode = 'standard', fastRailsMode = false, fastRailsPrevPostId = null, onFastRailsPost, onFastRailsPostSelect, manualDimensions = [], onAddManualDimension, manualTextAnnotations = [], onAddManualTextAnnotation, capture3dRef = null, activePdfDraftMode = null, pdfDrafts = null, onAddPdfDimension, onAddPdfText, onDeleteLastPdfAnnotation, onExitPdfMode, selectedPdfDraftDimensionId = null, onSelectPdfDraftDimension }) {
  const { height, run, width, steps, handrailHeight, tubeSize, bottomLandingLength, topLandingLength, topLandingWidth, bottomRailEnabled, bottomRailHeight, middleRailEnabled, middleRailHeights, middleRailHeight, railLowerExtensionIn = 0, railUpperExtensionIn = 0, railingSideMode, post1Section, post2Section, post1HeightIn, post2HeightIn, compactTopHandrailEnabled, compactBottomChannelEnabled } = stairConfig;
  const effectiveColorMode = railingColorMode ?? 'color';
  const effectiveMiddleRailHeights = middleRailHeights ?? (middleRailHeight != null ? [middleRailHeight] : [18]);

  // Override zIn per post based on railingSideMode so the full railing follows the selected edge.
  // Offset by half the post's Z-section so the OUTER FACE is flush with the stair edge, not the center.
  // This is a render-time transform — stored post data is not mutated.
  const effectivePosts = useMemo(() => {
    // Re-anchor compact posts to current stair geometry before height/Z resolution.
    const anchored = resolveCompactPostAnchors(manualPosts || [], stairConfig, calc.treadPositions);
    // Resolve compact post heights live from stairConfig so UI changes take effect immediately.
    const resolveHeight = (post) => {
      if (post.compactSlot === 'post1' && post1HeightIn != null) return Number(post1HeightIn);
      if (post.compactSlot === 'post2' && post2HeightIn != null) return Number(post2HeightIn);
      return post.heightIn;
    };
    const posts = anchored.map(post => {
      const h = resolveHeight(post);
      return h !== post.heightIn ? { ...post, heightIn: h } : post;
    });
    if (!railingSideMode) return posts;
    const isRight = railingSideMode === 'right';
    const profile = getTubeProfile(tubeSize);
    return posts.map(post => {
      const resolvedSection = resolveManualPostSection(post, post1Section, post2Section, tubeSize);
      // secD is the Z extent of the post (second number in "W x H" section string)
      const { h: secD } = parseSectionIn(resolvedSection, profile.width, profile.width);
      const postHalfZIn = secD / 2;
      // All posts (including topLanding) align to the normal stair tread width, not topLandingWidth
      const zIn = isRight ? width / 2 - postHalfZIn : -width / 2 + postHalfZIn;
      return { ...post, zIn };
    });
  }, [manualPosts, stairConfig, calc.treadPositions, railingSideMode, width, tubeSize, post1Section, post2Section, post1HeightIn, post2HeightIn]);

  // Exclude legacy manual rails that duplicate the compact Post 1 → Post 2 pair.
  const filteredManualTopRails = useMemo(
    () => (manualTopRails || []).filter(r => !isLegacyCompactDuplicateRail(r, effectivePosts)),
    [manualTopRails, effectivePosts]
  );

  const compactPostPair = useMemo(() => {
    const p1 = effectivePosts.find(p => p.compactSlot === 'post1');
    const p2 = effectivePosts.find(p => p.compactSlot === 'post2');
    return p1 && p2 ? { p1, p2 } : null;
  }, [effectivePosts]);

  const orbitRef = useRef();
  const isMeasure = activeTool === 'measure';
  // In PDF mode, disable 3D dim/text tools so PDF overlay handles annotation capture instead
  const isDims = activeTool === 'dimension' && !activePdfDraftMode;
  const isText = activeTool === 'text' && !activePdfDraftMode;
  const isPdfAnnotationTool = !!activePdfDraftMode && (activeTool === 'dimension' || activeTool === 'text');
  const activeCursor = isMeasure || isDims || isText || isPdfAnnotationTool || postPlacementMode || topRailMode || fastRailsMode ? 'crosshair' : undefined;

  return (
    <div id="print-viewport" className="scene-container" style={activeCursor ? { cursor: activeCursor } : undefined}>
      <Canvas
        camera={{ position: [80, 55, 110], fov: 45, near: 0.1, far: 5000 }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <color attach="background" args={['#edf2f7']} />

        <CanvasCaptureHelper captureRef={capture3dRef} />
        <CameraController view={view} viewResetToken={viewResetToken} controlsRef={orbitRef} height={height} run={run} width={width} />
        <KeyboardNudge controlsRef={orbitRef} />

        <ambientLight intensity={1.1} />
        <directionalLight position={[100, 200, 100]} intensity={1.5} />
        <directionalLight position={[-80, 100, -60]} intensity={0.5} />
        <directionalLight position={[0, -50, 80]} intensity={0.12} />

        <Grid
          args={[500, 500]}
          cellSize={12}
          cellThickness={0.15}
          cellColor="#cdd8e4"
          sectionSize={60}
          sectionThickness={0.4}
          sectionColor="#aabccc"
          fadeDistance={400}
          fadeStrength={2}
          infiniteGrid
        />

        <BottomLanding run={run} width={width} bottomLandingLength={bottomLandingLength ?? 36} treadDepth={calc.treadDepth} postPlacementMode={postPlacementMode} onAddManualPost={onAddManualPost} handrailHeight={handrailHeight} fastRailsMode={fastRailsMode} onFastRailsPost={onFastRailsPost} />
        <TopLanding run={run} width={width} topLandingWidth={topLandingWidth ?? width} height={height} steps={steps} topLandingLength={topLandingLength ?? 36} postPlacementMode={postPlacementMode} onAddManualPost={onAddManualPost} handrailHeight={handrailHeight} treadPositions={calc.treadPositions} fastRailsMode={fastRailsMode} onFastRailsPost={onFastRailsPost} />

        <StairModel
          height={height}
          run={run}
          width={width}
          steps={steps}
          handrailHeight={handrailHeight}
          treadPositions={calc.treadPositions.length > 0 ? calc.treadPositions.slice(0, -1) : calc.treadPositions}
          postPlacementMode={postPlacementMode}
          onAddManualPost={onAddManualPost}
          fastRailsMode={fastRailsMode}
          onFastRailsPost={onFastRailsPost}
        />

        {SHOW_INLINE_DIMS && <DimensionLabels stairConfig={stairConfig} calc={calc} units={units} />}

        <group position={[structureOffsetXIn * 0.5, 0, structureOffsetZIn * 0.5]}>
          <ManualPostsRenderer
            manualPosts={effectivePosts}
            treadPositions={calc.treadPositions}
            riserHeight={calc.riserHeight}
            run={run}
            tubeSize={tubeSize}
            selectedManualPostId={selectedManualPostId}
            onSelectManualPost={onSelectManualPost}
            topRailMode={topRailMode}
            topRailFirstPostId={topRailFirstPostId}
            onTopRailPostClick={onTopRailPostClick}
            railingColorMode={effectiveColorMode}
            fastRailsMode={fastRailsMode}
            fastRailsPrevPostId={fastRailsPrevPostId}
            onFastRailsPostSelect={onFastRailsPostSelect}
            isDims={isDims}
            post1Section={stairConfig.post1Section}
            post2Section={stairConfig.post2Section}
          />

          <ManualTopRailsRenderer
            manualTopRails={filteredManualTopRails}
            manualPosts={effectivePosts}
            treadPositions={calc.treadPositions}
            riserHeight={calc.riserHeight}
            run={run}
            railingColorMode={effectiveColorMode}
            railLowerExtensionIn={railLowerExtensionIn}
            railUpperExtensionIn={railUpperExtensionIn}
            topRailPathMode={topRailPathMode}
            handrailSection={stairConfig.handrailSection}
          />

          {bottomRailEnabled && (
            <ManualBottomRailsRenderer
              manualTopRails={filteredManualTopRails}
              manualPosts={effectivePosts}
              treadPositions={calc.treadPositions}
              riserHeight={calc.riserHeight}
              run={run}
              bottomRailHeight={bottomRailHeight ?? 1}
              railingColorMode={effectiveColorMode}
              bottomChannelSection={stairConfig.bottomChannelSection}
            />
          )}

          {middleRailEnabled && effectiveMiddleRailHeights.length > 0 && (
            <ManualMiddleRailsRenderer
              manualTopRails={filteredManualTopRails}
              manualPosts={effectivePosts}
              treadPositions={calc.treadPositions}
              riserHeight={calc.riserHeight}
              run={run}
              middleRailHeights={effectiveMiddleRailHeights}
              railingColorMode={effectiveColorMode}
            />
          )}

          {compactTopHandrailEnabled !== false && compactPostPair !== null && (
            <CompactHandrailRenderer
              manualPosts={effectivePosts}
              treadPositions={calc.treadPositions}
              riserHeight={calc.riserHeight}
              run={run}
              handrailSection={stairConfig.handrailSection}
              railingColorMode={effectiveColorMode}
            />
          )}

          {compactBottomChannelEnabled !== false && compactPostPair !== null && (
            <CompactBottomChannelRenderer
              manualPosts={effectivePosts}
              treadPositions={calc.treadPositions}
              riserHeight={calc.riserHeight}
              run={run}
              bottomChannelSection={stairConfig.bottomChannelSection}
              railingColorMode={effectiveColorMode}
            />
          )}

          <InfillRenderer
            manualPosts={effectivePosts}
            treadPositions={calc.treadPositions}
            riserHeight={calc.riserHeight}
            run={run}
            infillType={stairConfig.infillType ?? 'none'}
            verticalPicketThicknessIn={parseSectionIn(stairConfig.picketVerticalSection, 1, 1).w}
            verticalPicketDepthIn={parseSectionIn(stairConfig.picketVerticalSection, 1, 1).h}
            horizontalPicketThicknessIn={parseSectionIn(stairConfig.picketHorizontalSection, 1, 1).h}
            horizontalPicketWidthIn={parseSectionIn(stairConfig.picketHorizontalSection, 1, 1).w}
            horizontalCableDiameterIn={parseCableDiameterIn(stairConfig.cableSize)}
            bottomRailHeightIn={stairConfig.bottomRailHeight ?? 1}
            tubeSize={tubeSize}
            railingColorMode={effectiveColorMode}
            compactTopHandrailEnabled={compactTopHandrailEnabled !== false}
            compactBottomChannelEnabled={compactBottomChannelEnabled !== false}
            post1Section={stairConfig.post1Section}
            post2Section={stairConfig.post2Section}
            handrailSection={stairConfig.handrailSection}
            bottomChannelSection={stairConfig.bottomChannelSection}
          />
        </group>

        <MeasureTool active={isMeasure} units={units} />
        <ManualDimTool
          active={isDims}
          showDimensions={showDimensions}
          manualDimensions={manualDimensions}
          onAddManualDimension={onAddManualDimension}
          units={units}
          stairHeight={height}
          view={view}
        />

        <ManualTextTool
          active={isText}
          onAddManualTextAnnotation={onAddManualTextAnnotation}
          stairHeight={height}
          view={view}
        />
        <ManualTextAnnotationsRenderer annotations={manualTextAnnotations} />

        <OrbitControls
          ref={orbitRef}
          makeDefault
          enabled={!isMeasure && !isPdfAnnotationTool}
          enableDamping
          dampingFactor={0.08}
          screenSpacePanning
          panSpeed={1.2}
        />
      </Canvas>
      {activePdfDraftMode && (
        <PdfModePanel
          mode={activePdfDraftMode}
          pdfDraft={activePdfDraftMode === 'side' ? pdfDrafts?.side : pdfDrafts?.threeD}
          activeTool={activeTool}
          onAddPdfDimension={onAddPdfDimension}
          onAddPdfText={onAddPdfText}
          onDeleteLast={onDeleteLastPdfAnnotation}
          onExit={onExitPdfMode}
          selectedDimId={activePdfDraftMode === '3d' ? selectedPdfDraftDimensionId : null}
          onSelectDim={activePdfDraftMode === '3d' ? onSelectPdfDraftDimension : undefined}
        />
      )}
    </div>
  );
}
