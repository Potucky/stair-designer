import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';

function CameraController({ view }) {
  const { camera } = useThree();

  useEffect(() => {
    if (view === 'top') {
      camera.position.set(0, 120, 0.01);
      camera.up.set(0, 0, -1);
    } else if (view === 'side') {
      camera.position.set(120, 60, 0);
      camera.up.set(0, 1, 0);
    } else {
      camera.position.set(80, 80, 120);
      camera.up.set(0, 1, 0);
    }
    camera.lookAt(0, 30, 0);
    camera.updateProjectionMatrix();
  }, [view, camera]);

  return null;
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

export default function StairScene({ stairConfig, calc, view }) {
  const { height, run, width, steps, railingEnabled, handrailHeight } = stairConfig;

  return (
    <div className="scene-container">
      <Canvas
        camera={{ position: [80, 80, 120], fov: 45, near: 0.1, far: 5000 }}
        shadows
      >
        <color attach="background" args={['#edf2f7']} />

        <CameraController view={view} />

        <ambientLight intensity={1.1} />
        <directionalLight position={[100, 200, 100]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-80, 100, -60]} intensity={0.5} />
        <directionalLight position={[0, -50, 80]} intensity={0.12} />

        <Grid
          args={[500, 500]}
          cellSize={10}
          cellThickness={0.35}
          cellColor="#c8d0dc"
          sectionSize={50}
          sectionThickness={0.8}
          sectionColor="#9aabbf"
          fadeDistance={600}
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

        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      </Canvas>
    </div>
  );
}
