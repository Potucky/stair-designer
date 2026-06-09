import { jsPDF } from 'jspdf';
import { getTubeProfile, resolveTopRailSegments, getManualBottomRailSegments, getManualMiddleRailSegments, INtoU, TREAD_THICK, normalizeRailEndpoints } from '../geometry/railingGeometry.js';

export function generatePdf({ project, stairConfig, calc, warnings, materials, units = 'in', manualDimensions = [], manualPosts = [], manualTopRails = [], structureOffsetZIn = 0, topRailPathMode = 'standard' }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [792, 612] });
  const INCH_TO_MM = 25.4;
  const fmtDim = (inchVal, dec = 2) =>
    units === 'mm' ? `${(inchVal * INCH_TO_MM).toFixed(1)} mm` : `${inchVal.toFixed(dec)}"`;
  const fmtDimStr = (lenStr) =>
    units === 'mm' ? `${(parseFloat(lenStr) * INCH_TO_MM).toFixed(1)} mm` : `${lenStr}"`;
  const unitsLabel = units === 'mm' ? 'Metric Units (mm)' : 'Imperial Units (inches)';
  // Page 1 — landscape letter (792 × 612 pt)
  const LW = doc.internal.pageSize.getWidth();
  const LH = doc.internal.pageSize.getHeight();
  // Pages 2–4 — portrait letter (612 × 792 pt)
  const PW = 612;
  const PH = 792;
  const M = 48;

  const validManualPosts = (Array.isArray(manualPosts) ? manualPosts : []).filter((p) => {
    if (!p) return false;
    if (!isFinite(Number(p.xIn)) || !isFinite(Number(p.heightIn)) || Number(p.heightIn) <= 0) return false;
    if (p.surfaceType === 'bottomLanding' || p.surfaceType === 'topLanding') return true;
    if (p.stepIndex == null) return false;
    if (!(calc.treadPositions || [])[p.stepIndex]) return false;
    return isFinite(Number(p.offsetXIn));
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

  const pageHeader = (num, title, pw = PW, ph = PH) => {
    txt('STAIR DESIGNER', M, 40, { bold: true, size: 14, color: '#1a1a2e' });
    txt('v0.0.2', pw - M, 40, { size: 9, color: '#888888', align: 'right' });
    txt(title, M, 54, { size: 9, color: '#666666' });
    txt(`Page ${num} of 4`, pw - M, 54, { size: 9, color: '#888888', align: 'right' });
    hline(M, pw - M, 60, '#1a1a2e', 1);
    return 76;
  };

  const pageFooter = (pw = PW, ph = PH) => {
    hline(M, pw - M, ph - 36, '#cccccc');
    txt(
      `${project.name || 'Untitled Project'} — Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      pw / 2, ph - 22, { size: 8, color: '#888888', align: 'center' }
    );
  };

  // ── PAGE 1 — Side View Dimensioned Drawing ─────────────────────────────────

  let y = pageHeader(1, 'Side View — Dimensioned Drawing', LW, LH);

  const { height, run, steps } = stairConfig;
  const railLowerExtensionIn = stairConfig.railLowerExtensionIn ?? 0;
  const railUpperExtensionIn = stairConfig.railUpperExtensionIn ?? 0;
  const { riserHeight, treadDepth, angleDeg, stringerLength } = calc;

  const isBlackRailing = stairConfig.railingColorMode === 'black';
  const railColors = isBlackRailing
    ? { postFill: '#000000', postBorder: '#000000', postLabel: '#000000', railLine: '#000000', railLabel: '#000000', mrLine: '#000000', mrLabel: '#000000' }
    : { postFill: '#c47a3a', postBorder: '#7a4a1a', postLabel: '#5a3a10', railLine: '#8B6914', railLabel: '#5a4000', mrLine: '#2F7D7A', mrLabel: '#1A5553' };

  // Drawing area layout — landscape page (LW=792, LH=612)
  const dAreaX = M + 62;                         // room for H-dim label on left
  const dAreaW = LW - dAreaX - M - 12;           // ≈622 pts wide (landscape)

  // Safe drawing zone: below pageHeader content (returns y=76) and above footer line (y=576)
  const safeTop = 82;           // 76 + 6pt gap below header
  const safeBot = LH - 36 - 8; // 576 - 8pt margin above footer line → 568
  const safeH   = safeBot - safeTop; // 486 pt

  // Vertical extent: stair height + tallest post (or handrailHeight) + buffer for syToPdf offset.
  // syToPdf shifts rail tops up by (riserHeight/2 - TREAD_THICK/INtoU); riserHeight/2 covers it fully.
  const handrailH = stairConfig.handrailHeight ?? 36;
  const maxPostH  = validManualPosts.length > 0
    ? Math.max(...validManualPosts.map(p => Number(p.heightIn) || 0))
    : handrailH;
  const totalVisualH = height + Math.max(handrailH, maxPostH) + riserHeight / 2;

  const pad = 24;  // equal clearance above top element and below ground line

  const scaleX = (dAreaW * 0.80) / (run || 1);
  const scaleY = (safeH - 2 * pad) / (totalVisualH || 1);
  const sc     = Math.min(scaleX, scaleY);

  // Center block: equal top/bottom gaps within [safeTop, safeBot]
  const drawH   = totalVisualH * sc;
  const groundY = Math.round((safeTop + safeBot) / 2 + drawH / 2);

  const dw = run * sc;
  const dh = height * sc;
  const rPx = riserHeight * sc;
  const tPx = treadDepth * sc;

  // Stair origin: bottom-left corner, centred on the stair run
  const ox = dAreaX + (dAreaW - dw) / 2;
  const oy = groundY;

  const mirrored = structureOffsetZIn > 0;
  const mx = mirrored ? (x) => 2 * ox + dw - x : (x) => x;

  // Ground line
  doc.setDrawColor('#888888');
  doc.setLineWidth(1);
  doc.line(mx(ox - 28), oy, mx(ox + dw + 28), oy);

  // ── Bottom Landing (side view) ─────────────────────────────────────────────
  if (stairConfig.bottomLandingEnabled && stairConfig.bottomLandingLength > 0) {
    const landPx = stairConfig.bottomLandingLength * sc;
    const slabH = Math.max(4, 3.5 * sc);
    doc.setFillColor('#dce3ea');
    doc.setDrawColor('#1a1a2e');
    doc.setLineWidth(1.2);
    doc.rect(mirrored ? mx(ox) : ox - landPx, oy - slabH, landPx, slabH, 'FD');
  }

  // ── Top Landing (side view) ───────────────────────────────────────────────
  if (stairConfig.topLandingEnabled && stairConfig.topLandingLength > 0) {
    const landPx = stairConfig.topLandingLength * sc;
    const slabH = Math.max(4, 3.5 * sc);
    const lx = ox + dw - tPx;
    const ly = oy - dh; // top surface flush with last tread walking surface
    const tlx = mirrored ? mx(lx + landPx) : lx;
    doc.setFillColor('#dce3ea');
    doc.setDrawColor('#1a1a2e');
    doc.setLineWidth(1.2);
    doc.rect(tlx, ly, landPx, slabH, 'FD');
    // Light diagonal hatch inside landing rectangle
    doc.setDrawColor('#9aabb8');
    doc.setLineWidth(0.35);
    const hSpacing = 5;
    for (let d = 0; d <= landPx + slabH; d += hSpacing) {
      const x1 = tlx + Math.max(0, d - slabH);
      const y1 = ly + Math.min(slabH, d);
      const x2 = tlx + Math.min(landPx, d);
      const y2 = ly + Math.max(0, d - landPx);
      if (x1 !== x2 || y1 !== y2) doc.line(x1, y1, x2, y2);
    }
  }

  // Wall line — dashed vertical reference at left (or right when mirrored)
  doc.setDrawColor('#cccccc');
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([4, 3], 0);
  doc.line(mx(ox), oy + 8, mx(ox), oy - dh - 14);
  doc.setLineDashPattern([], 0);

  // Stair step profile
  doc.setDrawColor('#1a1a2e');
  doc.setLineWidth(2);
  {
    let sx = ox;
    let sy = oy;
    for (let i = 0; i < steps; i++) {
      doc.line(mx(sx), sy, mx(sx), sy - rPx);
      if (!(stairConfig.topLandingEnabled && i === steps - 1)) {
        doc.line(mx(sx), sy - rPx, mx(sx + tPx), sy - rPx);
      }
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
      doc.text(String(i + 1), mirrored ? mx(sx + tPx) + 3 : sx + 3, sy - rPx + 7);
      sx += tPx;
      sy -= rPx;
    }
  }

  // ── Manual Bottom Rails (side view) ──────────────────────────────────────
  if (stairConfig.bottomRailEnabled) {
    const bottomRailHeight = stairConfig.bottomRailHeight ?? 1;
    const brSegs = getManualBottomRailSegments(
      Array.isArray(manualTopRails) ? manualTopRails : [],
      validManualPosts,
      calc.treadPositions,
      calc.riserHeight,
      stairConfig.run,
      bottomRailHeight,
      0,
      0
    );

    const sxToPdf = mirrored
      ? (sx) => ox + dw / 2 - (sx / INtoU) * sc
      : (sx) => ox + dw / 2 + (sx / INtoU) * sc;
    const syToPdf = (sy) => oy - (sy / INtoU) * sc - rPx / 2 + (TREAD_THICK / INtoU) * sc;

    brSegs.forEach((seg, idx) => {
      const sx = sxToPdf(seg.start.x);
      const sy = syToPdf(seg.start.y);
      const ex = sxToPdf(seg.end.x);
      const ey = syToPdf(seg.end.y);

      doc.setDrawColor(railColors.railLine);
      doc.setLineWidth(Math.max(1.5, Math.min(sc, 6)));
      doc.line(sx, sy, ex, ey);
    });
  }

  // ── Manual Middle Rails (side view) ──────────────────────────────────────
  if (stairConfig.middleRailEnabled) {
    const { middleRailHeights = [], middleRailHeight } = stairConfig;
    const effectiveMiddleRailHeights = (Array.isArray(middleRailHeights) && middleRailHeights.length > 0)
      ? middleRailHeights
      : (middleRailHeight != null ? [middleRailHeight] : []);

    if (effectiveMiddleRailHeights.length > 0) {
      const sxToPdf = mirrored
        ? (sx) => ox + dw / 2 - (sx / INtoU) * sc
        : (sx) => ox + dw / 2 + (sx / INtoU) * sc;
      const syToPdf = (sy) => oy - (sy / INtoU) * sc - rPx / 2 + (TREAD_THICK / INtoU) * sc;

      effectiveMiddleRailHeights.forEach((height) => {
        const mrSegs = getManualMiddleRailSegments(
          Array.isArray(manualTopRails) ? manualTopRails : [],
          validManualPosts,
          calc.treadPositions,
          calc.riserHeight,
          stairConfig.run,
          height,
          0,
          0
        );

        mrSegs.forEach((seg) => {
          const sx = sxToPdf(seg.start.x);
          const sy = syToPdf(seg.start.y);
          const ex = sxToPdf(seg.end.x);
          const ey = syToPdf(seg.end.y);

          doc.setDrawColor(railColors.mrLine);
          doc.setLineWidth(Math.max(1.5, Math.min(sc, 6)));
          doc.line(sx, sy, ex, ey);
        });
      });
    }
  }

  // ── Manual Posts (side view) — rectangles drawn before Top Rail
  {
    const postProfile = getTubeProfile(stairConfig.tubeSize);
    const postW = Math.max(3, postProfile.width * sc);

    validManualPosts.forEach((post) => {
      let baseY;
      if (post.surfaceType === 'bottomLanding') {
        // Post sits on the visible top surface of the bottom landing slab
        const slabH = Math.max(4, 3.5 * sc);
        baseY = oy - slabH;
      } else if (post.surfaceType === 'topLanding') {
        baseY = oy - height * sc;
      } else {
        const tp = calc.treadPositions[post.stepIndex];
        if (!tp) return;
        baseY = oy - tp.y * sc;
      }

      const pxX   = mx(ox + (Number(post.xIn) + Number(post.offsetXIn || 0)) * sc);
      const postH = Number(post.heightIn) * sc;
      if (postH <= 0) return;

      const topY = baseY - postH;

      doc.setFillColor(railColors.postFill);
      doc.setDrawColor(railColors.postBorder);
      doc.setLineWidth(0.7);
      doc.rect(pxX - postW / 2, topY, postW, postH, 'FD');
    });
  }

  // ── Manual Top Rails (side view) — drawn after posts so Top Rail sits on top
  // Uses resolveTopRailSegments (shared with 3D and materials) so dogleg/custom route
  // geometry is represented honestly in the PDF side view.
  // syToPdf maps post-top scene Y → post-top PDF y (the top edge of the post rect).
  // Stroke is shifted up by lw/2 so its bottom face sits at the post top,
  // plus a tiny overlap (0.25 in) so no hairline gap appears.
  {
    const sxToPdf = mirrored
      ? (sx) => ox + dw / 2 - (sx / INtoU) * sc
      : (sx) => ox + dw / 2 + (sx / INtoU) * sc;
    const syToPdf = (sy) => oy - (sy / INtoU) * sc - rPx / 2 + (TREAD_THICK / INtoU) * sc;
    const lw = Math.max(1.5, Math.min(sc, 6));
    const overlapPts = 0.25 * sc;

    const railSegs = resolveTopRailSegments(
      Array.isArray(manualTopRails) ? manualTopRails : [],
      validManualPosts,
      calc.treadPositions,
      calc.riserHeight,
      stairConfig.run,
      railLowerExtensionIn,
      railUpperExtensionIn,
      topRailPathMode
    );

    const postProfile = getTubeProfile(stairConfig.tubeSize);
    const postW = Math.max(3, postProfile.width * sc);

    // Open-end flags used for post-face extension on straight segments only
    const normRails = (Array.isArray(manualTopRails) ? manualTopRails : []).map(normalizeRailEndpoints);
    const endPostIds   = new Set(normRails.filter(r => r.endEndpoint.anchorType   === 'post').map(r => r.endEndpoint.postId));
    const startPostIds = new Set(normRails.filter(r => r.startEndpoint.anchorType === 'post').map(r => r.startEndpoint.postId));
    const isOpenStart = (ep) => ep.anchorType !== 'post' || !endPostIds.has(ep.postId);
    const isOpenEnd   = (ep) => ep.anchorType !== 'post' || !startPostIds.has(ep.postId);

    railSegs.forEach((seg) => {
      let sx = sxToPdf(seg.start.x);
      let sy = syToPdf(seg.start.y) - lw / 2 + overlapPts;
      let ex = sxToPdf(seg.end.x);
      let ey = syToPdf(seg.end.y) - lw / 2 + overlapPts;

      // Post-face extension: only for standard straight segments (not dogleg, not custom route, not manual)
      const r = seg.rail;
      if (topRailPathMode === 'standard' && r && !r.doglegEnabled && !(Array.isArray(r.customRouteSegments) && r.customRouteSegments.length > 0)) {
        const perStartExt = r.startEndpoint?.extension?.type === 'straight' ? Math.max(0, Number(r.startEndpoint.extension.lengthIn) || 0) : 0;
        const perEndExt   = r.endEndpoint?.extension?.type   === 'straight' ? Math.max(0, Number(r.endEndpoint.extension.lengthIn)   || 0) : 0;
        const globalStartExt = isOpenStart(r.startEndpoint) ? Math.max(0, railLowerExtensionIn) : 0;
        const globalEndExt   = isOpenEnd(r.endEndpoint)     ? Math.max(0, railUpperExtensionIn) : 0;
        const horizDir = sx <= ex ? 1 : -1;
        if (isOpenStart(r.startEndpoint) && perStartExt + globalStartExt === 0) {
          sx -= horizDir * postW / 2;
        }
        if (isOpenEnd(r.endEndpoint) && perEndExt + globalEndExt === 0) {
          ex += horizDir * postW / 2;
        }
      }

      doc.setDrawColor(railColors.railLine);
      doc.setLineWidth(lw);
      doc.line(sx, sy, ex, ey);
    });
  }

  // ── Manual Post Labels (side view) — drawn last for readability
  {
    const postProfile = getTubeProfile(stairConfig.tubeSize);
    const postW = Math.max(3, postProfile.width * sc);

    validManualPosts.forEach((post, idx) => {
      let baseY;
      if (post.surfaceType === 'bottomLanding') {
        // Post sits on the visible top surface of the bottom landing slab
        const slabH = Math.max(4, 3.5 * sc);
        baseY = oy - slabH;
      } else if (post.surfaceType === 'topLanding') {
        baseY = oy - height * sc;
      } else {
        const tp = calc.treadPositions[post.stepIndex];
        if (!tp) return;
        baseY = oy - tp.y * sc;
      }

      const pxX   = mx(ox + (Number(post.xIn) + Number(post.offsetXIn || 0)) * sc);
      const postH = Number(post.heightIn) * sc;
      if (postH <= 0) return;

      const topY = baseY - postH;

      let label = `P${idx + 1}`;
      if (post.surfaceType === 'bottomLanding') label += ' BL';
      else if (post.surfaceType === 'topLanding') label += ' TL';
      else if (post.mount === 'side' && post.side && post.side !== 'center') {
        label += ` s${post.side[0].toUpperCase()}`;
      }
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(railColors.postLabel);
      if (mirrored) {
        doc.text(label, pxX - postW / 2 - 2, topY + 7, { align: 'right' });
      } else {
        doc.text(label, pxX + postW / 2 + 2, topY + 7);
      }
    });
  }

  // ── Manual Dimensions (side view) ────────────────────────────────────────
  // Uses the same syToPdf-compatible transform as posts/rails:
  //   ax = ox + dw/2 + xIn*sc   (xIn is scene X in inches, centred at 0)
  //   ay = oy - yIn*sc - rPx/2 + (TREAD_THICK/INtoU)*sc
  // The Y correction aligns scene hit-point Y with the visual tread/post positions in the PDF.
  if (Array.isArray(manualDimensions) && manualDimensions.length > 0) {
    const MD_COLOR = '#1e3a5f';
    const TICK = 8; // half-tick length in pts
    // Y correction: same offset used by syToPdf for rails/posts
    const yAdj = -rPx / 2 + (TREAD_THICK / INtoU) * sc;

    manualDimensions.forEach((dim) => {
      // xIn = scene_x / INtoU (centred at 0); add run/2 to make stair-relative, then scale.
      const axPdf = mx(ox + (dim.a.xIn + run / 2) * sc);
      const ayPdf = oy - dim.a.yIn * sc + yAdj;
      const bxPdf = mx(ox + (dim.b.xIn + run / 2) * sc);
      const byPdf = oy - dim.b.yIn * sc + yAdj;

      doc.setDrawColor(MD_COLOR);
      doc.setLineWidth(1.2);
      doc.line(axPdf, ayPdf, bxPdf, byPdf);

      const lineLen = Math.sqrt((bxPdf - axPdf) ** 2 + (byPdf - ayPdf) ** 2);
      if (lineLen > 0) {
        const px = (-(byPdf - ayPdf) / lineLen) * TICK;
        const py = ((bxPdf - axPdf) / lineLen) * TICK;
        doc.line(axPdf - px, ayPdf - py, axPdf + px, ayPdf + py);
        doc.line(bxPdf - px, byPdf - py, bxPdf + px, byPdf + py);
      }

      const mxPdf = (axPdf + bxPdf) / 2;
      const myPdf = (ayPdf + byPdf) / 2;
      const dimLabel = dim.label != null ? String(dim.label) : fmtDim(dim.measuredValueIn != null ? dim.measuredValueIn : 0, 2);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(MD_COLOR);
      if (dimLabel) doc.text(dimLabel, mxPdf, myPdf - 3, { align: 'center' });
    });
  }

  pageFooter(LW, LH);

  // ── PAGE 2 — Project Summary ───────────────────────────────────────────────

  doc.addPage([612, 792]);
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
  if (stairConfig.bottomLandingEnabled) {
    y = kv('Bottom Landing:', fmtDim(stairConfig.bottomLandingLength, 0), M, y);
  }
  if (stairConfig.topLandingEnabled) {
    y = kv('Top Landing:', fmtDim(stairConfig.topLandingLength, 0), M, y);
  }
  if (stairConfig.railingEnabled) {
    y = kv('Handrail Height:', fmtDim(stairConfig.handrailHeight, 0), M, y);
    y = kv('Max Pin / Guard Opening:', fmtDim(stairConfig.pinOpening, 3), M, y);
    y = kv('Post Spacing:', fmtDim(stairConfig.postSpacing, 0), M, y);
  }
  if (validManualPosts.length > 0) {
    y = kv('Manual Posts:', String(validManualPosts.length), M, y);
  }
  const resolvedRailSegs = resolveTopRailSegments(
    Array.isArray(manualTopRails) ? manualTopRails : [],
    validManualPosts,
    calc.treadPositions,
    calc.riserHeight,
    stairConfig.run,
    railLowerExtensionIn,
    railUpperExtensionIn,
    topRailPathMode
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

        let stepNum, mount, side;
        if (post.surfaceType === 'bottomLanding') {
          stepNum = 'BL'; mount = 'landing'; side = '—';
        } else if (post.surfaceType === 'topLanding') {
          stepNum = 'TL'; mount = 'landing'; side = '—';
        } else {
          stepNum = String(post.stepIndex + 1);
          mount   = post.mount || 'top';
          side    = post.side  || 'center';
        }
        const ht      = fmtDim(Number(post.heightIn), 2);
        const runPos  = fmtDim(Number(post.xIn) + Number(post.offsetXIn || 0), 2);

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
          topRailPathMode === 'manual' ? `MS${idx + 1}` : `TR${idx + 1}`,
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

  doc.addPage([612, 792]);
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

  doc.addPage([612, 792]);
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
