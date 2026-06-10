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
import { printViewportPdf } from './pdf/printViewport.js';
import { saveProject } from './lib/saveProject.js';
import { loadProject } from './lib/loadProject.js';
import { DEFAULT_STAIR, DEFAULT_PROJECT } from './constants/defaults.js';
import { normalizeRailEndpoints } from './geometry/railingGeometry.js';

const LS_KEY = 'stairDesigner_autosave';

let _cachedDraft;
function loadInitialDraft() {
  if (_cachedDraft !== undefined) return _cachedDraft;
  try {
    const raw = localStorage.getItem(LS_KEY);
    _cachedDraft = raw ? JSON.parse(raw) : null;
  } catch {
    _cachedDraft = null;
  }
  return _cachedDraft;
}

export default function App() {
  const [project, setProject] = useState(() => {
    const d = loadInitialDraft();
    return d?.project ? { ...DEFAULT_PROJECT, ...d.project } : DEFAULT_PROJECT;
  });
  const [stairConfig, setStairConfig] = useState(() => {
    const d = loadInitialDraft();
    return d?.stairConfig ? { ...DEFAULT_STAIR, ...d.stairConfig } : DEFAULT_STAIR;
  });
  const [units, setUnits] = useState(() => {
    const d = loadInitialDraft();
    const u = d?.units;
    return u === 'mm' || u === 'in' ? u : 'in';
  });
  const [activeTool, setActiveTool] = useState('select');
  const [view, setView] = useState('3d');
  const [showDimensions, setShowDimensions] = useState(true);
  const [viewResetToken, setViewResetToken] = useState(0);
  const skipAutosaveRestoreRef = useRef(false);

  const [currentProjectId, setCurrentProjectId] = useState(() => {
    const d = loadInitialDraft();
    return typeof d?.currentProjectId === 'string' && d.currentProjectId ? d.currentProjectId : null;
  });
  const [openProjectModalOpen, setOpenProjectModalOpen] = useState(false);

  const [manualDimensions, setManualDimensions] = useState(() => {
    const d = loadInitialDraft();
    return Array.isArray(d?.manualDimensions) ? d.manualDimensions : [];
  });
  const [manualTextAnnotations, setManualTextAnnotations] = useState(() => {
    const d = loadInitialDraft();
    return Array.isArray(d?.manualTextAnnotations) ? d.manualTextAnnotations : [];
  });

  const [manualPosts, setManualPosts] = useState(() => {
    const d = loadInitialDraft();
    return Array.isArray(d?.manualPosts) ? d.manualPosts : [];
  });
  const [postPlacementMode, setPostPlacementMode] = useState(false);
  const [selectedManualPostId, setSelectedManualPostId] = useState(null);

  const [manualTopRails, setManualTopRails] = useState(() => {
    const d = loadInitialDraft();
    return Array.isArray(d?.manualTopRails) ? d.manualTopRails.map(normalizeRailEndpoints) : [];
  });
  const [topRailMode, setTopRailMode] = useState(false);
  const [topRailFirstPostId, setTopRailFirstPostId] = useState(null);
  const [selectedManualTopRailId, setSelectedManualTopRailId] = useState(null);
  const [topRailPathMode, setTopRailPathMode] = useState(() => {
    const d = loadInitialDraft();
    return d?.topRailPathMode === 'manual' || d?.topRailPathMode === 'standard' ? d.topRailPathMode : 'standard';
  });

  const [fastRailsMode, setFastRailsMode] = useState(false);
  const [fastRailsPrevPostId, setFastRailsPrevPostId] = useState(null);

  const [structureOffsetXIn, setStructureOffsetXIn] = useState(() => {
    const d = loadInitialDraft();
    return typeof d?.structureOffsetXIn === 'number' ? d.structureOffsetXIn : 0;
  });
  const [structureOffsetZIn, setStructureOffsetZIn] = useState(() => {
    const d = loadInitialDraft();
    return typeof d?.structureOffsetZIn === 'number' ? d.structureOffsetZIn : 0;
  });
  const [pdfMirrored, setPdfMirrored] = useState(() => {
    const d = loadInitialDraft();
    return d?.pdfMirrored === true;
  });
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

  const handleDeleteManualPost = (id) => {
    setManualTopRails(prev => {
      const next = prev.filter(rail => {
        const r = normalizeRailEndpoints(rail);
        const startConnected = r.startEndpoint.anchorType === 'post' && r.startEndpoint.postId === id;
        const endConnected = r.endEndpoint.anchorType === 'post' && r.endEndpoint.postId === id;
        return !startConnected && !endConnected;
      });
      const removedIds = new Set(prev.filter(r => !next.includes(r)).map(r => r.id));
      if (removedIds.size > 0) {
        setSelectedManualTopRailId(cur => (removedIds.has(cur) ? null : cur));
      }
      return next;
    });
    setManualPosts(prev => prev.filter(p => p.id !== id));
    setSelectedManualPostId(null);
  };

  const handleDeleteManualTopRail = (id) => {
    setManualTopRails(prev => prev.filter(r => r.id !== id));
    setSelectedManualTopRailId(prev => (prev === id ? null : prev));
  };

  useEffect(() => {
    const onDeleteKey = (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if (selectedManualPostId) {
        handleDeleteManualPost(selectedManualPostId);
      } else if (selectedManualTopRailId) {
        handleDeleteManualTopRail(selectedManualTopRailId);
      }
    };
    window.addEventListener('keydown', onDeleteKey);
    return () => window.removeEventListener('keydown', onDeleteKey);
  }, [selectedManualPostId, selectedManualTopRailId]);

  // Autosave current project state to localStorage after every change (debounced)
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const snapshot = {
          project,
          stairConfig,
          units,
          manualDimensions,
          manualTextAnnotations,
          manualPosts,
          manualTopRails,
          structureOffsetXIn,
          structureOffsetZIn,
          pdfMirrored,
          topRailPathMode,
          currentProjectId,
        };
        localStorage.setItem(LS_KEY, JSON.stringify(snapshot));
      } catch {
        // Storage full or unavailable — ignore
      }
    }, 500);
    return () => clearTimeout(id);
  }, [project, stairConfig, units, manualDimensions, manualTextAnnotations, manualPosts, manualTopRails, structureOffsetXIn, structureOffsetZIn, pdfMirrored, topRailPathMode, currentProjectId]);

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

  const handleAddManualDimension = (dimData) => {
    setManualDimensions(prev => [...prev, dimData]);
  };

  const handleUndoLastManualDimension = () => {
    setManualDimensions(prev => prev.slice(0, -1));
  };

  const handleUpdateManualDimension = (id, changes) => {
    setManualDimensions(prev => prev.map(d => d.id === id ? { ...d, ...changes } : d));
  };

  const handleDeleteManualDimension = (id) => {
    setManualDimensions(prev => prev.filter(d => d.id !== id));
  };

  const handleAddManualTextAnnotation = (annotData) => {
    setManualTextAnnotations(prev => [...prev, annotData]);
  };

  const handleUpdateManualTextAnnotation = (id, changes) => {
    setManualTextAnnotations(prev => prev.map(a => a.id === id ? { ...a, ...changes } : a));
  };

  const handleDeleteManualTextAnnotation = (id) => {
    setManualTextAnnotations(prev => prev.filter(a => a.id !== id));
  };

  const handleAddManualPost = (postData) => {
    const id = `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setManualPosts(prev => [...prev, { ...postData, id }]);
  };

  const handleUpdateManualPost = (id, changes) => {
    setManualPosts(prev => prev.map(p => p.id === id ? { ...p, ...changes } : p));
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

  const handleSelectManualTopRail = (id) => {
    setSelectedManualTopRailId(prev => (prev === id ? null : id));
  };

  const handleUpdateManualTopRail = (id, changes) => {
    setManualTopRails(prev => prev.map(r => r.id === id ? { ...r, ...changes } : r));
  };

  const handleTogglePdfMirrored = () => setPdfMirrored(prev => !prev);
  const handleToggleStructureMove = () => setStructureMoveSelected(prev => !prev);
  const handleMoveForward = () => setStructureOffsetXIn(prev => prev + 6);
  const handleMoveBack = () => setStructureOffsetXIn(prev => prev - 6);
  const handleMoveLeft = () => setStructureOffsetZIn(prev => prev - 6);
  const handleMoveRight = () => setStructureOffsetZIn(prev => prev + 6);
  const handleResetStructureOffset = () => { setStructureOffsetXIn(0); setStructureOffsetZIn(0); };

  const handleNewProject = () => {
    const hasObjects = manualPosts.length > 0 || manualTopRails.length > 0 || manualDimensions.length > 0 || manualTextAnnotations.length > 0;
    if (hasObjects && !window.confirm('Start a new project? Current unsaved changes will be cleared.')) return;
    localStorage.removeItem(LS_KEY);
    setProject(DEFAULT_PROJECT);
    setStairConfig({ ...DEFAULT_STAIR, steps: 6, bottomLandingEnabled: true, topLandingEnabled: true });
    setManualDimensions([]);
    setManualTextAnnotations([]);
    setManualPosts([]);
    setManualTopRails([]);
    setSelectedManualPostId(null);
    setSelectedManualTopRailId(null);
    setTopRailFirstPostId(null);
    setFastRailsPrevPostId(null);
    setPostPlacementMode(false);
    setTopRailMode(false);
    setFastRailsMode(false);
    setTopRailPathMode('standard');
    setStructureMoveSelected(false);
    setStructureOffsetXIn(0);
    setStructureOffsetZIn(0);
    setPdfMirrored(false);
    setCurrentProjectId(null);
  };

  const handleOpenJson = () =>
    openProjectJson(
      ({ project: p, stairConfig: sc, units: u, manualDimensions: mdi, manualPosts: mp, manualTopRails: mtr, structureOffsetXIn: sox, structureOffsetZIn: soz, pdfMirrored: pm, topRailPathMode: trpm, manualTextAnnotations: mta }) => {
        skipAutosaveRestoreRef.current = true;
        setProject({ ...DEFAULT_PROJECT, ...p });
        setStairConfig({ ...DEFAULT_STAIR, ...sc });
        if (u) setUnits(u);
        setManualDimensions(Array.isArray(mdi) ? mdi : []);
        setManualTextAnnotations(Array.isArray(mta) ? mta : []);
        setManualPosts(Array.isArray(mp) ? mp : []);
        setManualTopRails(Array.isArray(mtr) ? mtr.map(normalizeRailEndpoints) : []);
        if (typeof sox === 'number') setStructureOffsetXIn(sox);
        if (typeof soz === 'number') setStructureOffsetZIn(soz);
        setPdfMirrored(pm === true);
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

  const handleSaveJson = () => saveProjectJson({ project, stairConfig, calc, warnings, materials, units, manualDimensions, manualPosts, manualTopRails, structureOffsetXIn, structureOffsetZIn, pdfMirrored, topRailPathMode, manualTextAnnotations });

  const handleExportPdf = () => generatePdf({ project, stairConfig, calc, warnings, materials, units, manualDimensions, manualPosts, manualTopRails, pdfMirrored, topRailPathMode, manualTextAnnotations });

  const handleSaveProject = async () => {
    const result = await saveProject({ project, stairConfig, calc, warnings, materials, manualDimensions, manualPosts, manualTopRails, manualTextAnnotations, structureOffsetXIn, structureOffsetZIn, pdfMirrored, topRailPathMode, units, currentProjectId });
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
    setManualDimensions(Array.isArray(sc.manualDimensions) ? sc.manualDimensions : []);
    setManualTextAnnotations(Array.isArray(sc.manualTextAnnotations) ? sc.manualTextAnnotations : []);
    setManualPosts(Array.isArray(v.manual_posts) ? v.manual_posts : []);
    setManualTopRails(Array.isArray(v.manual_top_rails) ? v.manual_top_rails.map(normalizeRailEndpoints) : []);
    if (typeof sc.structureOffsetXIn === 'number') setStructureOffsetXIn(sc.structureOffsetXIn);
    else setStructureOffsetXIn(0);
    if (typeof sc.structureOffsetZIn === 'number') setStructureOffsetZIn(sc.structureOffsetZIn);
    else setStructureOffsetZIn(0);
    setPdfMirrored(sc.pdfMirrored === true);
    if (sc.topRailPathMode === 'manual' || sc.topRailPathMode === 'standard') setTopRailPathMode(sc.topRailPathMode);
    else setTopRailPathMode('standard');
    const validUnit = (u) => u === 'in' || u === 'mm';
    setUnits(validUnit(sc.units) ? sc.units : validUnit(p.units) ? p.units : 'in');
    setSelectedManualPostId(null);
    setSelectedManualTopRailId(null);
    setPostPlacementMode(false);
    setTopRailMode(false);
    setTopRailFirstPostId(null);
    setCurrentProjectId(p.id);
  };

  const handlePrint = () => {
    printViewportPdf();
  };

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
      <Toolbar activeTool={activeTool} onToolSelect={setActiveTool} onViewChange={handleViewChange} showDimensions={showDimensions} onToggleDimensions={() => setShowDimensions((v) => !v)} manualDimensionsCount={manualDimensions.length} onUndoLastManualDimension={handleUndoLastManualDimension} />
      <StairScene
        stairConfig={stairConfig}
        calc={calc}
        view={view}
        viewResetToken={viewResetToken}
        units={units}
        showDimensions={showDimensions}
        modalOpen={openProjectModalOpen}
        activeTool={activeTool}
        manualDimensions={manualDimensions}
        onAddManualDimension={handleAddManualDimension}
        manualTextAnnotations={manualTextAnnotations}
        onAddManualTextAnnotation={handleAddManualTextAnnotation}
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
        onNewProject={handleNewProject}
        onSaveProject={handleSaveProject}
        onOpenProject={() => setOpenProjectModalOpen(true)}
        onExportPdf={handleExportPdf}
        units={units}
        activeTool={activeTool}
        manualDimensions={manualDimensions}
        onUpdateManualDimension={handleUpdateManualDimension}
        onDeleteManualDimension={handleDeleteManualDimension}
        manualTextAnnotations={manualTextAnnotations}
        onUpdateManualTextAnnotation={handleUpdateManualTextAnnotation}
        onDeleteManualTextAnnotation={handleDeleteManualTextAnnotation}
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
        pdfMirrored={pdfMirrored}
        onTogglePdfMirrored={handleTogglePdfMirrored}
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
