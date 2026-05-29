import { useState, useMemo } from 'react';
import './styles.css';

import Header from './components/Header.jsx';
import Toolbar from './components/Toolbar.jsx';
import StairScene from './components/StairScene.jsx';
import RightPanel from './components/RightPanel.jsx';
import StatusBar from './components/StatusBar.jsx';

import { calcStair, buildMaterialList } from './geometry/stairMath.js';
import { validateStair } from './geometry/validation.js';
import { saveProjectJson } from './utils/saveJson.js';
import { generatePdf } from './pdf/generatePdf.js';

const DEFAULT_STAIR = {
  height: 108,
  run: 144,
  width: 48,
  steps: 14,
  tubeSize: '2x2',
  railingEnabled: true,
  handrailHeight: 36,
  pinOpening: 3.875,
  postSpacing: 48,
};

const DEFAULT_PROJECT = {
  name: '',
  client: '',
};

export default function App() {
  const [project, setProject] = useState(DEFAULT_PROJECT);
  const [stairConfig, setStairConfig] = useState(DEFAULT_STAIR);
  const [activeTool, setActiveTool] = useState('select');
  const [view, setView] = useState('3d');

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

  const handleSaveJson = () => saveProjectJson({ project, stairConfig, calc, warnings, materials });

  const handleExportPdf = () => generatePdf({ project, stairConfig, calc, warnings, materials });

  const handlePrint = () => window.print();

  const handleViewChange = (v) => setView(v);

  return (
    <div className="app-shell">
      <Header onSaveJson={handleSaveJson} onExportPdf={handleExportPdf} onPrint={handlePrint} />
      <Toolbar activeTool={activeTool} onToolSelect={setActiveTool} onViewChange={handleViewChange} />
      <StairScene stairConfig={stairConfig} calc={calc} view={view} />
      <RightPanel
        project={project}
        setProject={setProject}
        stairConfig={stairConfig}
        setStairConfig={setStairConfig}
        calc={calc}
        warnings={warnings}
        materials={materials}
      />
      <StatusBar activeTool={activeTool} calc={calc} warnings={warnings} />
    </div>
  );
}
