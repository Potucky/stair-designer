import { useEffect, useRef, useMemo, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { fmtUnit } from '../utils/format.js';
import { getTubeProfile, getManualPostBase, getManualTopRailDoglegSegments, getManualTopRailManualSegments, getManualBottomRailSegments, getManualMiddleRailSegments } from '../geometry/railingGeometry.js';

// Stair center Y in scene units for default config: 108in * 0.5 (INtoU) / 2 = 27
const SCENE_CENTER_Y = 27;

// Visual tread thickness in scene units (shared by StairModel and ManualPostsRenderer)
const TREAD_THICK = 0.3;

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
  heightRef.current = height;
  runRef.current = run;
  widthRef.current = width;

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

const S = 1.4;  // arrowhead length (scene units)
const AW = S * 0.28; // arrowhead half-width

function ArrowHead({ tip, wingA, wingB }) {
  const verts = useMemo(
    () => new Float32Array([...tip, ...wingA, ...wingB]),
    [tip, wingA, wingB]
  );
  return (
    <mesh>
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
        castShadow
        receiveShadow
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

function BottomLanding({ run, width, bottomLandingLength }) {
  const INtoU = 0.5;
  const r = run * INtoU;
  const w = width * INtoU;
  const landLen = bottomLandingLength * INtoU;
  return (
    <mesh position={[-r / 2 - landLen / 2, TREAD_THICK / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[landLen, TREAD_THICK, w]} />
      <meshStandardMaterial color="#7c8da0" metalness={0.3} roughness={0.6} />
    </mesh>
  );
}

function TopLanding({ run, width, height, steps, topLandingLength, postPlacementMode, onAddManualPost, handrailHeight, treadPositions, fastRailsMode, onFastRailsPost }) {
  const INtoU = 0.5;
  const r = run * INtoU;
  const w = width * INtoU;
  const h = height * INtoU;
  const riserH = steps > 0 ? h / steps : h;
  const treadD = steps > 0 ? r / steps : 0;
  const landLen = topLandingLength * INtoU;

  const finalIndex = treadPositions && treadPositions.length > 0 ? treadPositions.length - 1 : -1;
  const handleClick = ((postPlacementMode || fastRailsMode) && finalIndex >= 0) ? (e) => {
    e.stopPropagation();
    const finalTread = treadPositions[finalIndex];
    const normal = e.face?.normal;
    let mount = 'top';
    let side = 'center';
    let zIn = 0;
    if (normal && Math.abs(normal.z) > Math.abs(normal.y) && Math.abs(normal.z) > Math.abs(normal.x)) {
      mount = 'side';
      side = normal.z > 0 ? 'right' : 'left';
      zIn = normal.z > 0 ? width / 2 : -(width / 2);
    }
    const postData = {
      stepIndex: finalIndex,
      mount,
      side,
      xIn: finalTread.x,
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
    <mesh position={[r / 2 - treadD + landLen / 2, h - riserH / 2 + TREAD_THICK / 2, 0]} onClick={handleClick} castShadow receiveShadow>
      <boxGeometry args={[landLen, TREAD_THICK, w]} />
      <meshStandardMaterial color="#7c8da0" metalness={0.3} roughness={0.6} />
    </mesh>
  );
}

// Renders manually placed posts from the manualPosts array.
function ManualPostsRenderer({ manualPosts, treadPositions, riserHeight, run, tubeSize, selectedManualPostId, onSelectManualPost, topRailMode, topRailFirstPostId, onTopRailPostClick, railingColorMode, fastRailsMode, fastRailsPrevPostId, onFastRailsPostSelect }) {
  const INtoU = 0.5;
  const profile = getTubeProfile(tubeSize);
  const postSide = profile.width * INtoU; // real profile width in scene units

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

        const basePostColor = railingColorMode === 'black' ? '#111111' : '#4a4a4a';
        let color = basePostColor;
        if (id === topRailFirstPostId) color = '#3b82f6';
        else if (fastRailsMode && id === fastRailsPrevPostId) color = '#22c55e';
        else if (id === selectedManualPostId) color = '#f59e0b';

        const handleClick = (e) => {
          e.stopPropagation();
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
            castShadow
          >
            <boxGeometry args={[postSide, postH, postSide]} />
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
function ManualTopRailsRenderer({ manualTopRails, manualPosts, treadPositions, riserHeight, run, railingColorMode, railLowerExtensionIn = 0, railUpperExtensionIn = 0, topRailPathMode = 'standard' }) {
  const INtoU = 0.5;
  const RAIL_W = 2 * INtoU;
  const RAIL_H = 1 * INtoU;

  const segments = useMemo(
    () => topRailPathMode === 'manual'
      ? getManualTopRailManualSegments(manualTopRails, manualPosts, treadPositions, riserHeight, run)
      : getManualTopRailDoglegSegments(manualTopRails, manualPosts, treadPositions, riserHeight, run, railLowerExtensionIn, railUpperExtensionIn),
    [topRailPathMode, manualTopRails, manualPosts, treadPositions, riserHeight, run, railLowerExtensionIn, railUpperExtensionIn]
  );

  return (
    <>
      {segments.map(({ rail, segKey, start, end }) => {
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
          <mesh key={segKey} position={midV.toArray()} quaternion={quat} castShadow>
            <boxGeometry args={[length, RAIL_H, RAIL_W]} />
            <meshStandardMaterial color={railingColorMode === 'black' ? '#111111' : '#8B6914'} metalness={0.3} roughness={0.5} />
          </mesh>
        );
      })}
    </>
  );
}

function ManualBottomRailsRenderer({ manualTopRails, manualPosts, treadPositions, riserHeight, run, bottomRailHeight, railingColorMode }) {
  const INtoU = 0.5;
  const RAIL_W = 2 * INtoU;
  const RAIL_H = 1 * INtoU;

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
          <mesh key={`br-${rail.id}`} position={midV.toArray()} quaternion={quat} castShadow>
            <boxGeometry args={[length, RAIL_H, RAIL_W]} />
            <meshStandardMaterial color={railingColorMode === 'black' ? '#111111' : '#8B6914'} metalness={0.3} roughness={0.5} />
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
          <mesh key={`mr-${rail.id}-${height}`} position={midV.toArray()} quaternion={quat} castShadow>
            <boxGeometry args={[length, RAIL_H, RAIL_W]} />
            <meshStandardMaterial color={railingColorMode === 'black' ? '#111111' : '#2F7D7A'} metalness={0.3} roughness={0.5} />
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

export default function StairScene({ stairConfig, calc, view, viewResetToken, units, showDimensions, modalOpen = false, activeTool, manualPosts, postPlacementMode, onAddManualPost, selectedManualPostId, onSelectManualPost, topRailMode, topRailFirstPostId, onTopRailPostClick, manualTopRails, railingColorMode, structureOffsetXIn = 0, structureOffsetZIn = 0, topRailPathMode = 'standard', fastRailsMode = false, fastRailsPrevPostId = null, onFastRailsPost, onFastRailsPostSelect }) {
  const { height, run, width, steps, handrailHeight, tubeSize, bottomLandingEnabled, bottomLandingLength, topLandingEnabled, topLandingLength, bottomRailEnabled, bottomRailHeight, middleRailEnabled, middleRailHeights, middleRailHeight, railLowerExtensionIn = 0, railUpperExtensionIn = 0 } = stairConfig;
  const effectiveColorMode = railingColorMode ?? 'work';
  const effectiveMiddleRailHeights = middleRailHeights ?? (middleRailHeight != null ? [middleRailHeight] : [18]);
  const orbitRef = useRef();
  const isMeasure = activeTool === 'measure';
  const activeCursor = isMeasure || postPlacementMode || topRailMode || fastRailsMode ? 'crosshair' : undefined;

  return (
    <div className="scene-container" style={activeCursor ? { cursor: activeCursor } : undefined}>
      <Canvas
        camera={{ position: [80, 55, 110], fov: 45, near: 0.1, far: 5000 }}
        shadows
      >
        <color attach="background" args={['#edf2f7']} />

        <CameraController view={view} viewResetToken={viewResetToken} controlsRef={orbitRef} height={height} run={run} width={width} />
        <KeyboardNudge controlsRef={orbitRef} />

        <ambientLight intensity={1.1} />
        <directionalLight position={[100, 200, 100]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
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

        {bottomLandingEnabled && (
          <BottomLanding run={run} width={width} bottomLandingLength={bottomLandingLength} />
        )}
        {topLandingEnabled && (
          <TopLanding run={run} width={width} height={height} steps={steps} topLandingLength={topLandingLength} postPlacementMode={postPlacementMode} onAddManualPost={onAddManualPost} handrailHeight={handrailHeight} treadPositions={calc.treadPositions} fastRailsMode={fastRailsMode} onFastRailsPost={onFastRailsPost} />
        )}

        <StairModel
          height={height}
          run={run}
          width={width}
          steps={steps}
          handrailHeight={handrailHeight}
          treadPositions={topLandingEnabled && calc.treadPositions.length > 0 ? calc.treadPositions.slice(0, -1) : calc.treadPositions}
          postPlacementMode={postPlacementMode}
          onAddManualPost={onAddManualPost}
          fastRailsMode={fastRailsMode}
          onFastRailsPost={onFastRailsPost}
        />

        {showDimensions && !modalOpen && <DimensionLabels stairConfig={stairConfig} calc={calc} units={units} />}

        <group position={[structureOffsetXIn * 0.5, 0, structureOffsetZIn * 0.5]}>
          <ManualPostsRenderer
            manualPosts={manualPosts || []}
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
          />

          <ManualTopRailsRenderer
            manualTopRails={manualTopRails || []}
            manualPosts={manualPosts || []}
            treadPositions={calc.treadPositions}
            riserHeight={calc.riserHeight}
            run={run}
            railingColorMode={effectiveColorMode}
            railLowerExtensionIn={railLowerExtensionIn}
            railUpperExtensionIn={railUpperExtensionIn}
            topRailPathMode={topRailPathMode}
          />

          {bottomRailEnabled && (
            <ManualBottomRailsRenderer
              manualTopRails={manualTopRails || []}
              manualPosts={manualPosts || []}
              treadPositions={calc.treadPositions}
              riserHeight={calc.riserHeight}
              run={run}
              bottomRailHeight={bottomRailHeight ?? 1}
              railingColorMode={effectiveColorMode}
            />
          )}

          {middleRailEnabled && effectiveMiddleRailHeights.length > 0 && (
            <ManualMiddleRailsRenderer
              manualTopRails={manualTopRails || []}
              manualPosts={manualPosts || []}
              treadPositions={calc.treadPositions}
              riserHeight={calc.riserHeight}
              run={run}
              middleRailHeights={effectiveMiddleRailHeights}
              railingColorMode={effectiveColorMode}
            />
          )}
        </group>

        <MeasureTool active={isMeasure} units={units} />

        <OrbitControls
          ref={orbitRef}
          makeDefault
          enabled={!isMeasure}
          enableDamping
          dampingFactor={0.08}
          screenSpacePanning
          panSpeed={1.2}
        />
      </Canvas>
    </div>
  );
}
