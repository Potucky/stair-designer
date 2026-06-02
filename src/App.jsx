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

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setPostPlacementMode(false);
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
  }), [stairConfig, calc, manualPosts]);

  const handleAddManualPost = (postData) => {
    const id = `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setManualPosts(prev => [...prev, { ...postData, id }]);
  };

  const handleUpdateManualPost = (id, changes) => {
    setManualPosts(prev => prev.map(p => p.id === id ? { ...p, ...changes } : p));
  };

  const handleDeleteManualPost = (id) => {
    setManualPosts(prev => prev.filter(p => p.id !== id));
    setSelectedManualPostId(null);
  };

  const handleSelectManualPost = (id) => {
    setSelectedManualPostId(prev => prev === id ? null : id);
  };

  const handleTogglePostPlacement = () => {
    setPostPlacementMode(prev => !prev);
    setSelectedManualPostId(null);
  };

  const handleOpenJson = () =>
    openProjectJson(
      ({ project: p, stairConfig: sc, units: u, manualPosts: mp }) => {
        setProject({ ...DEFAULT_PROJECT, ...p });
        setStairConfig({ ...DEFAULT_STAIR, ...sc });
        if (u) setUnits(u);
        setManualPosts(Array.isArray(mp) ? mp : []);
        setSelectedManualPostId(null);
        setPostPlacementMode(false);
      },
      (msg) => alert(`Could not open file: ${msg}`),
    );

  const handleSaveJson = () => saveProjectJson({ project, stairConfig, calc, warnings, materials, units, manualPosts });

  const handleExportPdf = () => generatePdf({ project, stairConfig, calc, warnings, materials, units, manualPosts });

  const handleSaveProject = () => saveProject({ project, stairConfig, calc, warnings, materials, manualPosts });

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
      />
      <StatusBar activeTool={activeTool} calc={calc} warnings={warnings} units={units} />
    </div>
  );
}
