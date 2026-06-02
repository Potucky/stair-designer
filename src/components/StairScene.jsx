import { useEffect, useRef, useMemo, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { fmtUnit } from '../utils/format.js';

// Stair center Y in scene units for default config: 108in * 0.5 (INtoU) / 2 = 27
const SCENE_CENTER_Y = 27;

// Thickness constants shared across StairModel and ManualPostsRenderer
const TREAD_THICK = 0.3;
const POST_THICK = 0.4;

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

function CameraController({ view, viewResetToken, controlsRef }) {
  const { camera } = useThree();

  useEffect(() => {
    if (view === 'top') {
      camera.position.set(0, 150, 0.01);
      camera.up.set(0, 0, -1);
    } else if (view === 'side') {
      camera.position.set(160, SCENE_CENTER_Y, 0);
      camera.up.set(0, 1, 0);
    } else {
      camera.position.set(80, 55, 110);
      camera.up.set(0, 1, 0);
    }
    camera.lookAt(0, SCENE_CENTER_Y, 0);
    const ctrl = controlsRef.current;
    if (ctrl) {
      ctrl.target.set(0, SCENE_CENTER_Y, 0);
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

function StairModel({ height, run, width, steps, handrailHeight, treadPositions, postPlacementMode, onAddManualPost }) {
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

    const handleTreadClick = postPlacementMode ? (e) => {
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

      onAddManualPost({
        stepIndex: i,
        mount,
        side,
        xIn: x,       // tread center X in stair inches
        zIn,
        offsetXIn: 0,
        offsetZIn: 0,
        heightIn: handrailHeight,
      });
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

// Renders manually placed posts from the manualPosts array.
function ManualPostsRenderer({ manualPosts, treadPositions, riserHeight, run, selectedManualPostId, onSelectManualPost }) {
  const INtoU = 0.5;
  const r = run * INtoU;
  const riserH = riserHeight * INtoU;

  return (
    <>
      {manualPosts.map((post) => {
        const { id, stepIndex, xIn, zIn, offsetXIn, offsetZIn, heightIn } = post;
        const tp = treadPositions[stepIndex];
        if (!tp) return null;

        const postH = heightIn * INtoU;
        const worldX = (xIn + offsetXIn) * INtoU - r / 2;
        const worldZ = (zIn + offsetZIn) * INtoU;
        // Tread top Y: center formula (ty - riserH/2 + TREAD_THICK/2) + TREAD_THICK/2
        const treadTopY = tp.y * INtoU - riserH / 2 + TREAD_THICK;
        const worldY = treadTopY + postH / 2;
        const isSelected = id === selectedManualPostId;

        return (
          <mesh
            key={id}
            position={[worldX, worldY, worldZ]}
            onClick={(e) => { e.stopPropagation(); onSelectManualPost(id); }}
            castShadow
          >
            <boxGeometry args={[POST_THICK, postH, POST_THICK]} />
            <meshStandardMaterial
              color={isSelected ? '#f59e0b' : '#c47a3a'}
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

export default function StairScene({ stairConfig, calc, view, viewResetToken, units, showDimensions, activeTool, manualPosts, postPlacementMode, onAddManualPost, selectedManualPostId, onSelectManualPost }) {
  const { height, run, width, steps, handrailHeight } = stairConfig;
  const orbitRef = useRef();
  const isMeasure = activeTool === 'measure';
  const activeCursor = isMeasure || postPlacementMode ? 'crosshair' : undefined;

  return (
    <div className="scene-container" style={activeCursor ? { cursor: activeCursor } : undefined}>
      <Canvas
        camera={{ position: [80, 55, 110], fov: 45, near: 0.1, far: 5000 }}
        shadows
      >
        <color attach="background" args={['#edf2f7']} />

        <CameraController view={view} viewResetToken={viewResetToken} controlsRef={orbitRef} />
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

        <StairModel
          height={height}
          run={run}
          width={width}
          steps={steps}
          handrailHeight={handrailHeight}
          treadPositions={calc.treadPositions}
          postPlacementMode={postPlacementMode}
          onAddManualPost={onAddManualPost}
        />

        <ManualPostsRenderer
          manualPosts={manualPosts || []}
          treadPositions={calc.treadPositions}
          riserHeight={calc.riserHeight}
          run={run}
          selectedManualPostId={selectedManualPostId}
          onSelectManualPost={onSelectManualPost}
        />

        {showDimensions && <DimensionLabels stairConfig={stairConfig} calc={calc} units={units} />}

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
