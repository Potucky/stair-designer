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
import { normalizeRailEndpoints, normalizeSection, resolveCompactPostAnchors } from './geometry/railingGeometry.js';

const SECTION_KEYS = ['post1Section', 'post2Section', 'handrailSection', 'bottomChannelSection', 'picketVerticalSection', 'picketHorizontalSection'];

const STAIR_CHECK_KEYS = [
  'height', 'run', 'width', 'steps', 'tubeSize',
  'railingEnabled', 'handrailHeight', 'pinOpening', 'postSpacing',
  'railingRunMode', 'manualRailingRun',
  'bottomLandingEnabled', 'bottomLandingLength',
  'topLandingEnabled', 'topLandingLength', 'topLandingWidth',
  'bottomRailEnabled', 'bottomRailHeight', 'middleRailEnabled',
  'railingColorMode', 'railingSideMode',
  'railLowerExtensionIn', 'railUpperExtensionIn',
  'post1HeightIn', 'post1Section', 'post1Thickness',
  'post2HeightIn', 'post2Section', 'post2Thickness',
  'compactTopHandrailEnabled', 'handrailSection',
  'compactBottomChannelEnabled', 'bottomChannelSection',
  'infillType', 'cableSize', 'cableFinish',
  'picketVerticalSection', 'picketVerticalThickness',
  'picketHorizontalSection', 'picketHorizontalThickness',
  'verticalPicketThicknessIn', 'horizontalPicketThicknessIn',
  'horizontalCableDiameterIn',
];

const BUILD_AUTOSAVE_KEY = 'stair-designer-build-autosave';
const MEASURE_AUTOSAVE_KEY = 'stair-designer-measure-autosave';
const LEGACY_AUTOSAVE_KEY = 'stairDesigner_autosave';

let _cachedBuildDraft;
function loadBuildDraft() {
  if (_cachedBuildDraft !== undefined) return _cachedBuildDraft;
  try {
    const raw = localStorage.getItem(BUILD_AUTOSAVE_KEY);
    if (raw) { _cachedBuildDraft = JSON.parse(raw); return _cachedBuildDraft; }
  } catch { /* fall through to legacy */ }
  try {
    const raw = localStorage.getItem(LEGACY_AUTOSAVE_KEY);
    _cachedBuildDraft = raw ? JSON.parse(raw) : null;
  } catch {
    _cachedBuildDraft = null;
  }
  return _cachedBuildDraft;
}

let _cachedMeasureDraft;
function loadMeasureDraft() {
  if (_cachedMeasureDraft !== undefined) return _cachedMeasureDraft;
  try {
    const raw = localStorage.getItem(MEASURE_AUTOSAVE_KEY);
    _cachedMeasureDraft = raw ? JSON.parse(raw) : null;
  } catch {
    _cachedMeasureDraft = null;
  }
  return _cachedMeasureDraft;
}

// --- Department separation helpers (Step 1: state boundary foundation) ---
// iBuild and iMeasure are separate departments sharing the same geometry engine.
// Step 1 creates internal state shells; later steps will route scene/save/autosave by department.

function createDefaultIMeasureConfig() {
  return {
    angleDeg: 0,
    postCenterDistanceIn: 0,
    overallHeightIn: 36,
    bcLowP1In: 0,
    bcLowP2In: 0,
    bcHeightIn: 0,
    stepSizeRangeText: '',
    stepSizeDistanceIn: 0,
  };
}

function createDefaultBuildShell() {
  return {
    projectName: '',
    clientName: '',
    currentProjectId: null,
    // iBuild domain state lives in existing top-level state vars (project, stairConfig, etc.)
  };
}

function createDefaultMeasureShell() {
  return {
    projectName: '',
    clientName: '',
    currentProjectId: null,
    iMeasureConfig: createDefaultIMeasureConfig(),
    // Future: progressive iMeasure geometry will be derived and stored here.
  };
}

