import { jsPDF } from 'jspdf';

export function generatePdf({ project, stairConfig, calc, warnings, materials }) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const PW = 612;
  const PH = 792;
  const M = 48;

  // ── Helpers ────────────────────────────────────────────────────────────────

  const setStyle = (size, style = 'normal', color = '#000000') => {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    doc.setTextColor(color);
  };

  const txt = (str, x, y, opts = {}) => {
    setStyle(opts.size || 10, opts.bold ? 'bold' : opts.italic ? 'italic' : 'normal', opts.color || '#000000');
    doc.text(str, x, y, { align: opts.align || 'left' });
  };

  const hline = (x1, x2, y, color = '#cccccc', width = 0.5) => {
    doc.setDrawColor(color);
    doc.setLineWidth(width);
    doc.line(x1, y, x2, y);
  };

  const kv = (label, value, x, y, labelW = 160) => {
    txt(label, x, y, { size: 10, color: '#555555' });
    txt(String(value), x + labelW, y, { bold: true, size: 10 });
    return y + 15;
  };

  const sectionHead = (title, y) => {
    y += 6;
    txt(title, M, y, { bold: true, size: 10, color: '#1a1a2e' });
    y += 3;
    hline(M, PW - M, y, '#1a1a2e', 0.8);
    return y + 13;
  };

  const pageHeader = (num, title) => {
    txt('STAIR DESIGNER', M, 40, { bold: true, size: 14, color: '#1a1a2e' });
    txt('v0.0.2', PW - M, 40, { size: 9, color: '#888888', align: 'right' });
    txt(title, M, 54, { size: 9, color: '#666666' });
    txt(`Page ${num} of 4`, PW - M, 54, { size: 9, color: '#888888', align: 'right' });
    hline(M, PW - M, 60, '#1a1a2e', 1);
    return 76;
  };

  const pageFooter = () => {
    hline(M, PW - M, PH - 36, '#cccccc');
    txt(
      `${project.name || 'Untitled Project'} — Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      PW / 2, PH - 22, { size: 8, color: '#888888', align: 'center' }
    );
  };

  // ── PAGE 1 — Project Summary ───────────────────────────────────────────────

  let y = pageHeader(1, 'Project Summary');

  doc.setFillColor('#f0f4ff');
  doc.roundedRect(M, y, PW - M * 2, 44, 4, 4, 'F');
  txt(project.name || 'Untitled Project', M + 10, y + 16, { bold: true, size: 14, color: '#1a1a2e' });
  txt(`Client: ${project.client || '—'}`, M + 10, y + 32, { size: 10, color: '#444444' });
  txt(
    new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    PW - M - 10, y + 16, { size: 9, color: '#666666', align: 'right' }
  );
  txt('Imperial Units (inches)', PW - M - 10, y + 32, { size: 9, color: '#666666', align: 'right' });
  y += 56;

  y = sectionHead('STAIR INPUTS', y);
  y = kv('Total Height:', `${stairConfig.height}"`, M, y);
  y = kv('Total Run:', `${stairConfig.run}"`, M, y);
  y = kv('Width:', `${stairConfig.width}"`, M, y);
  y = kv('Number of Steps:', String(stairConfig.steps), M, y);
  y = kv('Tube Size:', stairConfig.tubeSize, M, y);
  y = kv('Railing:', stairConfig.railingEnabled ? 'Yes' : 'No', M, y);
  if (stairConfig.railingEnabled) {
    y = kv('Handrail Height:', `${stairConfig.handrailHeight}"`, M, y);
    y = kv('Max Pin / Guard Opening:', `${stairConfig.pinOpening}"`, M, y);
    y = kv('Post Spacing:', `${stairConfig.postSpacing}"`, M, y);
  }
  y += 8;

  y = sectionHead('CALCULATED RESULTS', y);

  const halfW = (PW - M * 2 - 20) / 2;
  let yL = y;
  let yR = y;

  const rowL = (label, value) => { yL = kv(label, value, M, yL, 140); };
  const rowR = (label, value) => { yR = kv(label, value, M + halfW + 20, yR, 160); };

  rowL('Angle:', `${calc.angleDeg.toFixed(1)}°`);
  rowL('Riser Height:', `${calc.riserHeight.toFixed(3)}"`);
  rowL('Tread Depth:', `${calc.treadDepth.toFixed(3)}"`);
  rowL('Stringer Length:', `${calc.stringerLength.toFixed(2)}"`);

  const errCount = warnings.filter((w) => w.level === 'error').length;
  const warnCount = warnings.filter((w) => w.level === 'warning').length;
  if (stairConfig.railingEnabled) {
    rowR('Post Count:', String(calc.postCount));
    rowR('Handrail Length:', `${calc.handrailLength.toFixed(2)}"`);
  }
  rowR('Code Errors:', errCount === 0 ? 'None' : String(errCount));
  rowR('Code Warnings:', warnCount === 0 ? 'None' : String(warnCount));

  y = Math.max(yL, yR) + 8;

  pageFooter();

  // ── PAGE 2 — Side View Diagram ─────────────────────────────────────────────

  doc.addPage();
  y = pageHeader(2, 'Side View Diagram');

  const dAreaX = M + 50;
  const dAreaY = y + 20;
  const dAreaW = PW - M * 2 - 80;
  const dAreaH = 360;

  const { height, run, steps } = stairConfig;
  const { riserHeight, treadDepth, angleDeg, stringerLength } = calc;

  const scaleX = (dAreaW * 0.82) / (run || 1);
  const scaleY = (dAreaH * 0.82) / (height || 1);
  const sc = Math.min(scaleX, scaleY);

  const dw = run * sc;
  const dh = height * sc;

  // Origin: bottom-left of stair at ground level
  const ox = dAreaX + (dAreaW - dw) / 2;
  const oy = dAreaY + dAreaH - (dAreaH - dh) / 2;

  // Ground line
  doc.setDrawColor('#888888');
  doc.setLineWidth(1);
  doc.line(ox - 24, oy, ox + dw + 24, oy);

  // Vertical reference (wall line, dashed)
  doc.setDrawColor('#cccccc');
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([4, 3], 0);
  doc.line(ox, oy, ox, oy - dh - 14);
  doc.setLineDashPattern([], 0);

  // Stair step profile
  doc.setDrawColor('#1a1a2e');
  doc.setLineWidth(1.8);
  const rPx = riserHeight * sc;
  const tPx = treadDepth * sc;
  let sx = ox;
  let sy = oy;
  for (let i = 0; i < steps; i++) {
    doc.line(sx, sy, sx, sy - rPx);
    doc.line(sx, sy - rPx, sx + tPx, sy - rPx);
    sx += tPx;
    sy -= rPx;
  }
  // Close bottom
  doc.setLineWidth(1);
  doc.setDrawColor('#888888');
  doc.line(ox, oy, ox + dw, oy);

  // Stringer (diagonal, dashed blue)
  doc.setDrawColor('#3366cc');
  doc.setLineWidth(0.9);
  doc.setLineDashPattern([6, 3], 0);
  doc.line(ox, oy, ox + dw, oy - dh);
  doc.setLineDashPattern([], 0);

  // Stringer label
  const slAngle = Math.atan2(dh, dw);
  const slMidX = ox + dw / 2;
  const slMidY = oy - dh / 2;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor('#3366cc');
  doc.text(`Stringer ${stringerLength.toFixed(2)}"`, slMidX + 6, slMidY - 8);

  // Height dimension (left side)
  doc.setDrawColor('#555555');
  doc.setLineWidth(0.5);
  const hdX = ox - 30;
  doc.line(hdX, oy, hdX, oy - dh);
  doc.line(hdX - 4, oy, hdX + 4, oy);
  doc.line(hdX - 4, oy - dh, hdX + 4, oy - dh);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#333333');
  doc.text(`H = ${height}"`, hdX - 6, oy - dh / 2 + 4, { align: 'right' });

  // Run dimension (bottom)
  const rdY = oy + 26;
  doc.line(ox, rdY, ox + dw, rdY);
  doc.line(ox, rdY - 4, ox, rdY + 4);
  doc.line(ox + dw, rdY - 4, ox + dw, rdY + 4);
  doc.text(`Run = ${run}"`, ox + dw / 2, rdY + 11, { align: 'center' });

  // Angle arc approximation at base
  const arcR = 28;
  const angleRad = (angleDeg * Math.PI) / 180;
  doc.setDrawColor('#cc6600');
  doc.setLineWidth(0.7);
  for (let i = 1; i <= 16; i++) {
    const a0 = ((i - 1) / 16) * angleRad;
    const a1 = (i / 16) * angleRad;
    doc.line(ox + arcR * Math.cos(a0), oy - arcR * Math.sin(a0), ox + arcR * Math.cos(a1), oy - arcR * Math.sin(a1));
  }
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#cc6600');
  doc.text(`${angleDeg.toFixed(1)}°`, ox + arcR + 5, oy - arcR * 0.5);

  // Riser + tread callout on first step
  if (steps > 0) {
    const annX = ox + tPx * 1.2;
    const annY = oy - rPx * 1.2;
    doc.setDrawColor('#666666');
    doc.setLineWidth(0.4);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(annX, annY, annX + 24, annY - 22);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#444444');
    doc.text(`R = ${riserHeight.toFixed(3)}"`, annX + 26, annY - 24);
    doc.text(`T = ${treadDepth.toFixed(3)}"`, annX + 26, annY - 13);
  }

  // Legend box
  const lgX = dAreaX + dAreaW - 140;
  const lgY = dAreaY + dAreaH + 22;
  doc.setFillColor('#f8f9fa');
  doc.roundedRect(lgX - 8, lgY - 12, 148, 44, 3, 3, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#222222');
  doc.text('Legend', lgX, lgY);

  doc.setFont('helvetica', 'normal');
  doc.setDrawColor('#1a1a2e');
  doc.setLineWidth(1.8);
  doc.line(lgX, lgY + 11, lgX + 18, lgY + 11);
  doc.setTextColor('#1a1a2e');
  doc.text('Stair Profile', lgX + 22, lgY + 14);

  doc.setDrawColor('#3366cc');
  doc.setLineWidth(0.9);
  doc.setLineDashPattern([4, 2], 0);
  doc.line(lgX, lgY + 22, lgX + 18, lgY + 22);
  doc.setLineDashPattern([], 0);
  doc.setTextColor('#3366cc');
  doc.text('Stringer', lgX + 22, lgY + 25);

  pageFooter();

  // ── PAGE 3 — Material / Cut List ──────────────────────────────────────────

  doc.addPage();
  y = pageHeader(3, 'Material / Cut List');

  y = sectionHead('BILL OF MATERIALS', y);

  const cW = [180, 40, 90, 120, 0];
  const cx = [M, M + cW[0], M + cW[0] + cW[1], M + cW[0] + cW[1] + cW[2], M + cW[0] + cW[1] + cW[2] + cW[3]];

  // Table header row
  doc.setFillColor('#1a1a2e');
  doc.rect(M, y - 10, PW - M * 2, 18, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#ffffff');
  doc.text('Part', cx[0] + 4, y + 3);
  doc.text('Qty', cx[1] + 4, y + 3);
  doc.text('Length (in)', cx[2] + 4, y + 3);
  doc.text('Profile', cx[3] + 4, y + 3);
  doc.text('Note', cx[4] + 4, y + 3);
  y += 14;

  let alt = false;
  for (const item of materials) {
    if (alt) {
      doc.setFillColor('#f5f7fa');
      doc.rect(M, y - 10, PW - M * 2, 16, 'F');
    }
    alt = !alt;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#222222');
    doc.text(item.part, cx[0] + 4, y);
    doc.text(String(item.qty), cx[1] + 4, y);
    doc.text(String(item.lengthIn), cx[2] + 4, y);
    doc.text(item.profile, cx[3] + 4, y);
    doc.text(item.note || '', cx[4] + 4, y);
    y += 16;
  }

  hline(M, PW - M, y - 2, '#888888');
  y += 12;

  const totalPieces = materials.reduce((s, m) => s + Number(m.qty), 0);
  txt(`Total pieces: ${totalPieces}`, PW - M, y, { bold: true, size: 9, align: 'right' });
  y += 26;

  y = sectionHead('FABRICATION NOTES', y);

  const fabNotes = [
    `All members: Square Tube ${stairConfig.tubeSize} unless noted otherwise.`,
    `All dimensions are nominal. Verify field measurements before cutting.`,
    `Stringers are cut at ${calc.angleDeg.toFixed(1)}° to match total rise/run ratio.`,
    `Treads are horizontal. Weld tread brackets or cope stringers per shop drawing.`,
    `Weld per AWS D1.1 / D1.3 as applicable. Grind welds smooth on exposed surfaces.`,
    `Prime and paint per project spec. Hot-dip galvanize for exterior/corrosive environments.`,
    `Verify anchor bolt pattern, base plate, and top connection with structural engineer.`,
  ];

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#333333');
  for (const note of fabNotes) {
    doc.text(`•  ${note}`, M + 8, y);
    y += 14;
  }

  pageFooter();

  // ── PAGE 4 — Warnings / Code Notes / Disclaimer ───────────────────────────

  doc.addPage();
  y = pageHeader(4, 'Warnings, Code Notes & Disclaimer');

  y = sectionHead('CODE COMPLIANCE CHECK', y);

  const errors = warnings.filter((w) => w.level === 'error');
  const warns = warnings.filter((w) => w.level === 'warning');
  const allIssues = [...errors, ...warns];

  if (allIssues.length === 0) {
    doc.setFillColor('#e8f5e9');
    doc.roundedRect(M, y - 8, PW - M * 2, 28, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#1b5e20');
    doc.text('No errors or warnings — inputs appear within typical code ranges.', M + 12, y + 8);
    y += 34;
  } else {
    for (const w of errors) {
      doc.setFillColor('#ffebee');
      const lines = doc.splitTextToSize(`ERROR: ${w.msg}`, PW - M * 2 - 24);
      const boxH = lines.length * 13 + 14;
      doc.roundedRect(M, y - 8, PW - M * 2, boxH, 3, 3, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#b71c1c');
      doc.text(lines, M + 12, y + 2);
      y += boxH + 6;
    }
    for (const w of warns) {
      doc.setFillColor('#fff8e1');
      const lines = doc.splitTextToSize(`WARNING: ${w.msg}`, PW - M * 2 - 24);
      const boxH = lines.length * 13 + 14;
      doc.roundedRect(M, y - 8, PW - M * 2, boxH, 3, 3, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#e65100');
      doc.text(lines, M + 12, y + 2);
      y += boxH + 6;
    }
  }

  y += 6;
  y = sectionHead('FLORIDA BUILDING CODE REFERENCE NOTES', y);

  const rH = calc.riserHeight;
  const tD = calc.treadDepth;
  const hH = stairConfig.handrailHeight;
  const pO = stairConfig.pinOpening;
  const sW = stairConfig.width;
  const rail = stairConfig.railingEnabled;

  const codeRows = [
    {
      section: 'FBC 1011.5.2',
      req: `Max riser: 7¾" (7.750")  —  Min tread: 10"`,
      status: rH > 7.75 ? 'FAIL' : tD < 10 ? 'FAIL' : 'OK',
    },
    {
      section: 'FBC 1011.5.3',
      req: 'Max riser/tread variation between steps: ⅜" (0.375")',
      status: null,
    },
    {
      section: 'FBC 1012.2',
      req: 'Handrail height: 34"–38" above nosing',
      status: rail ? (hH < 34 || hH > 38 ? 'FAIL' : 'OK') : 'N/A',
    },
    {
      section: 'FBC 1015.4',
      req: 'Guard openings: max 4" (sphere test)',
      status: rail ? (pO > 4 ? 'FAIL' : 'OK') : 'N/A',
    },
    {
      section: 'FBC 1011.3',
      req: 'Min stair width: 44" (occupant load > 49)',
      status: sW < 44 ? 'NOTE' : 'OK',
    },
    {
      section: 'OSHA 1910.25',
      req: 'Commercial: riser 6½"–9½", tread ≥9½" (if applicable)',
      status: null,
    },
  ];

  // Table header
  doc.setFillColor('#e8eaf6');
  doc.rect(M, y - 9, PW - M * 2, 16, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#1a1a2e');
  doc.text('Section', M + 4, y + 1);
  doc.text('Requirement', M + 76, y + 1);
  doc.text('Result', M + 436, y + 1);
  y += 12;

  let rowAlt = false;
  for (const cr of codeRows) {
    const reqLines = doc.splitTextToSize(cr.req, 350);
    const rowH = Math.max(reqLines.length * 11, 14);
    if (rowAlt) {
      doc.setFillColor('#fafafa');
      doc.rect(M, y - 9, PW - M * 2, rowH + 4, 'F');
    }
    rowAlt = !rowAlt;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#333333');
    doc.text(cr.section, M + 4, y);
    doc.text(reqLines, M + 76, y);

    if (cr.status) {
      const isFail = cr.status === 'FAIL';
      const isNote = cr.status === 'NOTE';
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(isFail ? '#b71c1c' : isNote ? '#e65100' : cr.status === 'N/A' ? '#888888' : '#1b5e20');
      doc.text(cr.status, M + 436, y);
    }

    y += rowH + 4;
  }

  y += 12;
  y = sectionHead('DISCLAIMER', y);

  const disclaimerText =
    'CODE / ENGINEERING DISCLAIMER: This drawing is a fabrication-assist document generated from user-entered dimensions. ' +
    'It is NOT a permitted set of construction documents. Verify all field measurements, site conditions, and current Florida Building Code ' +
    'requirements (including local amendments) before fabrication or installation. This document does not substitute for approved permit ' +
    "drawings, a licensed structural engineer's review, or an architect's stamp where required by law. The designer / software provider " +
    'assumes no liability for errors, omissions, or code non-compliance resulting from use of this document.';

  const dLines = doc.splitTextToSize(disclaimerText, PW - M * 2 - 20);
  doc.setFillColor('#fff9e6');
  doc.roundedRect(M, y - 8, PW - M * 2, dLines.length * 12 + 20, 3, 3, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor('#5d4037');
  doc.text(dLines, M + 10, y + 5);

  pageFooter();

  doc.save(`${(project.name || 'project').replace(/[^a-z0-9_-]/gi, '_')}_stair_designer.pdf`);
}
