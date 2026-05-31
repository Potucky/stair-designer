import { useEffect, useRef, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { fmtUnit } from '../utils/format.js';

// Stair center Y in scene units for default config: 108in * 0.5 (INtoU) / 2 = 27
const SCENE_CENTER_Y = 27;

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, viewResetToken, camera, controlsRef]);

  return null;
}

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...tip, ...wingA, ...wingB]
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
  const { height, run, width, railingEnabled, handrailHeight, postSpacing } = stairConfig;

  const h = height * INtoU;
  const r = run * INtoU;
  const w = width * INtoU;
  const riserH = calc.riserHeight * INtoU;
  const treadD = calc.treadDepth * INtoU;
  const railH = handrailHeight * INtoU;
  const postSpU = Math.min(postSpacing, run) * INtoU;

  const riseX  = -r / 2 - 10;
  const runY   = -7;
  const widthX = r / 2 + 10;
  const riserX = r / 2 + 5;
  const treadY = h - riserH - 3;
  const railX  = -r / 2 - 20;
  const postSpY = h + railH + 6;

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
          <HDimX y={postSpY} z={0} x1={-r / 2} x2={-r / 2 + postSpU} label={`Post Sp: ${fmtUnit(postSpacing, units)}`} />
        </>
      )}
    </>
  );
}

function StairModel({ height, run, width, steps, railingEnabled, handrailHeight, postCount }) {
  const INtoU = 0.5;

  const h = height * INtoU;
  const r = run * INtoU;
  const w = width * INtoU;
  const riserH = steps > 0 ? h / steps : h;
  const treadD = steps > 0 ? r / steps : r;
  const railH = handrailHeight * INtoU;

  const stringerThick = 0.5;
  const treadThick = 0.3;
  const postThick = 0.4;
  const railThick = 0.35;

  const angleRad = Math.atan2(h, r);
  const stringerLen = Math.sqrt(h * h + r * r);

  const metalMat = <meshStandardMaterial color="#475569" metalness={0.55} roughness={0.35} />;
  const handrailMat = <meshStandardMaterial color="#1e3a5f" metalness={0.65} roughness={0.3} />;
  const treadMat = <meshStandardMaterial color="#64748b" metalness={0.4} roughness={0.5} />;

  const treads = [];
  for (let i = 0; i < steps; i++) {
    const tx = (i + 0.5) * treadD;
    const ty = (i + 1) * riserH;
    treads.push(
      <mesh key={i} position={[tx - r / 2, ty - riserH / 2 + treadThick / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[treadD, treadThick, w]} />
        {treadMat}
      </mesh>
    );
  }

  const posts = [];
  if (railingEnabled && postCount > 0) {
    for (let i = 0; i < postCount; i++) {
      const t = i / Math.max(postCount - 1, 1);
      const px = t * r - r / 2;
      const py = t * h;
      const side = w / 2 + postThick / 2;

      [-side, side].forEach((zOff, si) => {
        posts.push(
          <mesh key={`${i}-${si}`} position={[px, py + railH / 2, zOff]} castShadow>
            <boxGeometry args={[postThick, railH, postThick]} />
            {handrailMat}
          </mesh>
        );
      });
    }

    [-w / 2 - postThick / 2, w / 2 + postThick / 2].forEach((zOff, si) => {
      posts.push(
        <mesh
          key={`rail-${si}`}
          position={[0, h / 2 + railH, zOff]}
          rotation={[0, 0, -angleRad]}
          castShadow
        >
          <boxGeometry args={[stringerLen, railThick, railThick]} />
          {handrailMat}
        </mesh>
      );
    });
  }

  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, h / 2, -w / 2]} rotation={[0, 0, -angleRad]} castShadow>
        <boxGeometry args={[stringerLen, stringerThick, stringerThick]} />
        {metalMat}
      </mesh>
      <mesh position={[0, h / 2, w / 2]} rotation={[0, 0, -angleRad]} castShadow>
        <boxGeometry args={[stringerLen, stringerThick, stringerThick]} />
        {metalMat}
      </mesh>
      {treads}
      {posts}
    </group>
  );
}

export default function StairScene({ stairConfig, calc, view, viewResetToken, units, showDimensions }) {
  const { height, run, width, steps, railingEnabled, handrailHeight } = stairConfig;
  const orbitRef = useRef();

  return (
    <div className="scene-container">
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
          railingEnabled={railingEnabled}
          handrailHeight={handrailHeight}
          postCount={calc.postCount}
        />

        {showDimensions && <DimensionLabels stairConfig={stairConfig} calc={calc} units={units} />}

        <OrbitControls
          ref={orbitRef}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          screenSpacePanning
          panSpeed={1.2}
        />
      </Canvas>
    </div>
  );
}