// projectMode already drives the UI switch; treat it as the canonical department flag.
function getActiveDepartment(projectMode) {
  return projectMode === 'measure' ? 'measure' : 'build';
}

function getActiveProjectShell(department, buildShell, measureShell) {
  return department === 'measure' ? measureShell : buildShell;
}

export default function App() {
  const [project, setProject] = useState(() => {
    const d = loadBuildDraft();
    return d?.project ? { ...DEFAULT_PROJECT, ...d.project } : DEFAULT_PROJECT;
  });
  const [stairConfig, setStairConfig] = useState(() => {
    const d = loadBuildDraft();
    const cfg = d?.stairConfig ? { ...DEFAULT_STAIR, ...d.stairConfig } : { ...DEFAULT_STAIR };
    cfg.bottomLandingEnabled = true;
    cfg.topLandingEnabled = true;
    for (const key of SECTION_KEYS) {
      if (cfg[key]) cfg[key] = normalizeSection(cfg[key], DEFAULT_STAIR[key]);
    }
    return cfg;
  });
  const [units, setUnits] = useState(() => {
    const d = loadBuildDraft();
    const u = d?.units;
    return u === 'mm' ? 'mm' : u === 'in16' ? 'in16' : 'in8';
  });
  const [projectMode, setProjectMode] = useState('build');

  // Step 1: Department shell state. Not yet used for routing — exists as a clean boundary.
  // iBuild source-of-truth remains in existing state vars; shells hold only metadata.
  const [buildProjectShell, setBuildProjectShell] = useState(createDefaultBuildShell);
  const [measureProjectShell, setMeasureProjectShell] = useState(() => {
    const d = loadMeasureDraft();
    if (!d) return createDefaultMeasureShell();
    return {
      ...createDefaultMeasureShell(),
      projectName: d.projectName ?? '',
      clientName: d.clientName ?? '',
      currentProjectId: d.currentProjectId ?? null,
      iMeasureConfig: { ...createDefaultIMeasureConfig(), ...(d.iMeasureConfig ?? {}) },
    };
  });

  const [iMeasureConfig, setIMeasureConfig] = useState(() => {
    const d = loadMeasureDraft();
    return { ...createDefaultIMeasureConfig(), ...(d?.iMeasureConfig ?? {}) };
  });
  const [activeTool, setActiveTool] = useState('select');
  const [view, setView] = useState('3d');
  const [showDimensions, setShowDimensions] = useState(true);
  const [viewResetToken, setViewResetToken] = useState(0);
  const skipAutosaveRestoreRef = useRef(false);

  const [currentProjectId, setCurrentProjectId] = useState(() => {
    const d = loadBuildDraft();
    return typeof d?.currentProjectId === 'string' && d.currentProjectId ? d.currentProjectId : null;
  });
  const [openProjectModalOpen, setOpenProjectModalOpen] = useState(false);

  const [manualDimensions, setManualDimensions] = useState(() => {
    const d = loadBuildDraft();
    return Array.isArray(d?.manualDimensions) ? d.manualDimensions : [];
  });
  const [manualTextAnnotations, setManualTextAnnotations] = useState(() => {
    const d = loadBuildDraft();
    return Array.isArray(d?.manualTextAnnotations) ? d.manualTextAnnotations : [];
  });

  const [manualPosts, setManualPosts] = useState(() => {
    const d = loadBuildDraft();
    return Array.isArray(d?.manualPosts) ? d.manualPosts : [];
  });
  const [postPlacementMode, setPostPlacementMode] = useState(false);
  const [compactPostTarget, setCompactPostTarget] = useState(null); // null | 1 | 2
  const [selectedManualPostId, setSelectedManualPostId] = useState(null);

  const [manualTopRails, setManualTopRails] = useState(() => {
    const d = loadBuildDraft();
    return Array.isArray(d?.manualTopRails) ? d.manualTopRails.map(normalizeRailEndpoints) : [];
  });
  const [topRailMode, setTopRailMode] = useState(false);
  const [topRailFirstPostId, setTopRailFirstPostId] = useState(null);
  const [selectedManualTopRailId, setSelectedManualTopRailId] = useState(null);
  const [topRailPathMode, setTopRailPathMode] = useState(() => {
    const d = loadBuildDraft();
    return d?.topRailPathMode === 'manual' || d?.topRailPathMode === 'standard' ? d.topRailPathMode : 'standard';
  });

  const [fastRailsMode, setFastRailsMode] = useState(false);
  const [fastRailsPrevPostId, setFastRailsPrevPostId] = useState(null);

  const [structureOffsetXIn, setStructureOffsetXIn] = useState(() => {
    const d = loadBuildDraft();
    return typeof d?.structureOffsetXIn === 'number' ? d.structureOffsetXIn : 0;
  });
  const [structureOffsetZIn, setStructureOffsetZIn] = useState(() => {
    const d = loadBuildDraft();
    return typeof d?.structureOffsetZIn === 'number' ? d.structureOffsetZIn : 0;
  });
  const [pdfMirrored, setPdfMirrored] = useState(() => {
    const d = loadBuildDraft();
    return d?.pdfMirrored === true;
  });
  const [structureMoveSelected, setStructureMoveSelected] = useState(false);

  const [selectedPdfDraftDimensionId, setSelectedPdfDraftDimensionId] = useState(null);

  const [pdfDrafts, setPdfDrafts] = useState(() => {
    const d = loadBuildDraft();
    const DEFAULT = {
      side: { type: 'side', dimensions: [], texts: [] },
      threeD: { type: '3d', backgroundImage: null, dimensions: [], texts: [] },
    };
    if (!d?.pdfDrafts || typeof d.pdfDrafts !== 'object') return DEFAULT;
    return {
      side: { ...DEFAULT.side, ...d.pdfDrafts.side },
      threeD: { ...DEFAULT.threeD, ...d.pdfDrafts.threeD },
    };
  });
  const [activePdfDraftMode, setActivePdfDraftMode] = useState(null); // null | 'side' | '3d'
  const capture3dRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setPostPlacementMode(false);
        setCompactPostTarget(null);
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

  // Build autosave — iBuild state only, no iMeasure data; skipped entirely in measure mode
  useEffect(() => {
    if (projectMode === 'measure') return;
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
          pdfDrafts,
        };
        localStorage.setItem(BUILD_AUTOSAVE_KEY, JSON.stringify(snapshot));
      } catch {
        // Storage full or unavailable — ignore
      }
    }, 500);
    return () => clearTimeout(id);
  }, [projectMode, project, stairConfig, units, manualDimensions, manualTextAnnotations, manualPosts, manualTopRails, structureOffsetXIn, structureOffsetZIn, pdfMirrored, topRailPathMode, currentProjectId, pdfDrafts]);

  // Measure autosave — iMeasure shell only, no iBuild data
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const snapshot = {
          projectName: measureProjectShell.projectName,
          clientName: measureProjectShell.clientName,
          currentProjectId: measureProjectShell.currentProjectId,
          iMeasureConfig: measureProjectShell.iMeasureConfig,
        };
        localStorage.setItem(MEASURE_AUTOSAVE_KEY, JSON.stringify(snapshot));
      } catch {
        // Storage full or unavailable — ignore
      }
    }, 500);
    return () => clearTimeout(id);
  }, [measureProjectShell]);

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
    units,
  }), [calc, stairConfig, units]);

  const materials = useMemo(() => buildMaterialList({
    width: stairConfig.width,
    steps: stairConfig.steps,
    stringerLength: calc.stringerLength,
    railingEnabled: stairConfig.railingEnabled,
    handrailHeight: stairConfig.handrailHeight,
    tubeSize: stairConfig.tubeSize,
    post1Section: stairConfig.post1Section,
    post2Section: stairConfig.post2Section,
    manualPosts: resolveCompactPostAnchors(manualPosts, stairConfig, calc.treadPositions),
    manualTopRails,
    treadPositions: calc.treadPositions,
    riserHeight: calc.riserHeight,
    run: stairConfig.run,
    bottomLandingEnabled: stairConfig.bottomLandingEnabled,
    bottomLandingLength: stairConfig.bottomLandingLength,
    topLandingEnabled: stairConfig.topLandingEnabled,
    topLandingLength: stairConfig.topLandingLength,
    topLandingWidth: stairConfig.topLandingWidth,
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
    if (compactPostTarget !== null) {
      const slotKey = `post${compactPostTarget}`;
      const height = compactPostTarget === 1
        ? (stairConfig.post1HeightIn ?? stairConfig.handrailHeight ?? 36)
        : (stairConfig.post2HeightIn ?? stairConfig.handrailHeight ?? 36);
      const section = normalizeSection(
        compactPostTarget === 1
          ? (stairConfig.post1Section ?? '2x2')
          : (stairConfig.post2Section ?? '2x2')
      );
      const thickness = compactPostTarget === 1
        ? (stairConfig.post1Thickness ?? '1.8')
        : (stairConfig.post2Thickness ?? '1.8');
      const enrichedData = { ...postData, heightIn: height, section, thickness, compactSlot: slotKey };
      setManualPosts(prev => {
        const existingIdx = prev.findIndex(p => p.compactSlot === slotKey);
        if (existingIdx >= 0) {
          return prev.map((p, i) => i === existingIdx ? { ...p, ...enrichedData } : p);
        }
        const id = `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        return [...prev, { ...enrichedData, id }];
      });
      setCompactPostTarget(null);
      setPostPlacementMode(false);
      return;
    }
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
    setCompactPostTarget(null);
    setSelectedManualPostId(null);
    setTopRailMode(false);
    setTopRailFirstPostId(null);
    setFastRailsMode(false);
    setFastRailsPrevPostId(null);
  };

  const handleToggleCompactPostPlacement = (postNum) => {
    setCompactPostTarget(prev => {
      const toggling = prev === postNum;
      setPostPlacementMode(!toggling);
      if (!toggling) {
        setTopRailMode(false);
        setTopRailFirstPostId(null);
        setFastRailsMode(false);
        setFastRailsPrevPostId(null);
        setSelectedManualPostId(null);
      }
      return toggling ? null : postNum;
    });
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

  // Department-aware project setter: routes Name/Client updates to the active department shell
  const handleSetActiveProject = (updater) => {
    if (projectMode === 'measure') {
      setMeasureProjectShell(shell => {
        const view = { name: shell.projectName, client: shell.clientName };
        const next = typeof updater === 'function' ? updater(view) : updater;
        return { ...shell, projectName: next.name ?? '', clientName: next.client ?? '' };
      });
    } else {
      setProject(updater);
    }
  };

  const handleActiveIMeasureConfigChange = (updater) => {
    if (projectMode === 'measure') {
      setMeasureProjectShell(shell => {
        const next = typeof updater === 'function' ? updater(shell.iMeasureConfig) : updater;
        return { ...shell, iMeasureConfig: next };
      });
    } else {
      setIMeasureConfig(updater);
    }
  };

  const handleNewProject = () => {
    const department = getActiveDepartment(projectMode);

    if (department === 'measure') {
      const hasMeasureMeaningfulState = () => {
        if (measureProjectShell.projectName) return true;
        if (measureProjectShell.clientName) return true;
        if (measureProjectShell.currentProjectId !== null) return true;
        const def = createDefaultIMeasureConfig();
        const cfg = measureProjectShell.iMeasureConfig;
        // overallHeightIn = 36 alone is not dirty — it is the default
        if (cfg.angleDeg !== def.angleDeg) return true;
        if (cfg.postCenterDistanceIn !== def.postCenterDistanceIn) return true;
        if (cfg.bcLowP1In !== def.bcLowP1In) return true;
        if (cfg.bcLowP2In !== def.bcLowP2In) return true;
        if (cfg.bcHeightIn !== def.bcHeightIn) return true;
        if (cfg.stepSizeRangeText !== def.stepSizeRangeText) return true;
        if (cfg.stepSizeDistanceIn !== def.stepSizeDistanceIn) return true;
        return false;
      };
      if (hasMeasureMeaningfulState() && !window.confirm('Start a new iMeasure project? Current iMeasure data will be cleared.')) return;
      setMeasureProjectShell(createDefaultMeasureShell());
      localStorage.removeItem(MEASURE_AUTOSAVE_KEY);
      setActiveTool('select');
      // Stay in iMeasure mode — do NOT call setProjectMode
      // iBuild state (project, stairConfig, manualPosts, manualTopRails, dimensions, PDF, currentProjectId) is untouched
      return;
    }

    // department === 'build': existing behavior, preserve iMeasure department state
    const hasMeaningfulState = () => {
      if (project.name !== DEFAULT_PROJECT.name) return true;
      if (project.client !== DEFAULT_PROJECT.client) return true;
      for (const key of STAIR_CHECK_KEYS) {
        if (stairConfig[key] !== DEFAULT_STAIR[key]) return true;
      }
      if (manualPosts.length > 0) return true;
      if (manualTopRails.length > 0) return true;
      if (manualDimensions.length > 0) return true;
      if (manualTextAnnotations.length > 0) return true;
      if (structureOffsetXIn !== 0 || structureOffsetZIn !== 0) return true;
      if (pdfDrafts.side.dimensions.length > 0 || pdfDrafts.side.texts.length > 0) return true;
      if (pdfDrafts.threeD.dimensions.length > 0 || pdfDrafts.threeD.texts.length > 0 || pdfDrafts.threeD.backgroundImage !== null) return true;
      if (currentProjectId !== null) return true;
      return false;
    };
    if (hasMeaningfulState() && !window.confirm('Start a new project? Current unsaved changes will be cleared.')) return;
    localStorage.removeItem(BUILD_AUTOSAVE_KEY);
    localStorage.removeItem(LEGACY_AUTOSAVE_KEY);
    // Do NOT remove MEASURE_AUTOSAVE_KEY
    setProject(DEFAULT_PROJECT);
    setStairConfig({ ...DEFAULT_STAIR, steps: 6, bottomLandingEnabled: true, topLandingEnabled: true, topLandingWidth: DEFAULT_STAIR.width });
    setManualDimensions([]);
    setManualTextAnnotations([]);
    setManualPosts([]);
    setManualTopRails([]);
    setSelectedManualPostId(null);
    setSelectedManualTopRailId(null);
    setTopRailFirstPostId(null);
    setFastRailsPrevPostId(null);
    setPostPlacementMode(false);
    setCompactPostTarget(null);
    setTopRailMode(false);
    setFastRailsMode(false);
    setTopRailPathMode('standard');
    setStructureMoveSelected(false);
    setStructureOffsetXIn(0);
    setStructureOffsetZIn(0);
    setPdfMirrored(false);
    setCurrentProjectId(null);
    setPdfDrafts({
      side: { type: 'side', dimensions: [], texts: [] },
      threeD: { type: '3d', backgroundImage: null, dimensions: [], texts: [] },
    });
    setActivePdfDraftMode(null);
    setSelectedPdfDraftDimensionId(null);
    setActiveTool('select');
    setProjectMode('build');
    // DO NOT reset measureProjectShell — preserve iMeasure department state
    // Note: Save/Open separation is Step 5
  };

  const handleOpenJson = () =>
    openProjectJson(
      ({ project: p, stairConfig: sc, units: u, manualDimensions: mdi, manualPosts: mp, manualTopRails: mtr, structureOffsetXIn: sox, structureOffsetZIn: soz, pdfMirrored: pm, topRailPathMode: trpm, manualTextAnnotations: mta, pdfDrafts: pd }) => {
        skipAutosaveRestoreRef.current = true;
        setProject({ ...DEFAULT_PROJECT, ...p });
        setStairConfig({ ...DEFAULT_STAIR, ...sc });
        if (u) setUnits(u === 'mm' ? 'mm' : u === 'in16' ? 'in16' : 'in8');
        setManualDimensions(Array.isArray(mdi) ? mdi : []);
        setManualTextAnnotations(Array.isArray(mta) ? mta : []);
        setManualPosts(Array.isArray(mp) ? mp : []);
        setManualTopRails(Array.isArray(mtr) ? mtr.map(normalizeRailEndpoints) : []);
        if (typeof sox === 'number') setStructureOffsetXIn(sox);
        if (typeof soz === 'number') setStructureOffsetZIn(soz);
        setPdfMirrored(pm === true);
        if (trpm) setTopRailPathMode(trpm);
        if (pd) setPdfDrafts(pd);
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

  const handleSaveJson = () => saveProjectJson({ project, stairConfig, calc, warnings, materials, units, manualDimensions, manualPosts, manualTopRails, structureOffsetXIn, structureOffsetZIn, pdfMirrored, topRailPathMode, manualTextAnnotations, pdfDrafts });

  const handleExportPdf = () => {
    let effectivePdfDrafts = pdfDrafts;
    if (activePdfDraftMode === '3d') {
      const fn = capture3dRef.current;
      const freshImg = fn ? fn() : null;
      effectivePdfDrafts = {
        ...pdfDrafts,
        threeD: { ...pdfDrafts.threeD, backgroundImage: freshImg },
      };
    }
    generatePdf({ project, stairConfig, calc, warnings, materials, units, manualDimensions, manualPosts, manualTopRails, pdfMirrored, topRailPathMode, manualTextAnnotations, pdfDrafts: effectivePdfDrafts, primaryPageType: activePdfDraftMode === '3d' ? 'threeD' : 'side' });
  };

  const handleSaveProject = async () => {
    if (projectMode === 'measure') {
      alert('iMeasure cloud save will be enabled after project_type migration.');
      return;
    }
    const result = await saveProject({ project, stairConfig, calc, warnings, materials, manualDimensions, manualPosts, manualTopRails, manualTextAnnotations, structureOffsetXIn, structureOffsetZIn, pdfMirrored, topRailPathMode, units, currentProjectId, pdfDrafts });
    if (result.ok && result.projectId) {
      setCurrentProjectId(result.projectId);
    }
    return result;
  };

  const handleOpenProject = () => {
    if (projectMode === 'measure') {
      alert('iMeasure cloud open will be enabled after project_type migration.');
      return;
    }
    setOpenProjectModalOpen(true);
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
    const normalizedSc = { ...DEFAULT_STAIR, ...sc };
    for (const key of SECTION_KEYS) {
      if (normalizedSc[key]) normalizedSc[key] = normalizeSection(normalizedSc[key], DEFAULT_STAIR[key]);
    }
    setStairConfig(normalizedSc);
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
    const validUnit = (u) => u === 'in8' || u === 'in16' || u === 'mm' || u === 'in';
    const mapUnit = (u) => u === 'mm' ? 'mm' : u === 'in16' ? 'in16' : 'in8';
    setUnits(validUnit(sc.units) ? mapUnit(sc.units) : validUnit(p.units) ? mapUnit(p.units) : 'in8');
    const DEFAULT_PDF_DRAFTS = {
      side: { type: 'side', dimensions: [], texts: [] },
      threeD: { type: '3d', backgroundImage: null, dimensions: [], texts: [] },
    };
    if (sc.pdfDrafts && typeof sc.pdfDrafts === 'object') {
      setPdfDrafts({
        side: { ...DEFAULT_PDF_DRAFTS.side, ...sc.pdfDrafts.side },
        threeD: { ...DEFAULT_PDF_DRAFTS.threeD, ...sc.pdfDrafts.threeD },
      });
    } else {
      setPdfDrafts(DEFAULT_PDF_DRAFTS);
    }
    setSelectedManualPostId(null);
    setSelectedManualTopRailId(null);
    setPostPlacementMode(false);
    setTopRailMode(false);
    setTopRailFirstPostId(null);
    setCurrentProjectId(p.id);
  };

  const handleOpenSidePdf = () => {
    if (activePdfDraftMode === 'side') { setActivePdfDraftMode(null); return; }
    setView('side');
    setViewResetToken(t => t + 1);
    setActivePdfDraftMode('side');
  };

  const handleOpen3dPdf = () => {
    if (activePdfDraftMode === '3d') { setActivePdfDraftMode(null); setSelectedPdfDraftDimensionId(null); return; }
    setActivePdfDraftMode('3d');
    setSelectedPdfDraftDimensionId(null);
  };

  const handleAddPdfDimension = (dimData) => {
    if (!activePdfDraftMode) return;
    const key = activePdfDraftMode === 'side' ? 'side' : 'threeD';
    setPdfDrafts(prev => ({ ...prev, [key]: { ...prev[key], dimensions: [...prev[key].dimensions, dimData] } }));
    if (activePdfDraftMode === '3d') setSelectedPdfDraftDimensionId(dimData.id);
  };

  const handleAddPdfText = (textData) => {
    if (!activePdfDraftMode) return;
    const key = activePdfDraftMode === 'side' ? 'side' : 'threeD';
    setPdfDrafts(prev => ({ ...prev, [key]: { ...prev[key], texts: [...(prev[key].texts ?? []), textData] } }));
  };

  const handleDeleteLastPdfAnnotation = () => {
    if (!activePdfDraftMode) return;
    const key = activePdfDraftMode === 'side' ? 'side' : 'threeD';
    setPdfDrafts(prev => {
      const draft = prev[key];
      const texts = draft.texts ?? [];
      const dims = draft.dimensions ?? [];
      if (texts.length > 0) return { ...prev, [key]: { ...draft, texts: texts.slice(0, -1) } };
      if (dims.length > 0) return { ...prev, [key]: { ...draft, dimensions: dims.slice(0, -1) } };
      return prev;
    });
  };

  const handleExitPdfMode = () => { setActivePdfDraftMode(null); setSelectedPdfDraftDimensionId(null); };

  const handleSelectPdfDraftDimension = (id) => setSelectedPdfDraftDimensionId(id);

  const handleUpdatePdfDraftDimension = (id, changes) => {
    setPdfDrafts(prev => ({
      ...prev,
      threeD: { ...prev.threeD, dimensions: prev.threeD.dimensions.map(d => d.id === id ? { ...d, ...changes } : d) },
    }));
  };

  const handleDeletePdfDraftDimension = (id) => {
    setPdfDrafts(prev => ({
      ...prev,
      threeD: { ...prev.threeD, dimensions: prev.threeD.dimensions.filter(d => d.id !== id) },
    }));
    setSelectedPdfDraftDimensionId(cur => cur === id ? null : cur);
  };

  const handleDeleteLastPdfDraftDimension = () => {
    setPdfDrafts(prev => {
      const dims = prev.threeD.dimensions;
      if (dims.length === 0) return prev;
      const lastId = dims[dims.length - 1].id;
      setSelectedPdfDraftDimensionId(cur => cur === lastId ? null : cur);
      return { ...prev, threeD: { ...prev.threeD, dimensions: dims.slice(0, -1) } };
    });
  };

  const handleClearAllPdfDraftDimensions = () => {
    setPdfDrafts(prev => ({ ...prev, threeD: { ...prev.threeD, dimensions: [] } }));
    setSelectedPdfDraftDimensionId(null);
  };

  const handlePrint = () => {
    if (activePdfDraftMode === '3d') {
      const fn = capture3dRef.current;
      const freshImg = fn ? fn() : null;
      const effectivePdfDrafts = {
        ...pdfDrafts,
        threeD: { ...pdfDrafts.threeD, backgroundImage: freshImg },
      };
      const blobUrl = generatePdf({ project, stairConfig, calc, warnings, materials, units, manualDimensions, manualPosts, manualTopRails, pdfMirrored, topRailPathMode, manualTextAnnotations, pdfDrafts: effectivePdfDrafts, primaryPageType: 'threeD', mode: 'print' });
      if (blobUrl) { const pw = window.open(blobUrl, '_blank'); if (!pw) window.location.href = blobUrl; }
      return;
    }
    printViewportPdf();
  };

  const handleViewChange = (v) => {
    setView(v);
    setViewResetToken((t) => t + 1);
  };

  // Department-aware views passed to RightPanel — routed by projectMode
  const activeProject = projectMode === 'measure'
    ? { name: measureProjectShell.projectName, client: measureProjectShell.clientName }
    : project;
  const activeIMeasureConfig = projectMode === 'measure'
    ? measureProjectShell.iMeasureConfig
    : iMeasureConfig;

  return (
    <div className="app-shell">
      <Header
        onOpenJson={handleOpenJson}
        onSaveJson={handleSaveJson}
        onExportPdf={handleExportPdf}
        onPrint={handlePrint}
        units={units}
        onUnitsChange={setUnits}
        onOpenProject={handleOpenProject}
        projectMode={projectMode}
        onProjectModeChange={setProjectMode}
      />
      <Toolbar activeTool={activeTool} onToolSelect={setActiveTool} onViewChange={handleViewChange} showDimensions={showDimensions} onToggleDimensions={() => setShowDimensions((v) => !v)} manualDimensionsCount={manualDimensions.length} onUndoLastManualDimension={handleUndoLastManualDimension} onOpenSidePdf={handleOpenSidePdf} onOpen3dPdf={handleOpen3dPdf} activePdfDraftMode={activePdfDraftMode} />
      <StairScene
        stairConfig={stairConfig}
        calc={calc}
        view={view}
        viewResetToken={viewResetToken}
        units={units}
        showDimensions={showDimensions}
        modalOpen={openProjectModalOpen}
        activeTool={activeTool}
        projectMode={projectMode}
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
        capture3dRef={capture3dRef}
        activePdfDraftMode={activePdfDraftMode}
        pdfDrafts={pdfDrafts}
        onAddPdfDimension={handleAddPdfDimension}
        onAddPdfText={handleAddPdfText}
        onDeleteLastPdfAnnotation={handleDeleteLastPdfAnnotation}
        onExitPdfMode={handleExitPdfMode}
        selectedPdfDraftDimensionId={selectedPdfDraftDimensionId}
        onSelectPdfDraftDimension={handleSelectPdfDraftDimension}
      />
      <RightPanel
        project={activeProject}
        setProject={handleSetActiveProject}
        stairConfig={stairConfig}
        setStairConfig={setStairConfig}
        calc={calc}
        warnings={warnings}
        materials={materials}
        onNewProject={handleNewProject}
        onSaveProject={handleSaveProject}
        onOpenProject={handleOpenProject}
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
        compactPostTarget={compactPostTarget}
        onToggleCompactPostPlacement={handleToggleCompactPostPlacement}
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
        activePdfDraftMode={activePdfDraftMode}
        pdfDrafts={pdfDrafts}
        selectedPdfDraftDimensionId={selectedPdfDraftDimensionId}
        onSelectPdfDraftDimension={handleSelectPdfDraftDimension}
        onUpdatePdfDraftDimension={handleUpdatePdfDraftDimension}
        onDeletePdfDraftDimension={handleDeletePdfDraftDimension}
        onDeleteLastPdfDraftDimension={handleDeleteLastPdfDraftDimension}
        onClearAllPdfDraftDimensions={handleClearAllPdfDraftDimensions}
        projectMode={projectMode}
        iMeasureConfig={activeIMeasureConfig}
        onIMeasureConfigChange={handleActiveIMeasureConfigChange}
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
