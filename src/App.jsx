import { useState, useMemo } from 'react';
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
  }), [calc, stairConfig]);

  const materials = useMemo(() => buildMaterialList({
    height: stairConfig.height,
    run: stairConfig.run,
    width: stairConfig.width,
    steps: stairConfig.steps,
    stringerLength: calc.stringerLength,
    postCount: calc.postCount,
    handrailLength: calc.handrailLength,
    railingEnabled: stairConfig.railingEnabled,
    handrailHeight: stairConfig.handrailHeight,
    tubeSize: stairConfig.tubeSize,
  }), [stairConfig, calc]);

  const handleOpenJson = () =>
    openProjectJson(
      ({ project: p, stairConfig: sc, units: u }) => {
        setProject({ ...DEFAULT_PROJECT, ...p });
        setStairConfig({ ...DEFAULT_STAIR, ...sc });
        if (u) setUnits(u);
      },
      (msg) => alert(`Could not open file: ${msg}`),
    );

  const handleSaveJson = () => saveProjectJson({ project, stairConfig, calc, warnings, materials, units });

  const handleExportPdf = () => generatePdf({ project, stairConfig, calc, warnings, materials, units });

  const handleSaveProject = () => saveProject({ project, stairConfig, calc, warnings, materials });

  const handlePrint = () => window.print();

  const handleViewChange = (v) => {
    setView(v);
    setViewResetToken((t) => t + 1);
  };

  return (
    <div className="app-shell">
      <Header onOpenJson={handleOpenJson} onSaveJson={handleSaveJson} onExportPdf={handleExportPdf} onPrint={handlePrint} units={units} onUnitsChange={setUnits} />
      <Toolbar activeTool={activeTool} onToolSelect={setActiveTool} onViewChange={handleViewChange} showDimensions={showDimensions} onToggleDimensions={() => setShowDimensions((v) => !v)} />
      <StairScene stairConfig={stairConfig} calc={calc} view={view} viewResetToken={viewResetToken} units={units} showDimensions={showDimensions} activeTool={activeTool} />
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
      />
      <StatusBar activeTool={activeTool} calc={calc} warnings={warnings} units={units} />
    </div>
  );
}
