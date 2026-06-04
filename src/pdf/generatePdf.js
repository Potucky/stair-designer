import { jsPDF } from 'jspdf';
import { getTubeProfile, getManualRailSegments, INtoU, TREAD_THICK } from '../geometry/railingGeometry.js';

export function generatePdf({ project, stairConfig, calc, warnings, materials, units = 'in', manualPosts = [], manualTopRails = [] }) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const INCH_TO_MM = 25.4;
  const fmtDim = (inchVal, dec = 2) =>
    units === 'mm' ? `${(inchVal * INCH_TO_MM).toFixed(1)} mm` : `${inchVal.toFixed(dec)}"`;
  const fmtDimStr = (lenStr) =>
    units === 'mm' ? `${(parseFloat(lenStr) * INCH_TO_MM).toFixed(1)} mm` : `${lenStr}"`;
  const unitsLabel = units === 'mm' ? 'Metric Units (mm)' : 'Imperial Units (inches)';
  const PW = 612;
  const PH = 792;
  const M = 48;

  const validManualPosts = (Array.isArray(manualPosts) ? manualPosts : []).filter((p) => {
    if (!p || p.stepIndex == null) return false;
    if (!(calc.treadPositions || [])[p.stepIndex]) return false;
    return isFinite(Number(p.xIn)) && isFinite(Number(p.offsetXIn)) && isFinite(Number(p.heightIn));
  });

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

  // ── PAGE 1 — Side View Dimensioned Drawing ─────────────────────────────────

  let y = pageHeader(1, 'Side View — Dimensioned Drawing');

  const { height, run, steps } = stairConfig;
  const { riserHeight, treadDepth, angleDeg, stringerLength } = calc;

  // Drawing area layout
  const dAreaX = M + 62;                         // room for H-dim label on left
  const dAreaY = y + 8;                          // just below header  (≈84)
  const dAreaW = PW - dAreaX - M - 12;           // ≈442 pts wide
  const dAreaH = 510;                            // drawing area height

  // Ground line sits 50 pts above the bottom of dArea (run-dim label below)
  const groundY = dAreaY + dAreaH - 50;          // ≈544

  const availAbovePts = groundY - dAreaY - 8;    // ≈452 pts headroom
  const scaleX = (dAreaW * 0.80) / (run || 1);
  const scaleY = availAbovePts / ((height || 1) * 1.08);
  const sc = Math.min(scaleX, scaleY);

  const dw = run * sc;
  const dh = height * sc;
  const rPx = riserHeight * sc;
  const tPx = treadDepth * sc;

  // Stair origin: bottom-left corner, centred on the stair run
  const ox = dAreaX + (dAreaW - dw) / 2;
  const oy = groundY;

  // Ground line
  doc.setDrawColor('#888888');
  doc.setLineWidth(1);
  doc.line(ox - 28, oy, ox + dw + 28, oy);

  // Wall line — dashed vertical reference at left
  doc.setDrawColor('#cccccc');
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([4, 3], 0);
  doc.line(ox, oy + 8, ox, oy - dh - 14);
  doc.setLineDashPattern([], 0);

  // Stair step profile
  doc.setDrawColor('#1a1a2e');
  doc.setLineWidth(2);
  {
    let sx = ox;
    let sy = oy;
    for (let i = 0; i < steps; i++) {
      doc.line(sx, sy, sx, sy - rPx);
      doc.line(sx, sy - rPx, sx + tPx, sy - rPx);
      sx += tPx;
      sy -= rPx;
    }
  }

  // Step numbers at inner tread corners
  {
    let sx = ox;
    let sy = oy;
    for (let i = 0; i < steps; i++) {
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#666666');
      doc.text(String(i + 1), sx + 2, sy - rPx - 2);
      sx += tPx;
      sy -= rPx;
    }
  }

  // Stringer — diagonal dashed blue line
  doc.setDrawColor('#3366cc');
  doc.setLineWidth(1.2);
  doc.setLineDashPattern([7, 3], 0);
  doc.line(ox, oy, ox + dw, oy - dh);
  doc.setLineDashPattern([], 0);

  // Stringer length label (alongside diagonal)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor('#3366cc');
  doc.text(`Stringer: ${fmtDim(stringerLength)}`, ox + dw / 2 + 6, oy - dh / 2 - 8);

  // ── Manual Posts (side view) ───────────────────────────────────────────────
  {
    const postProfile = getTubeProfile(stairConfig.tubeSize);
    const postW = Math.max(3, postProfile.width * sc);

    validManualPosts.forEach((post, idx) => {
      const tp = calc.treadPositions[post.stepIndex];

      const pxX   = ox + (Number(post.xIn) + Number(post.offsetXIn)) * sc;
      const baseY = oy - tp.y * sc;
      const postH = Number(post.heightIn) * sc;
      if (postH <= 0) return;

      const topY = baseY - postH;

      // Post rectangle — brown fill with dark border
      doc.setFillColor('#c47a3a');
      doc.setDrawColor('#7a4a1a');
      doc.setLineWidth(0.7);
      doc.rect(pxX - postW / 2, topY, postW, postH, 'FD');

      // Compact label near top of post
      let label = `P${idx + 1}`;
      if (post.mount === 'side' && post.side && post.side !== 'center') {
        label += ` s${post.side[0].toUpperCase()}`; // sL or sR
      }
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#5a3a10');
      doc.text(label, pxX + postW / 2 + 2, topY + 7);
    });
  }

  // ── Manual Top Rails (side view) ──────────────────────────────────────────
  // Uses getManualRailSegments so fixed-endpoint rails (post deleted) still render.
  // Scene coords → PDF: x = ox + dw/2 + sceneX/INtoU*sc
  //                     y = oy - sceneY/INtoU*sc - rPx/2 + (TREAD_THICK/INtoU)*sc
  {
    const railSegs = getManualRailSegments(
      Array.isArray(manualTopRails) ? manualTopRails : [],
      validManualPosts,
      calc.treadPositions,
      calc.riserHeight,
      stairConfig.run
    );

    const sxToPdf = (sx) => ox + dw / 2 + (sx / INtoU) * sc;
    const syToPdf = (sy) => oy - (sy / INtoU) * sc - rPx / 2 + (TREAD_THICK / INtoU) * sc;

    railSegs.forEach((seg, idx) => {
      const sx = sxToPdf(seg.start.x);
      const sy = syToPdf(seg.start.y);
      const ex = sxToPdf(seg.end.x);
      const ey = syToPdf(seg.end.y);

      doc.setDrawColor('#8B6914');
      doc.setLineWidth(Math.max(1.5, Math.min(sc, 6)));
      doc.line(sx, sy, ex, ey);

      const mx = (sx + ex) / 2;
      const my = (sy + ey) / 2 - 5;
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#5a4000');
      doc.text(`TR${idx + 1}`, mx, my);
    });
  }

  // ── Height dimension (left side) ──────────────────────────────────────────
  const hdX = ox - 42;
  doc.setDrawColor('#555555');
  doc.setLineWidth(0.5);
  doc.line(hdX, oy, hdX, oy - dh);
  doc.line(hdX - 5, oy, hdX + 5, oy);
  doc.line(hdX - 5, oy - dh, hdX + 5, oy - dh);
  doc.line(hdX - 3, oy - 9, hdX, oy);
  doc.line(hdX + 3, oy - 9, hdX, oy);
  doc.line(hdX - 3, oy - dh + 9, hdX, oy - dh);
  doc.line(hdX + 3, oy - dh + 9, hdX, oy - dh);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#1a1a2e');
  doc.text(`H = ${fmtDim(height, 0)}`, hdX - 7, oy - dh / 2 + 4, { align: 'right' });

  // ── Run dimension (bottom) ─────────────────────────────────────────────────
  const rdY = oy + 34;
  doc.setDrawColor('#555555');
  doc.setLineWidth(0.5);
  doc.line(ox, rdY, ox + dw, rdY);
  doc.line(ox, rdY - 5, ox, rdY + 5);
  doc.line(ox + dw, rdY - 5, ox + dw, rdY + 5);
  doc.line(ox + 6, rdY - 4, ox, rdY);
  doc.line(ox + 6, rdY + 4, ox, rdY);
  doc.line(ox + dw - 6, rdY - 4, ox + dw, rdY);
  doc.line(ox + dw - 6, rdY + 4, ox + dw, rdY);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#1a1a2e');
  doc.text(`Run = ${fmtDim(run, 0)}`, ox + dw / 2, rdY + 13, { align: 'center' });

  // ── Angle arc at base ──────────────────────────────────────────────────────
  const arcR = 36;
  const angleRad = (angleDeg * Math.PI) / 180;
  doc.setDrawColor('#cc6600');
  doc.setLineWidth(0.9);
  for (let i = 1; i <= 20; i++) {
    const a0 = ((i - 1) / 20) * angleRad;
    const a1 = (i / 20) * angleRad;
    doc.line(
      ox + arcR * Math.cos(a0), oy - arcR * Math.sin(a0),
      ox + arcR * Math.cos(a1), oy - arcR * Math.sin(a1)
    );
  }
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#cc6600');
  doc.text(`${angleDeg.toFixed(1)}°`, ox + arcR + 5, oy - arcR * 0.58);

  // ── Riser + Tread callout on first step ───────────────────────────────────
  if (steps > 0) {
    const callX = ox + tPx + 14;
    const callRY = oy - rPx * 0.55;
    const callTY = callRY + 14;
    doc.setDrawColor('#666666');
    doc.setLineWidth(0.4);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(ox, oy - rPx / 2, callX - 2, callRY);
    doc.line(ox + tPx / 2, oy - rPx, callX - 2, callTY);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#1a1a2e');
    doc.text(`R = ${fmtDim(riserHeight, 3)}`, callX, callRY + 3);
    doc.text(`T = ${fmtDim(treadDepth, 3)}`, callX, callTY + 3);
  }

  // ── Top-view width inset ───────────────────────────────────────────────────
  const insetW = 138;
  const insetH = 56;
  const insetX = PW - M - insetW;   // right-aligned to page margin
  const insetY = oy + 55;            // below run-dimension label

  doc.setFillColor('#f0f4ff');
  doc.setDrawColor('#1a1a2e');
  doc.setLineWidth(0.6);
  doc.roundedRect(insetX, insetY, insetW, insetH, 3, 3, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#1a1a2e');
  doc.text('TOP VIEW (width detail)', insetX + insetW / 2, insetY + 10, { align: 'center' });

  const tvPad = 10;
  const tvX1 = insetX + tvPad;
  const tvX2 = insetX + insetW - tvPad;
  const tvY1 = insetY + 16;
  const tvY2 = insetY + insetH - 9;
  doc.setDrawColor('#1a1a2e');
  doc.setLineWidth(1.2);
  doc.rect(tvX1, tvY1, tvX2 - tvX1, tvY2 - tvY1);

  const tvMidY = (tvY1 + tvY2) / 2;
  doc.setDrawColor('#555555');
  doc.setLineWidth(0.5);
  doc.line(tvX1, tvMidY, tvX2, tvMidY);
  doc.line(tvX1 + 5, tvMidY - 3, tvX1, tvMidY);
  doc.line(tvX1 + 5, tvMidY + 3, tvX1, tvMidY);
  doc.line(tvX2 - 5, tvMidY - 3, tvX2, tvMidY);
  doc.line(tvX2 - 5, tvMidY + 3, tvX2, tvMidY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#1a1a2e');
  doc.text(`Stair Width = ${fmtDim(stairConfig.width, 0)}`, insetX + insetW / 2, tvMidY + 11, { align: 'center' });

  pageFooter();

  // ── PAGE 2 — Project Summary ───────────────────────────────────────────────

  doc.addPage();
  y = pageHeader(2, 'Project Summary');

  doc.setFillColor('#f0f4ff');
  doc.roundedRect(M, y, PW - M * 2, 44, 4, 4, 'F');
  txt(project.name || 'Untitled Project', M + 10, y + 16, { bold: true, size: 14, color: '#1a1a2e' });
  txt(`Client: ${project.client || '—'}`, M + 10, y + 32, { size: 10, color: '#444444' });
  txt(
    new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    PW - M - 10, y + 16, { size: 9, color: '#666666', align: 'right' }
  );
  txt(unitsLabel, PW - M - 10, y + 32, { size: 9, color: '#666666', align: 'right' });
  y += 56;

  y = sectionHead('STAIR INPUTS', y);
  y = kv('Total Height:', fmtDim(stairConfig.height, 0), M, y);
  y = kv('Total Run:', fmtDim(stairConfig.run, 0), M, y);
  y = kv('Width:', fmtDim(stairConfig.width, 0), M, y);
  y = kv('Number of Steps:', String(stairConfig.steps), M, y);
  y = kv('Tube Size:', stairConfig.tubeSize, M, y);
  y = kv('Railing:', stairConfig.railingEnabled ? 'Yes' : 'No', M, y);
  if (stairConfig.railingEnabled) {
    y = kv('Handrail Height:', fmtDim(stairConfig.handrailHeight, 0), M, y);
    y = kv('Max Pin / Guard Opening:', fmtDim(stairConfig.pinOpening, 3), M, y);
    y = kv('Post Spacing:', fmtDim(stairConfig.postSpacing, 0), M, y);
  }
  if (validManualPosts.length > 0) {
    y = kv('Manual Posts:', String(validManualPosts.length), M, y);
  }
  const resolvedRailSegs = getManualRailSegments(
    Array.isArray(manualTopRails) ? manualTopRails : [],
    validManualPosts,
    calc.treadPositions,
    calc.riserHeight,
    stairConfig.run
  );
  if (resolvedRailSegs.length > 0) {
    y = kv('Top Rails:', String(resolvedRailSegs.length), M, y);
  }
  y += 8;

  y = sectionHead('CALCULATED RESULTS', y);

  const halfW = (PW - M * 2 - 20) / 2;
  let yL = y;
  let yR = y;

  const rowL = (label, value) => { yL = kv(label, value, M, yL, 140); };
  const rowR = (label, value) => { yR = kv(label, value, M + halfW + 20, yR, 160); };

  rowL('Angle:', `${calc.angleDeg.toFixed(1)}°`);
  rowL('Riser Height:', fmtDim(calc.riserHeight, 3));
  rowL('Tread Depth:', fmtDim(calc.treadDepth, 3));
  rowL('Stringer Length:', fmtDim(calc.stringerLength));

  const errCount = warnings.filter((w) => w.level === 'error').length;
  const warnCount = warnings.filter((w) => w.level === 'warning').length;
  rowR('Code Errors:', errCount === 0 ? 'None' : String(errCount));
  rowR('Code Warnings:', warnCount === 0 ? 'None' : String(warnCount));

  // ── Manual Post Schedule (page 2, if posts exist and space permits) ────────
  if (validManualPosts.length > 0) {
    y = Math.max(yL, yR) + 16;

    const rowH   = 14;
    const tableH = 30 + validManualPosts.length * rowH;

    if (y + tableH < PH - 60) {
      y = sectionHead('MANUAL POST SCHEDULE', y);

      const pcW = [36, 36, 46, 46, 62, 62];
      const cols = (() => {
        const xs = [M];
        for (let i = 0; i < pcW.length - 1; i++) xs.push(xs[i] + pcW[i]);
        return xs;
      })();
      const headers = ['Post', 'Step', 'Mount', 'Side', 'Height', 'Run Pos'];

      doc.setFillColor('#1a1a2e');
      doc.rect(M, y - 10, PW - M * 2, 16, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#ffffff');
      headers.forEach((h, i) => doc.text(h, cols[i] + 3, y + 1));
      y += 12;

      let rowAlt = false;
      validManualPosts.forEach((post, idx) => {
        if (rowAlt) {
          doc.setFillColor('#f5f7fa');
          doc.rect(M, y - 9, PW - M * 2, rowH, 'F');
        }
        rowAlt = !rowAlt;

        const stepNum = String(post.stepIndex + 1);
        const mount   = post.mount || 'top';
        const side    = post.side  || 'center';
        const ht      = fmtDim(Number(post.heightIn), 2);
        const runPos  = fmtDim(Number(post.xIn) + Number(post.offsetXIn), 2);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor('#222222');
        const row = [`P${idx + 1}`, stepNum, mount, side, ht, runPos];
        row.forEach((cell, i) => doc.text(cell, cols[i] + 3, y));
        y += rowH;
      });
    } else {
      y = Math.max(yL, yR) + 16;
      txt('Manual Post Schedule omitted: not enough page space.', M, y, { italic: true, size: 8, color: '#888888' });
      y += 14;
    }
  }

  // ── Top Rail Schedule (page 2) ────────────────────────────────────────────
  // Includes rails with fixed endpoints (post deleted). Endpoint labels:
  //   live post → P1, P2, …   |   fixed/detached → Fixed
  if (resolvedRailSegs.length > 0) {
    y += 8;
    const rowH = 14;
    const tableH = 30 + resolvedRailSegs.length * rowH;

    if (y + tableH < PH - 60) {
      y = sectionHead('TOP RAIL SCHEDULE', y);

      const rcW = [40, 80, 80, 80];
      const rcols = (() => {
        const xs = [M];
        for (let i = 0; i < rcW.length - 1; i++) xs.push(xs[i] + rcW[i]);
        return xs;
      })();
      const rHeaders = ['Rail', 'From', 'To', 'Length'];

      doc.setFillColor('#1a1a2e');
      doc.rect(M, y - 10, PW - M * 2, 16, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#ffffff');
      rHeaders.forEach((h, i) => doc.text(h, rcols[i] + 3, y + 1));
      y += 12;

      const endpointLabel = (endpoint) => {
        if (endpoint.anchorType === 'post') {
          const pi = validManualPosts.findIndex(p => p.id === endpoint.postId);
          return pi >= 0 ? `P${pi + 1}` : 'Fixed';
        }
        return 'Fixed';
      };

      let rAlt = false;
      resolvedRailSegs.forEach((seg, idx) => {
        if (rAlt) {
          doc.setFillColor('#f5f7fa');
          doc.rect(M, y - 9, PW - M * 2, rowH, 'F');
        }
        rAlt = !rAlt;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor('#222222');
        const row = [
          `TR${idx + 1}`,
          endpointLabel(seg.rail.startEndpoint),
          endpointLabel(seg.rail.endEndpoint),
          fmtDim(seg.lengthIn, 2),
        ];
        row.forEach((cell, i) => doc.text(cell, rcols[i] + 3, y));
        y += rowH;
      });
    }
  }

  pageFooter();

  // ── PAGE 3 — Material / Cut List ──────────────────────────────────────────

  doc.addPage();
  y = pageHeader(3, 'Material / Cut List');

  y = sectionHead('BILL OF MATERIALS', y);

  const cW = [180, 40, 90, 120, 0];
  const cx = [M, M + cW[0], M + cW[0] + cW[1], M + cW[0] + cW[1] + cW[2], M + cW[0] + cW[1] + cW[2] + cW[3]];

  doc.setFillColor('#1a1a2e');
  doc.rect(M, y - 10, PW - M * 2, 18, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#ffffff');
  doc.text('Part', cx[0] + 4, y + 3);
  doc.text('Qty', cx[1] + 4, y + 3);
  doc.text(`Length (${units === 'mm' ? 'mm' : 'in'})`, cx[2] + 4, y + 3);
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
    doc.text(fmtDimStr(item.lengthIn), cx[2] + 4, y);
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

  y = sectionHead('MVP VALIDATION NOTES', y);

  const errors = warnings.filter((w) => w.level === 'error');
  const warns = warnings.filter((w) => w.level === 'warning');
  const allIssues = [...errors, ...warns];

  if (allIssues.length === 0) {
    doc.setFillColor('#e8f5e9');
    doc.roundedRect(M, y - 8, PW - M * 2, 28, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#1b5e20');
    doc.text('No MVP validation errors or warnings — verify against current local code before building.', M + 12, y + 8);
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
  y = sectionHead('Residential Code Reference Notes — Verify Locally', y);

  const rH = calc.riserHeight;
  const tD = calc.treadDepth;
  const hH = stairConfig.handrailHeight;
  const pO = stairConfig.pinOpening;
  const rail = stairConfig.railingEnabled;

  const codeRows = [
    {
      section: 'FBC Res. R311.7.5.1',
      req: 'Max riser height: 7¾" (7.750")',
      status: rH > 7.75 ? 'FAIL' : 'OK',
    },
    {
      section: 'FBC Res. R311.7.5.2',
      req: 'Min tread depth: 10"',
      status: tD < 10 ? 'FAIL' : 'OK',
    },
    {
      section: 'FBC Res. R311.7.8.1',
      req: 'Handrail height: 34"–38" above nosing',
      status: rail ? (hH < 34 || hH > 38 ? 'FAIL' : 'OK') : 'N/A',
    },
    {
      section: 'FBC Res. R312.1.3',
      req: 'Guard openings: max 4" (sphere test)',
      status: rail ? (pO > 4 ? 'FAIL' : 'OK') : 'N/A',
    },
    {
      section: 'Note',
      req: 'Stair width, occupancy type, and additional requirements vary by jurisdiction and code edition. Verify locally.',
      status: null,
    },
  ];

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
    'FABRICATION HELPER — NOT A CODE-COMPLIANCE DOCUMENT: This output is generated from user-entered dimensions as a ' +
    'fabrication aid only. It is NOT a permitted set of construction documents and does not represent full code compliance. ' +
    'Local jurisdiction, project type, occupancy classification, field measurements, structural requirements, and the current ' +
    'Florida Building Code edition (including local amendments) must be verified before fabrication or installation. ' +
    'This document does not substitute for approved permit drawings, a licensed structural engineer\'s review, or an ' +
    'architect\'s stamp where required by law. Obtain all required permits before building. The designer / software provider ' +
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
