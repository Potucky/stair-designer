import { useState, useMemo, useEffect, useRef } from 'react';
import './styles.css';

import Header from './components/Header.jsx';
import Toolbar from './components/Toolbar.jsx';
import StairScene from './components/StairScene.jsx';
import RightPanel from './components/RightPanel.jsx';
import StatusBar from './components/StatusBar.jsx';
import OpenProjectModal from './components/OpenProjectModal.jsx';

import { calcStair, buildMaterialList } from './geometry/stairMath.js';
import { validateStair } from './geometry/validation.js';
import { saveProjectJson, openProjectJson } from './utils/saveJson.js';
import { generatePdf } from './pdf/generatePdf.js';
import { saveProject } from './lib/saveProject.js';
import { loadProject } from './lib/loadProject.js';
import { DEFAULT_STAIR, DEFAULT_PROJECT } from './constants/defaults.js';
import { getManualPostTop, normalizeRailEndpoints, INtoU } from './geometry/railingGeometry.js';

const LS_KEY = 'stairDesigner_autosave';

export default function App() {
  const [project, setProject] = useState(DEFAULT_PROJECT);
  const [stairConfig, setStairConfig] = useState(DEFAULT_STAIR);
  const [units, setUnits] = useState('in');
  const [activeTool, setActiveTool] = useState('select');
  const [view, setView] = useState('3d');
  const [showDimensions, setShowDimensions] = useState(true);
  const [viewResetToken, setViewResetToken] = useState(0);
  const skipAutosaveRestoreRef = useRef(false);

  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [openProjectModalOpen, setOpenProjectModalOpen] = useState(false);

  const [manualPosts, setManualPosts] = useState([]);
  const [postPlacementMode, setPostPlacementMode] = useState(false);
  const [selectedManualPostId, setSelectedManualPostId] = useState(null);

  const [manualTopRails, setManualTopRails] = useState([]);
  const [topRailMode, setTopRailMode] = useState(false);
  const [topRailFirstPostId, setTopRailFirstPostId] = useState(null);
  const [selectedManualTopRailId, setSelectedManualTopRailId] = useState(null);
  const [topRailPathMode, setTopRailPathMode] = useState('standard');

  const [fastRailsMode, setFastRailsMode] = useState(false);
  const [fastRailsPrevPostId, setFastRailsPrevPostId] = useState(null);

  const [structureOffsetXIn, setStructureOffsetXIn] = useState(0);
  const [structureOffsetZIn, setStructureOffsetZIn] = useState(0);
  const [structureMoveSelected, setStructureMoveSelected] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setPostPlacementMode(false);
        setTopRailMode(false);
        setTopRailFirstPostId(null);
        setFastRailsMode(false);
        setFastRailsPrevPostId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Restore from localStorage on mount (runs once, before first user action)
  useEffect(() => {
    if (skipAutosaveRestoreRef.current) return;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.project) setProject((p) => ({ ...p, ...data.project }));
      if (data.stairConfig) setStairConfig((s) => ({ ...DEFAULT_STAIR, ...s, ...data.stairConfig }));
      if (data.units === 'mm' || data.units === 'in') setUnits(data.units);
      if (Array.isArray(data.manualPosts)) setManualPosts(data.manualPosts);
      if (Array.isArray(data.manualTopRails)) setManualTopRails(data.manualTopRails.map(normalizeRailEndpoints));
      if (typeof data.structureOffsetXIn === 'number') setStructureOffsetXIn(data.structureOffsetXIn);
      if (typeof data.structureOffsetZIn === 'number') setStructureOffsetZIn(data.structureOffsetZIn);
      if (data.topRailPathMode === 'manual' || data.topRailPathMode === 'standard') setTopRailPathMode(data.topRailPathMode);
      if (typeof data.currentProjectId === 'string' && data.currentProjectId) {
        setCurrentProjectId(data.currentProjectId);
      }
    } catch {
      // Corrupt localStorage — ignore
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave current project state to localStorage after every change (debounced)
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const snapshot = {
          project,
          stairConfig,
          units,
          manualPosts,
          manualTopRails,
          structureOffsetXIn,
          structureOffsetZIn,
          topRailPathMode,
          currentProjectId,
        };
        localStorage.setItem(LS_KEY, JSON.stringify(snapshot));
      } catch {
        // Storage full or unavailable — ignore
      }
    }, 500);
    return () => clearTimeout(id);
  }, [project, stairConfig, units, manualPosts, manualTopRails, structureOffsetXIn, structureOffsetZIn, topRailPathMode, currentProjectId]);

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
    railLowerExtensionIn: stairConfig.railLowerExtensionIn ?? 0,
    railUpperExtensionIn: stairConfig.railUpperExtensionIn ?? 0,
    topRailPathMode,
  }), [stairConfig, calc, manualPosts, manualTopRails, topRailPathMode]);

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
    setFastRailsMode(false);
    setFastRailsPrevPostId(null);
  };

  const handleToggleTopRailMode = () => {
    setTopRailMode(prev => !prev);
    setTopRailFirstPostId(null);
    setPostPlacementMode(false);
    setSelectedManualPostId(null);
    setFastRailsMode(false);
    setFastRailsPrevPostId(null);
  };

  const handleToggleFastRailsMode = () => {
    setFastRailsMode(prev => {
      if (!prev) {
        setPostPlacementMode(false);
        setTopRailMode(false);
        setTopRailFirstPostId(null);
      }
      setFastRailsPrevPostId(null);
      return !prev;
    });
  };

  const handleFastRailsPost = (postData) => {
    const newId = `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setManualPosts(prev => [...prev, { ...postData, id: newId }]);
    setSelectedManualPostId(newId);

    if (fastRailsPrevPostId) {
      const prevId = fastRailsPrevPostId;
      const duplicate = manualTopRails.some(
        r => (r.startPostId === prevId && r.endPostId === newId) ||
             (r.startPostId === newId && r.endPostId === prevId)
      );
      if (!duplicate) {
        const railId = `rail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setManualTopRails(prev => [...prev, {
          id: railId,
          startPostId: prevId,
          endPostId: newId,
          profile: '2x1',
          startEndpoint: { anchorType: 'post', postId: prevId, pointIn: null, extension: { type: 'none', lengthIn: 0 } },
          endEndpoint: { anchorType: 'post', postId: newId, pointIn: null, extension: { type: 'none', lengthIn: 0 } },
        }]);
      }
    }

    setFastRailsPrevPostId(newId);
  };

  const handleFastRailsPostSelect = (id) => {
    setFastRailsPrevPostId(id);
    setSelectedManualPostId(id);
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

  const handleToggleStructureMove = () => setStructureMoveSelected(prev => !prev);
  const handleMoveForward = () => setStructureOffsetXIn(prev => prev + 6);
  const handleMoveBack = () => setStructureOffsetXIn(prev => prev - 6);
  const handleMoveLeft = () => setStructureOffsetZIn(prev => prev - 6);
  const handleMoveRight = () => setStructureOffsetZIn(prev => prev + 6);
  const handleResetStructureOffset = () => { setStructureOffsetXIn(0); setStructureOffsetZIn(0); };

  const handleOpenJson = () =>
    openProjectJson(
      ({ project: p, stairConfig: sc, units: u, manualPosts: mp, manualTopRails: mtr, structureOffsetXIn: sox, structureOffsetZIn: soz, topRailPathMode: trpm }) => {
        skipAutosaveRestoreRef.current = true;
        setProject({ ...DEFAULT_PROJECT, ...p });
        setStairConfig({ ...DEFAULT_STAIR, ...sc });
        if (u) setUnits(u);
        setManualPosts(Array.isArray(mp) ? mp : []);
        setManualTopRails(Array.isArray(mtr) ? mtr.map(normalizeRailEndpoints) : []);
        if (typeof sox === 'number') setStructureOffsetXIn(sox);
        if (typeof soz === 'number') setStructureOffsetZIn(soz);
        if (trpm) setTopRailPathMode(trpm);
        setSelectedManualPostId(null);
        setSelectedManualTopRailId(null);
        setPostPlacementMode(false);
        setTopRailMode(false);
        setTopRailFirstPostId(null);
        // Imported from file — not associated with any Supabase project
        setCurrentProjectId(null);
      },
      (msg) => alert(`Could not open file: ${msg}`),
    );

  const handleSaveJson = () => saveProjectJson({ project, stairConfig, calc, warnings, materials, units, manualPosts, manualTopRails, structureOffsetXIn, structureOffsetZIn, topRailPathMode });

  const handleExportPdf = () => generatePdf({ project, stairConfig, calc, warnings, materials, units, manualPosts, manualTopRails, structureOffsetZIn, topRailPathMode });

  const handleSaveProject = async () => {
    const result = await saveProject({ project, stairConfig, calc, warnings, materials, manualPosts, manualTopRails, structureOffsetXIn, structureOffsetZIn, topRailPathMode, currentProjectId });
    if (result.ok && result.projectId) {
      setCurrentProjectId(result.projectId);
    }
    return result;
  };

  const handleSelectProject = async (projectId) => {
    setOpenProjectModalOpen(false);
    const result = await loadProject(projectId);
    if (!result.ok) {
      alert(`Could not load project: ${result.error}`);
      return;
    }
    const { project: p, version: v } = result;
    const sc = v.stair_config ?? {};
    skipAutosaveRestoreRef.current = true;
    setProject({ name: p.project_name ?? '', client: p.client_name ?? '' });
    setStairConfig({ ...DEFAULT_STAIR, ...sc });
    setManualPosts(Array.isArray(v.manual_posts) ? v.manual_posts : []);
    setManualTopRails(Array.isArray(v.manual_top_rails) ? v.manual_top_rails.map(normalizeRailEndpoints) : []);
    if (typeof sc.structureOffsetXIn === 'number') setStructureOffsetXIn(sc.structureOffsetXIn);
    else setStructureOffsetXIn(0);
    if (typeof sc.structureOffsetZIn === 'number') setStructureOffsetZIn(sc.structureOffsetZIn);
    else setStructureOffsetZIn(0);
    if (sc.topRailPathMode === 'manual' || sc.topRailPathMode === 'standard') setTopRailPathMode(sc.topRailPathMode);
    else setTopRailPathMode('standard');
    setSelectedManualPostId(null);
    setSelectedManualTopRailId(null);
    setPostPlacementMode(false);
    setTopRailMode(false);
    setTopRailFirstPostId(null);
    setCurrentProjectId(p.id);
  };

  const handlePrint = () => window.print();

  const handleViewChange = (v) => {
    setView(v);
    setViewResetToken((t) => t + 1);
  };

  return (
    <div className="app-shell">
      <Header
        onOpenJson={handleOpenJson}
        onSaveJson={handleSaveJson}
        onExportPdf={handleExportPdf}
        onPrint={handlePrint}
        units={units}
        onUnitsChange={setUnits}
        onOpenProject={() => setOpenProjectModalOpen(true)}
      />
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
        structureOffsetXIn={structureOffsetXIn}
        structureOffsetZIn={structureOffsetZIn}
        topRailPathMode={topRailPathMode}
        fastRailsMode={fastRailsMode}
        fastRailsPrevPostId={fastRailsPrevPostId}
        onFastRailsPost={handleFastRailsPost}
        onFastRailsPostSelect={handleFastRailsPostSelect}
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
        onOpenProject={() => setOpenProjectModalOpen(true)}
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
        topRailPathMode={topRailPathMode}
        onTopRailPathModeChange={setTopRailPathMode}
        structureMoveSelected={structureMoveSelected}
        onToggleStructureMove={handleToggleStructureMove}
        onMoveForward={handleMoveForward}
        onMoveBack={handleMoveBack}
        onMoveLeft={handleMoveLeft}
        onMoveRight={handleMoveRight}
        onResetStructureOffset={handleResetStructureOffset}
        structureOffsetXIn={structureOffsetXIn}
        structureOffsetZIn={structureOffsetZIn}
        fastRailsMode={fastRailsMode}
        fastRailsPrevPostId={fastRailsPrevPostId}
        onToggleFastRailsMode={handleToggleFastRailsMode}
      />
      <StatusBar activeTool={activeTool} calc={calc} warnings={warnings} units={units} />
      {openProjectModalOpen && (
        <OpenProjectModal
          onSelect={handleSelectProject}
          onClose={() => setOpenProjectModalOpen(false)}
        />
      )}
    </div>
  );
}
