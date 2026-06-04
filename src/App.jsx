import { useState, useMemo, useEffect } from 'react';
import './styles.css';

import Header from './components/Header.jsx';
import Toolbar from './components/Toolbar.jsx';
import StairScene from './components/StairScene.jsx';
import RightPanel from './components/RightPanel.jsx';
import StatusBar from './components/StatusBar.jsx';

import { calcStair, buildMaterialList } from './geometry/stairMath.js';
import { validateStair } from './geometry/validation.js';
import { saveProjectJson, openProjectJson } from './utils/saveJson.js';
import { generatePdf } from './pdf/generatePdf.js';
import { saveProject } from './lib/saveProject.js';
import { DEFAULT_STAIR, DEFAULT_PROJECT } from './constants/defaults.js';
import { getManualPostTop, normalizeRailEndpoints, INtoU } from './geometry/railingGeometry.js';

export default function App() {
  const [project, setProject] = useState(DEFAULT_PROJECT);
  const [stairConfig, setStairConfig] = useState(DEFAULT_STAIR);
  const [units, setUnits] = useState('in');
  const [activeTool, setActiveTool] = useState('select');
  const [view, setView] = useState('3d');
  const [showDimensions, setShowDimensions] = useState(true);
  const [viewResetToken, setViewResetToken] = useState(0);

  const [manualPosts, setManualPosts] = useState([]);
  const [postPlacementMode, setPostPlacementMode] = useState(false);
  const [selectedManualPostId, setSelectedManualPostId] = useState(null);

  const [manualTopRails, setManualTopRails] = useState([]);
  const [topRailMode, setTopRailMode] = useState(false);
  const [topRailFirstPostId, setTopRailFirstPostId] = useState(null);
  const [selectedManualTopRailId, setSelectedManualTopRailId] = useState(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setPostPlacementMode(false);
        setTopRailMode(false);
        setTopRailFirstPostId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const calc = useMemo(() => calcStair(stairConfig), [stairConfig]);

  const warnings = useMemo(() => validateStair({
    angleDeg: calc.angleDeg,
    riserHeight: calc.riserHeight,
    treadDepth: calc.treadDepth,
    width: stairConfig.width,
    steps: stairConfig.steps,
    handrailHeight: stairConfig.handrailHeight,
    pinOpening: stairConfig.pinOpening,
    railingEnabled: stairConfig.railingEnabled,
    railingRunMode: stairConfig.railingRunMode,
    manualRailingRun: stairConfig.manualRailingRun,
    run: stairConfig.run,
    rawPostCount: calc.rawPostCount,
    postCountCapped: calc.postCountCapped,
    maxPostCount: calc.maxPostCount,
  }), [calc, stairConfig]);

  const materials = useMemo(() => buildMaterialList({
    width: stairConfig.width,
    steps: stairConfig.steps,
    stringerLength: calc.stringerLength,
    railingEnabled: stairConfig.railingEnabled,
    handrailHeight: stairConfig.handrailHeight,
    tubeSize: stairConfig.tubeSize,
    manualPosts,
    manualTopRails,
    treadPositions: calc.treadPositions,
    riserHeight: calc.riserHeight,
    run: stairConfig.run,
    bottomLandingEnabled: stairConfig.bottomLandingEnabled,
    bottomLandingLength: stairConfig.bottomLandingLength,
    topLandingEnabled: stairConfig.topLandingEnabled,
    topLandingLength: stairConfig.topLandingLength,
    bottomRailEnabled: stairConfig.bottomRailEnabled,
    bottomRailHeight: stairConfig.bottomRailHeight,
    middleRailEnabled: stairConfig.middleRailEnabled,
    middleRailHeights: stairConfig.middleRailHeights,
    middleRailHeight: stairConfig.middleRailHeight,
  }), [stairConfig, calc, manualPosts, manualTopRails]);

  const handleAddManualPost = (postData) => {
    const id = `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setManualPosts(prev => [...prev, { ...postData, id }]);
  };

  const handleUpdateManualPost = (id, changes) => {
    setManualPosts(prev => prev.map(p => p.id === id ? { ...p, ...changes } : p));
  };

  const handleDeleteManualPost = (id) => {
    const post = manualPosts.find(p => p.id === id);
    const postTop = post
      ? getManualPostTop(post, calc.treadPositions, calc.riserHeight, stairConfig.run)
      : null;

    setManualTopRails(prev => prev.map(rail => {
      const r = normalizeRailEndpoints(rail);
      let { startEndpoint, endEndpoint } = r;
      let changed = false;

      if (startEndpoint.anchorType === 'post' && startEndpoint.postId === id) {
        startEndpoint = {
          ...startEndpoint,
          anchorType: 'fixed',
          pointIn: postTop
            ? { xIn: postTop.x / INtoU, yIn: postTop.y / INtoU, zIn: postTop.z / INtoU }
            : startEndpoint.pointIn,
        };
        changed = true;
      }
      if (endEndpoint.anchorType === 'post' && endEndpoint.postId === id) {
        endEndpoint = {
          ...endEndpoint,
          anchorType: 'fixed',
          pointIn: postTop
            ? { xIn: postTop.x / INtoU, yIn: postTop.y / INtoU, zIn: postTop.z / INtoU }
            : endEndpoint.pointIn,
        };
        changed = true;
      }

      return changed ? { ...r, startEndpoint, endEndpoint } : r;
    }));

    setManualPosts(prev => prev.filter(p => p.id !== id));
    setSelectedManualPostId(null);
  };

  const handleSelectManualPost = (id) => {
    setSelectedManualPostId(prev => prev === id ? null : id);
  };

  const handleTogglePostPlacement = () => {
    setPostPlacementMode(prev => !prev);
    setSelectedManualPostId(null);
    setTopRailMode(false);
    setTopRailFirstPostId(null);
  };

  const handleToggleTopRailMode = () => {
    setTopRailMode(prev => !prev);
    setTopRailFirstPostId(null);
    setPostPlacementMode(false);
    setSelectedManualPostId(null);
  };

  const handleTopRailPostClick = (postId) => {
    if (!topRailFirstPostId) {
      setTopRailFirstPostId(postId);
    } else if (topRailFirstPostId === postId) {
      setTopRailFirstPostId(null);
    } else {
      const startId = topRailFirstPostId;
      const endId = postId;
      const duplicate = manualTopRails.some(
        r => (r.startPostId === startId && r.endPostId === endId) ||
             (r.startPostId === endId && r.endPostId === startId)
      );
      if (!duplicate) {
        const id = `rail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setManualTopRails(prev => [...prev, {
          id,
          startPostId: startId,
          endPostId: endId,
          profile: '2x1',
          startEndpoint: {
            anchorType: 'post',
            postId: startId,
            pointIn: null,
            extension: { type: 'none', lengthIn: 0 },
          },
          endEndpoint: {
            anchorType: 'post',
            postId: endId,
            pointIn: null,
            extension: { type: 'none', lengthIn: 0 },
          },
        }]);
      }
      setTopRailFirstPostId(null);
    }
  };

  const handleDeleteManualTopRail = (id) => {
    setManualTopRails(prev => prev.filter(r => r.id !== id));
    setSelectedManualTopRailId(prev => (prev === id ? null : prev));
  };

  const handleSelectManualTopRail = (id) => {
    setSelectedManualTopRailId(prev => (prev === id ? null : id));
  };

  const handleUpdateManualTopRail = (id, changes) => {
    setManualTopRails(prev => prev.map(r => r.id === id ? { ...r, ...changes } : r));
  };

  const handleOpenJson = () =>
    openProjectJson(
      ({ project: p, stairConfig: sc, units: u, manualPosts: mp, manualTopRails: mtr }) => {
        setProject({ ...DEFAULT_PROJECT, ...p });
        setStairConfig({ ...DEFAULT_STAIR, ...sc });
        if (u) setUnits(u);
        setManualPosts(Array.isArray(mp) ? mp : []);
        setManualTopRails(Array.isArray(mtr) ? mtr.map(normalizeRailEndpoints) : []);
        setSelectedManualPostId(null);
        setSelectedManualTopRailId(null);
        setPostPlacementMode(false);
        setTopRailMode(false);
        setTopRailFirstPostId(null);
      },
      (msg) => alert(`Could not open file: ${msg}`),
    );

  const handleSaveJson = () => saveProjectJson({ project, stairConfig, calc, warnings, materials, units, manualPosts, manualTopRails });

  const handleExportPdf = () => generatePdf({ project, stairConfig, calc, warnings, materials, units, manualPosts, manualTopRails });

  const handleSaveProject = () => saveProject({ project, stairConfig, calc, warnings, materials, manualPosts, manualTopRails });

  const handlePrint = () => window.print();

  const handleViewChange = (v) => {
    setView(v);
    setViewResetToken((t) => t + 1);
  };

  return (
    <div className="app-shell">
      <Header onOpenJson={handleOpenJson} onSaveJson={handleSaveJson} onExportPdf={handleExportPdf} onPrint={handlePrint} units={units} onUnitsChange={setUnits} />
      <Toolbar activeTool={activeTool} onToolSelect={setActiveTool} onViewChange={handleViewChange} showDimensions={showDimensions} onToggleDimensions={() => setShowDimensions((v) => !v)} />
      <StairScene
        stairConfig={stairConfig}
        calc={calc}
        view={view}
        viewResetToken={viewResetToken}
        units={units}
        showDimensions={showDimensions}
        activeTool={activeTool}
        manualPosts={manualPosts}
        postPlacementMode={postPlacementMode}
        onAddManualPost={handleAddManualPost}
        selectedManualPostId={selectedManualPostId}
        onSelectManualPost={handleSelectManualPost}
        topRailMode={topRailMode}
        topRailFirstPostId={topRailFirstPostId}
        onTopRailPostClick={handleTopRailPostClick}
        manualTopRails={manualTopRails}
        railingColorMode={stairConfig.railingColorMode}
      />
      <RightPanel
        project={project}
        setProject={setProject}
        stairConfig={stairConfig}
        setStairConfig={setStairConfig}
        calc={calc}
        warnings={warnings}
        materials={materials}
        onSaveProject={handleSaveProject}
        onExportPdf={handleExportPdf}
        units={units}
        manualPosts={manualPosts}
        postPlacementMode={postPlacementMode}
        onTogglePostPlacement={handleTogglePostPlacement}
        selectedManualPostId={selectedManualPostId}
        onUpdateManualPost={handleUpdateManualPost}
        onDeleteManualPost={handleDeleteManualPost}
        topRailMode={topRailMode}
        onToggleTopRailMode={handleToggleTopRailMode}
        topRailFirstPostId={topRailFirstPostId}
        manualTopRails={manualTopRails}
        onDeleteManualTopRail={handleDeleteManualTopRail}
        selectedManualTopRailId={selectedManualTopRailId}
        onSelectManualTopRail={handleSelectManualTopRail}
        onUpdateManualTopRail={handleUpdateManualTopRail}
      />
      <StatusBar activeTool={activeTool} calc={calc} warnings={warnings} units={units} />
    </div>
  );
}
