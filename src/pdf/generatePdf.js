import { jsPDF } from 'jspdf';

export function generatePdf({ project, stairConfig, calc, warnings, materials }) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = 612;
  const margin = 48;
  let y = margin;

  const lineH = 14;
  const sectionGap = 10;

  const drawLine = (x1, x2, yy, color = '#cccccc') => {
    doc.setDrawColor(color);
    doc.line(x1, yy, x2, yy);
  };

  const text = (str, x, yy, opts = {}) => {
    doc.setFontSize(opts.size || 10);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setTextColor(opts.color || '#000000');
    doc.text(str, x, yy);
  };

  const row = (label, value, x, yy) => {
    text(label, x, yy, { color: '#555555' });
    text(String(value), x + 160, yy, { bold: true });
    return yy + lineH;
  };

  const section = (title, yy) => {
    yy += sectionGap;
    drawLine(margin, W - margin, yy - 4, '#aaaaaa');
    text(title, margin, yy + 8, { bold: true, size: 10, color: '#222222' });
    return yy + 18;
  };

  // Header
  text('STAIR DESIGNER', margin, y, { bold: true, size: 18, color: '#1a1a2e' });
  text('v0.0.1 MVP', W - margin - 50, y, { size: 9, color: '#666666' });
  y += 18;
  text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, y, { size: 9, color: '#888888' });
  y += 6;
  drawLine(margin, W - margin, y, '#1a1a2e');
  y += 16;

  // Project
  y = section('PROJECT', y);
  y = row('Project Name:', project.name || '—', margin, y);
  y = row('Client:', project.client || '—', margin, y);
  y = row('Units:', 'Inches (Imperial)', margin, y);

  // Inputs
  y = section('STAIR INPUTS', y);
  y = row('Object Name:', 'Stair 1', margin, y);
  y = row('Total Height:', `${stairConfig.height}"`, margin, y);
  y = row('Total Run:', `${stairConfig.run}"`, margin, y);
  y = row('Width:', `${stairConfig.width}"`, margin, y);
  y = row('Steps:', stairConfig.steps, margin, y);
  y = row('Tube Size:', stairConfig.tubeSize, margin, y);
  y = row('Railing:', stairConfig.railingEnabled ? 'Yes' : 'No', margin, y);
  if (stairConfig.railingEnabled) {
    y = row('Handrail Height:', `${stairConfig.handrailHeight}"`, margin, y);
    y = row('Pin/Guard Opening:', `${stairConfig.pinOpening}"`, margin, y);
    y = row('Post Spacing:', `${stairConfig.postSpacing}"`, margin, y);
  }

  // Results
  y = section('CALCULATED RESULTS', y);
  y = row('Angle:', `${calc.angleDeg.toFixed(1)}°`, margin, y);
  y = row('Riser Height:', `${calc.riserHeight.toFixed(3)}"`, margin, y);
  y = row('Tread Depth:', `${calc.treadDepth.toFixed(3)}"`, margin, y);
  y = row('Stringer Length:', `${calc.stringerLength.toFixed(2)}"`, margin, y);
  if (stairConfig.railingEnabled) {
    y = row('Post Count:', calc.postCount, margin, y);
    y = row('Handrail Length:', `${calc.handrailLength.toFixed(2)}"`, margin, y);
  }

  // Warnings
  const errorWarnings = warnings.filter((w) => w.level !== 'info');
  if (errorWarnings.length > 0) {
    y = section('WARNINGS', y);
    for (const w of errorWarnings) {
      const color = w.level === 'error' ? '#cc0000' : '#aa6600';
      const prefix = w.level === 'error' ? 'ERROR: ' : 'WARNING: ';
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(color);
      const lines = doc.splitTextToSize(prefix + w.msg, W - margin * 2 - 8);
      doc.text(lines, margin + 4, y);
      y += lines.length * 12 + 2;
    }
  }

  // Material list
  y = section('MATERIAL / CUT LIST', y);
  const colW = [200, 40, 80, 110, 100];
  const cols = [margin, margin + colW[0], margin + colW[0] + colW[1], margin + colW[0] + colW[1] + colW[2], margin + colW[0] + colW[1] + colW[2] + colW[3]];
  text('Part', cols[0], y, { bold: true, size: 9 });
  text('Qty', cols[1], y, { bold: true, size: 9 });
  text('Length (in)', cols[2], y, { bold: true, size: 9 });
  text('Profile', cols[3], y, { bold: true, size: 9 });
  text('Note', cols[4], y, { bold: true, size: 9 });
  y += 4;
  drawLine(margin, W - margin, y, '#888888');
  y += 10;

  for (const item of materials) {
    text(item.part, cols[0], y, { size: 9 });
    text(String(item.qty), cols[1], y, { size: 9 });
    text(String(item.lengthIn), cols[2], y, { size: 9 });
    text(item.profile, cols[3], y, { size: 9 });
    text(item.note || '', cols[4], y, { size: 9 });
    y += 13;
  }

  // Disclaimer
  y += 10;
  drawLine(margin, W - margin, y, '#aaaaaa');
  y += 12;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor('#555555');
  const disclaimer =
    'CODE / ENGINEERING DISCLAIMER: This drawing is a fabrication-assist document generated from user-entered dimensions. ' +
    'Verify all field measurements, site conditions, current Florida Building Code requirements, local amendments, permit requirements, ' +
    'structural loads, anchors, welds, materials, and accessibility requirements before fabrication or installation. ' +
    'This document is not a substitute for approved permit drawings or a licensed engineer/architect review where required.';
  const dLines = doc.splitTextToSize(disclaimer, W - margin * 2);
  doc.text(dLines, margin, y);

  doc.save(`${(project.name || 'project').replace(/[^a-z0-9_-]/gi, '_')}_stair_designer.pdf`);
}
