import { jsPDF } from 'jspdf';
import { getTubeProfile, getManualPostBase, getManualPostTop, resolveTopRailSegments, getManualBottomRailSegments, getManualMiddleRailSegments, calcInfillCount, INtoU, TREAD_THICK, normalizeRailEndpoints, resolveManualPostSection } from '../geometry/railingGeometry.js';
import { formatInchesFraction } from '../utils/units.js';

function parseSectionIn(section, defaultW, defaultH) {
  if (section) {
    const parts = String(section).split(/\s*[xX]\s*/).map(s => parseFloat(s.trim()));
    if (parts.length === 2 && parts.every(n => Number.isFinite(n) && n > 0)) {
      return { w: parts[0], h: parts[1] };
    }
  }
  return { w: defaultW, h: defaultH };
}

export function generatePdf({ project, stairConfig, calc, warnings, materials, units = 'in', manualDimensions = [], manualPosts = [], manualTopRails = [], manualTextAnnotations = [], pdfMirrored = false, topRailPathMode = 'standard', mode = 'save', pdfDrafts = null, primaryPageType = 'side' }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [792, 612] });
  const INCH_TO_MM = 25.4;
  const fmtDim = (inchVal) =>
    units === 'mm'
      ? `${(inchVal * INCH_TO_MM).toFixed(1)} mm`
      : units === 'in16'
        ? `${formatInchesFraction(inchVal, 16)}"`
        : `${formatInchesFraction(inchVal, 8)}"`;
  const fmtDimStr = (lenStr) => {
    const n = parseFloat(lenStr);
    return units === 'mm'
      ? `${(n * INCH_TO_MM).toFixed(1)} mm`
      : units === 'in16'
        ? `${formatInchesFraction(n, 16)}"`
        : `${formatInchesFraction(n, 8)}"`;
  };
  const unitsLabel = units === 'mm' ? 'Metric Units — mm' : units === 'in16' ? 'Imperial Units — Inch 1/16' : 'Imperial Units — Inch 1/8';
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

  const effectiveManualPosts = (() => {
    if (!stairConfig.railingSideMode) return validManualPosts;
    const isRight = stairConfig.railingSideMode === 'right';
    const profile = getTubeProfile(stairConfig.tubeSize);
    return validManualPosts.map((post) => {
      const resolvedSection = resolveManualPostSection(post, stairConfig.post1Section, stairConfig.post2Section, stairConfig.tubeSize);
      const { h: secD } = parseSectionIn(resolvedSection, profile.width, profile.width);
      const postHalfZIn = secD / 2;
      const zIn = isRight
        ? Number(stairConfig.width) / 2 - postHalfZIn
        : -Number(stairConfig.width) / 2 + postHalfZIn;
      return { ...post, zIn };
    });
  })();

  const getCompactPosts = () => {
    const p1 = effectiveManualPosts.find(p => p.compactSlot === 'post1') ?? effectiveManualPosts[0];
    const p2 = effectiveManualPosts.find(p => p.compactSlot === 'post2') ?? effectiveManualPosts[1];
    return p1 && p2 ? { p1, p2 } : null;
  };

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

  const pageHeader = (num, title, pw = PW, total = 4) => {
    txt('STAIR DESIGNER', M, 40, { bold: true, size: 14, color: '#1a1a2e' });
    txt('v0.0.2', pw - M, 40, { size: 9, color: '#888888', align: 'right' });
    txt(title, M, 54, { size: 9, color: '#666666' });
    txt(`Page ${num} of ${total}`, pw - M, 54, { size: 9, color: '#888888', align: 'right' });
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

  let y = 0;

  const { height, run, steps } = stairConfig;
  const railLowerExtensionIn = stairConfig.railLowerExtensionIn ?? 0;
  const railUpperExtensionIn = stairConfig.railUpperExtensionIn ?? 0;
  const { riserHeight, treadDepth } = calc;

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

  const sideViewMirrored = Boolean(pdfMirrored) || stairConfig.railingSideMode === 'right';
  const mirrored = sideViewMirrored;
  const mx = sideViewMirrored ? (x) => 2 * ox + dw - x : (x) => x;

  if (primaryPageType === 'threeD') {
    // ── PAGE 1 — 3D View Dimensioned Drawing ──────────────────────────────
    // Full-page white fill, then 3D capture image at 0,0,LW,LH so normalized
    // annotation coords (captured relative to overlay) align exactly.
    const _td = pdfDrafts?.threeD;
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, LW, LH, 'F');
    if (_td?.backgroundImage) {
      // eslint-disable-next-line no-empty
      try { doc.addImage(_td.backgroundImage, 'PNG', 0, 0, LW, LH); } catch {}
    }
    // White header band drawn on top of image
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, LW, 64, 'F');
    pageHeader(1, '3D View — Dimensioned Drawing', LW, 1);
    // Dimensions — normalized 0..1 → full-page pt coords
    const _DC = '#1e3a5f';
    (Array.isArray(_td?.dimensions) ? _td.dimensions : []).forEach(dim => {
      if (!dim || !isFinite(dim.ax) || !isFinite(dim.ay) || !isFinite(dim.bx) || !isFinite(dim.by)) return;
      const ax = dim.ax * LW, ay = dim.ay * LH, bx = dim.bx * LW, by = dim.by * LH;
      const len = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
      if (len < 5) return;
      const midX = (ax + bx) / 2, midY = (ay + by) / 2;

      // Unit direction A→B and perpendicular
      const oux = (bx - ax) / len, ouy = (by - ay) / len;
      const apx = -ouy, apy = oux;

      // Main dimension line
      doc.setDrawColor(_DC); doc.setLineWidth(1.2);
      doc.line(ax, ay, bx, by);

      // Filled arrowhead triangles at both ends
      doc.setFillColor(30, 58, 95);
      const _AL = 10, _AW = 4;
      doc.triangle(ax, ay,
        ax + oux * _AL + apx * _AW, ay + ouy * _AL + apy * _AW,
        ax + oux * _AL - apx * _AW, ay + ouy * _AL - apy * _AW, 'F');
      doc.triangle(bx, by,
        bx - oux * _AL + apx * _AW, by - ouy * _AL + apy * _AW,
        bx - oux * _AL - apx * _AW, by - ouy * _AL - apy * _AW, 'F');

      // Label position: offset perpendicular to line on the "above/left" side
      // Normalize direction to rightward-or-upward so offset is always consistent
      let nux = oux, nuy = ouy;
      if (nux < 0 || (nux === 0 && nuy > 0)) { nux = -nux; nuy = -nuy; }
      const lPerpX = nuy, lPerpY = -nux;
      const _LOFF = 14;
      const lx = midX + lPerpX * _LOFF;
      const ly = midY + lPerpY * _LOFF;

      // Angle: normalize to [-90, 90) so text reads left-to-right or bottom-to-top
      // _angleDeg is the screen-CW angle (atan2 in y-down coords, same as SVG rotate()).
      // jsPDF doc.text({ angle }) is CCW-positive, opposite of SVG rotate() — so negate.
      let _angleDeg = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
      if (_angleDeg >= 90) _angleDeg -= 180;
      else if (_angleDeg < -90) _angleDeg += 180;
      const _jsPdfAngle = -_angleDeg; // negate: jsPDF CCW != SVG CW in y-down space

      const _lbl = String(dim.label ?? 'DIM');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      const _tw = doc.getTextWidth(_lbl);
      const _lpad = 3, _rw = _tw + _lpad * 2, _rh = 10;

      // Rotated white background rect (two triangles)
      const cosA = Math.cos(_angleDeg * Math.PI / 180);
      const sinA = Math.sin(_angleDeg * Math.PI / 180);
      // SVG CW rotation: x' = cx*cosA - cy*sinA + lx, y' = cx*sinA + cy*cosA + ly
      const _rc = [[-_rw / 2, -_rh / 2], [_rw / 2, -_rh / 2], [_rw / 2, _rh / 2], [-_rw / 2, _rh / 2]]
        .map(([cx, cy]) => [lx + cx * cosA - cy * sinA, ly + cx * sinA + cy * cosA]);
      doc.setFillColor(255, 255, 255);
      doc.triangle(_rc[0][0], _rc[0][1], _rc[1][0], _rc[1][1], _rc[2][0], _rc[2][1], 'F');
      doc.triangle(_rc[0][0], _rc[0][1], _rc[2][0], _rc[2][1], _rc[3][0], _rc[3][1], 'F');

      // Label text with rotation
      doc.setTextColor(_DC); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text(_lbl, lx, ly, { angle: _jsPdfAngle, align: 'center', baseline: 'middle' });
    });
    // Texts
    (Array.isArray(_td?.texts) ? _td.texts : []).forEach(ann => {
      if (!ann || !isFinite(ann.x) || !isFinite(ann.y) || !ann.text) return;
      const _x = ann.x * LW, _y = ann.y * LH, _t = String(ann.text);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      const _tw = doc.getTextWidth(_t), _pad = 3;
      doc.setFillColor(255, 255, 255); doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.4);
      doc.rect(_x - _pad, _y - 8, _tw + _pad * 2, 11, 'FD');
      doc.setTextColor('#1a1a2e'); doc.text(_t, _x, _y);
    });
    // White footer band
    doc.setFillColor(255, 255, 255);
    doc.rect(0, LH - 44, LW, 44, 'F');
    pageFooter(LW, LH);
    // 3D PDF mode: single page only — save and return without adding pages 2-4
    if (mode === 'print') {
      doc.autoPrint();
      return doc.output('bloburl');
    }
    doc.save(`${(project.name || 'project').replace(/[^a-z0-9_-]/gi, '_')}_stair_designer.pdf`);
    return;
  } else {
    y = pageHeader(1, 'Side View — Dimensioned Drawing', LW);

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
      doc.text(String(i + 1), mirrored ? mx(sx) - 3 : sx + 3, sy - rPx + 7, mirrored ? { align: 'right' } : {});
      sx += tPx;
      sy -= rPx;
    }
  }

  // ── Manual Bottom Rails (side view) ──────────────────────────────────────
  if (stairConfig.bottomRailEnabled) {
    const bottomRailHeight = stairConfig.bottomRailHeight ?? 1;
    const brSegs = getManualBottomRailSegments(
      Array.isArray(manualTopRails) ? manualTopRails : [],
      effectiveManualPosts,
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

    brSegs.forEach((seg) => {
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
          effectiveManualPosts,
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
    effectiveManualPosts.forEach((post) => {
      const postSection = resolveManualPostSection(post, stairConfig.post1Section, stairConfig.post2Section, stairConfig.tubeSize);
      const postW = Math.max(3, getTubeProfile(postSection).width * sc);

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
      effectiveManualPosts,
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

  // ── Compact Railing Assembly (side view) ─────────────────────────────────
  // Mirrors the live compact renderers: Post 1/Post 2 are resolved by compactSlot
  // first, side mode is applied at render time, and the bottom channel centerline
  // stays aligned to the post centerline.
  {
    const compact = getCompactPosts();
    const compactTopEnabled = stairConfig.compactTopHandrailEnabled !== false;
    const compactBottomEnabled = stairConfig.compactBottomChannelEnabled !== false;
    const infillType = stairConfig.infillType ?? 'none';

    if (compact && (compactTopEnabled || compactBottomEnabled || infillType !== 'none')) {
      const { p1, p2 } = compact;
      const p1Base = getManualPostBase(p1, calc.treadPositions, calc.riserHeight, stairConfig.run);
      const p2Base = getManualPostBase(p2, calc.treadPositions, calc.riserHeight, stairConfig.run);
      const p1Top = getManualPostTop(p1, calc.treadPositions, calc.riserHeight, stairConfig.run);
      const p2Top = getManualPostTop(p2, calc.treadPositions, calc.riserHeight, stairConfig.run);

      if (p1Base && p2Base && p1Top && p2Top) {
        const sxToPdf = mirrored
          ? (sx) => ox + dw / 2 - (sx / INtoU) * sc
          : (sx) => ox + dw / 2 + (sx / INtoU) * sc;
        const syToPdf = (sy) => oy - (sy / INtoU) * sc - rPx / 2 + (TREAD_THICK / INtoU) * sc;
        const drawSceneLine = (start, end, color, widthPt) => {
          doc.setDrawColor(color);
          doc.setLineWidth(widthPt);
          doc.line(sxToPdf(start.x), syToPdf(start.y), sxToPdf(end.x), syToPdf(end.y));
        };

        const { h: handrailHIn } = parseSectionIn(stairConfig.handrailSection, 2, 1);
        const { h: channelHIn } = parseSectionIn(stairConfig.bottomChannelSection, 2, 1);
        const topRailWidthPt = Math.max(1.5, handrailHIn * sc);
        const channelWidthPt = Math.max(1.5, channelHIn * sc);
        const bottomColor = isBlackRailing ? '#000000' : '#2a8a3a';

        const compactBottomFacePoints = () => {
          const r_u = stairConfig.run * INtoU;
          const rH_u = calc.riserHeight * INtoU;
          const stepCount = calc.treadPositions.length;
          const tD_u = stepCount > 0 ? (stairConfig.run / stepCount) * INtoU : 0;
          if (tD_u <= 0) {
            return {
              p1: { x: p1Base.x, y: p1Base.y + 1 * INtoU, z: p1Base.z },
              p2: { x: p2Base.x, y: p2Base.y + 1 * INtoU, z: p2Base.z },
            };
          }
          const nosingSlope = rH_u / tD_u;
          const p1NosingY = nosingSlope * (p1Base.x + r_u / 2) + 0.5 * rH_u + TREAD_THICK;
          const p2NosingY = nosingSlope * (p2Base.x + r_u / 2) + 0.5 * rH_u + TREAD_THICK;
          return {
            p1: { x: p1Base.x, y: p1NosingY + 1 * INtoU, z: p1Base.z },
            p2: { x: p2Base.x, y: p2NosingY + 1 * INtoU, z: p2Base.z },
          };
        };

        const bottomFace = compactBottomEnabled
          ? compactBottomFacePoints()
          : {
              p1: { x: p1Base.x, y: p1Base.y + (stairConfig.bottomRailHeight ?? 1) * INtoU, z: p1Base.z },
              p2: { x: p2Base.x, y: p2Base.y + (stairConfig.bottomRailHeight ?? 1) * INtoU, z: p2Base.z },
            };

        if (compactBottomEnabled) {
          const channelHalfH = (channelHIn / 2) * INtoU;
          drawSceneLine(
            { x: bottomFace.p1.x, y: bottomFace.p1.y + channelHalfH, z: p1Base.z },
            { x: bottomFace.p2.x, y: bottomFace.p2.y + channelHalfH, z: p1Base.z },
            bottomColor,
            channelWidthPt
          );
        }

        if (infillType && infillType !== 'none') {
          const sdx = p2Base.x - p1Base.x;
          const sdy = p2Base.y - p1Base.y;
          const sdz = p2Base.z - p1Base.z;
          const spanScene = Math.sqrt(sdx * sdx + sdy * sdy + sdz * sdz);
          const spanIn = spanScene / INtoU;
          const postWidthIn = getTubeProfile(stairConfig.tubeSize).width;
          const topShift = compactTopEnabled ? 0.25 * INtoU : 0;
          const bottomShift = compactBottomEnabled ? 0.25 * INtoU : 0;
          const infillColor = isBlackRailing
            ? '#000000'
            : infillType === 'horizontalCable'
              ? '#dc2626'
              : infillType === 'horizontalPicket'
                ? '#8b5cf6'
                : '#2F7D7A';

          if (spanIn > 0.1 && (infillType === 'vertical' || infillType === 'verticalPicket')) {
            const thickIn = Number(stairConfig.verticalPicketThicknessIn ?? 1);
            const clearIn = spanIn - postWidthIn;
            const n = Number.isFinite(thickIn) && thickIn > 0 ? calcInfillCount(clearIn, thickIn) : 0;
            if (n > 0) {
              const gapIn = (clearIn - n * thickIn) / (n + 1);
              const halfPostIn = postWidthIn / 2;
              doc.setDrawColor(infillColor);
              doc.setLineWidth(Math.max(0.8, thickIn * sc));
              for (let i = 0; i < n; i++) {
                const distIn = halfPostIn + gapIn + i * (gapIn + thickIn) + thickIn / 2;
                const t = distIn / spanIn;
                const px = p1Base.x + t * sdx;
                const btmY = bottomFace.p1.y + t * (bottomFace.p2.y - bottomFace.p1.y) + bottomShift;
                const topY = p1Top.y + t * (p2Top.y - p1Top.y) + topShift;
                if (topY <= btmY) continue;
                doc.line(sxToPdf(px), syToPdf(btmY), sxToPdf(px), syToPdf(topY));
              }
            }
          } else if (infillType === 'horizontalPicket' || infillType === 'horizontalCable') {
            const thickIn = Number(infillType === 'horizontalPicket'
              ? stairConfig.horizontalPicketThicknessIn ?? 1
              : stairConfig.horizontalCableDiameterIn ?? 0.125);
            const openingIn = (p1Top.y - bottomFace.p1.y) / INtoU;
            const n = Number.isFinite(thickIn) && thickIn > 0 ? calcInfillCount(openingIn, thickIn) : 0;
            if (n > 0 && openingIn > 0) {
              const gapIn = (openingIn - n * thickIn) / (n + 1);
              doc.setDrawColor(infillColor);
              doc.setLineWidth(Math.max(infillType === 'horizontalCable' ? 0.6 : 0.8, thickIn * sc));
              for (let i = 0; i < n; i++) {
                const hvIn = gapIn + i * (gapIn + thickIn) + thickIn / 2;
                const tv = hvIn / openingIn;
                drawSceneLine(
                  {
                    x: p1Base.x,
                    y: bottomFace.p1.y + tv * (p1Top.y - bottomFace.p1.y),
                    z: p1Base.z,
                  },
                  {
                    x: p2Base.x,
                    y: bottomFace.p2.y + tv * (p2Top.y - bottomFace.p2.y),
                    z: p2Base.z,
                  },
                  infillColor,
                  Math.max(infillType === 'horizontalCable' ? 0.6 : 0.8, thickIn * sc)
                );
              }
            }
          }
        }

        if (compactTopEnabled) {
          const dx = p2Top.x - p1Top.x;
          const dz = p2Top.z - p1Top.z;
          const length = Math.sqrt((p2Top.x - p1Top.x) ** 2 + (p2Top.y - p1Top.y) ** 2 + (p2Top.z - p1Top.z) ** 2);
          const cosSlope = length > 0 ? Math.sqrt(dx * dx + dz * dz) / length : 1;
          const centerLift = (handrailHIn / 2) * INtoU * cosSlope;
          drawSceneLine(
            { x: p1Top.x, y: p1Top.y + centerLift, z: p1Top.z },
            { x: p2Top.x, y: p2Top.y + centerLift, z: p2Top.z },
            railColors.railLine,
            topRailWidthPt
          );
        }
      }
    }
  }

  // ── Manual Post Labels (side view) — drawn last for readability
  {
    effectiveManualPosts.forEach((post, idx) => {
      const postSection = resolveManualPostSection(post, stairConfig.post1Section, stairConfig.post2Section, stairConfig.tubeSize);
      const postW = Math.max(3, getTubeProfile(postSection).width * sc);
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
  // Renders: projection === 'side', projection === 'free3d', and legacy dims with no projection field.
  // free3d dims are projected into side/elevation view using xIn and yIn; zIn/depth is ignored for PDF.
  // This prevents visible 3D-view dimensions from being silently omitted from the PDF.
  // TODO: projection === 'top' is excluded until a top/plan PDF page exists.
  const sidePdfDims = (Array.isArray(manualDimensions) ? manualDimensions : [])
    .filter(d => !d.projection || d.projection === 'side' || d.projection === 'free3d');
  if (sidePdfDims.length > 0) {
    const MD_COLOR = '#1e3a5f';
    const TICK = 8; // half-tick length in pts
    // Y correction: same offset used by syToPdf for rails/posts
    const yAdj = -rPx / 2 + (TREAD_THICK / INtoU) * sc;

    // Draws white rect behind text then the text itself; handles horizontal and rotated (±90°) placement.
    const drawLabelWithBg = (text, x, y, angleDeg = 0) => {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(MD_COLOR);
      try {
        const textW = doc.getTextWidth(text);
        const textH = 7.5 * 0.352778; // approx pt→mm height for a 7.5pt font
        const pad = 1.2;
        const isVert = Math.abs(Math.abs(angleDeg) - 90) < 20;
        // For rotated text the visible bounding box is transposed
        const rw = (isVert ? textH : textW) + pad * 2;
        const rh = (isVert ? textW : textH) + pad * 2;
        const rx = x - rw / 2;
        const ry = isVert ? y - rh / 2 : y - rh * 0.75;
        doc.saveGraphicsState();
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(255, 255, 255);
        doc.rect(rx, ry, rw, rh, 'F');
        doc.restoreGraphicsState();
        doc.text(text, x, y, { align: 'center', angle: angleDeg });
      } catch {
        try {
          doc.text(text, x, y, { align: 'center' });
        } catch { /* skip label entirely rather than crash PDF */ }
      }
    };

    // Places the dimension label to avoid the stair geometry.
    // Near-vertical: 6 pt horizontal offset; side chosen relative to stair drawing center so the
    //   label lands outside (away from stair steps), never on the geometry.
    // Near-horizontal: 6 pt vertical offset above the line, horizontal text.
    // Diagonal: 16 pt perpendicular offset, text rotated parallel to line.
    const drawRotatedDimensionLabel = (text, ax, ay, bx, by) => {
      if (!text) return;
      if (!isFinite(ax) || !isFinite(ay) || !isFinite(bx) || !isFinite(by)) return;

      const dx = bx - ax;
      const dy = by - ay;
      const lineLen = Math.sqrt(dx * dx + dy * dy);
      if (!isFinite(lineLen) || lineLen === 0) return;

      const midX = (ax + bx) / 2;
      const midY = (ay + by) / 2;

      // negate dy because PDF y-axis points down (opposite to screen math convention)
      let angleDeg = Math.atan2(-dy, dx) * (180 / Math.PI);
      // keep text readable: normalize into (-90, 90]
      if (angleDeg > 90) angleDeg -= 180;
      if (angleDeg < -90) angleDeg += 180;

      const nearVertical = Math.abs(dx) < Math.abs(dy) * 0.25;
      const nearHorizontal = Math.abs(dy) < Math.abs(dx) * 0.25;

      let labelX, labelY;

      if (nearVertical) {
        // Side = away from the stair drawing center → label never lands on stair geometry
        const stairCenterX = ox + dw / 2;
        const sideSign = midX <= stairCenterX ? -1 : 1;
        labelX = midX + sideSign * 6;
        labelY = midY;
        // angleDeg ≈ ±90 from atan2; keeps text parallel to the vertical dimension line
      } else if (nearHorizontal) {
        labelX = midX;
        labelY = midY - 6;
        angleDeg = 0;
      } else {
        // Diagonal: perpendicular normal offset, text rotated parallel to line
        let nx = -dy / lineLen;
        let ny = dx / lineLen;
        if (ny > 0) { nx = -nx; ny = -ny; }
        labelX = midX + nx * 16;
        labelY = midY + ny * 16;
      }

      drawLabelWithBg(text, labelX, labelY, angleDeg);
    };

    sidePdfDims.forEach((dim) => {
      // Skip dims with missing or invalid coordinates — don't let one bad dim crash the PDF.
      if (!dim.a || !dim.b) return;
      if (!isFinite(dim.a.xIn) || !isFinite(dim.a.yIn) || !isFinite(dim.b.xIn) || !isFinite(dim.b.yIn)) return;

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

      const dimLabel = dim.label != null ? String(dim.label) : fmtDim(dim.measuredValueIn != null ? dim.measuredValueIn : 0, 2);
      drawRotatedDimensionLabel(dimLabel, axPdf, ayPdf, bxPdf, byPdf);
    });
  }

  // ── Manual Text Annotations (side view) ───────────────────────────────────
  // Renders projection==='side', projection==='free3d', and legacy (no projection).
  // projection==='top' is excluded until a top/plan PDF page exists.
  const sideTextAnnotations = (Array.isArray(manualTextAnnotations) ? manualTextAnnotations : [])
    .filter(a => !a.projection || a.projection === 'side' || a.projection === 'free3d');

  if (sideTextAnnotations.length > 0) {
    const yAdj = -rPx / 2 + (TREAD_THICK / INtoU) * sc;

    // Canvas-based rendering so unicode/Cyrillic/special chars survive in the PDF.
    // Returns { canvas, widthPt, heightPt } or null when text is empty.
    const createTextAnnotationCanvas = (text, opts = {}) => {
      const SCALE = 2;
      const BOX_W_PT = opts.boxWidthPt || 140;
      const FONT_SIZE_PT = opts.fontSizePt || 9;
      const PAD_PT = opts.padPt || 5;

      const boxWPx = BOX_W_PT * SCALE;
      const fontSizePx = FONT_SIZE_PT * SCALE;
      const padPx = PAD_PT * SCALE;
      const lineHPx = fontSizePx * 1.4;
      const maxTextWPx = boxWPx - padPx * 2;

      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = boxWPx;
      tmpCanvas.height = 10;
      const tmpCtx = tmpCanvas.getContext('2d');
      tmpCtx.font = `${fontSizePx}px sans-serif`;

      const paragraphs = text.split(/\r?\n/);
      const wrappedLines = [];
      for (const para of paragraphs) {
        if (!para) { wrappedLines.push(''); continue; }
        const words = para.split(' ');
        let cur = '';
        for (const word of words) {
          const test = cur ? `${cur} ${word}` : word;
          if (tmpCtx.measureText(test).width > maxTextWPx && cur) {
            wrappedLines.push(cur);
            cur = word;
          } else {
            cur = test;
          }
        }
        if (cur) wrappedLines.push(cur);
      }

      if (!wrappedLines.length) return null;

      const boxHPx = Math.ceil(wrappedLines.length * lineHPx + padPx * 2);
      const canvas = document.createElement('canvas');
      canvas.width = boxWPx;
      canvas.height = boxHPx;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, boxWPx, boxHPx);

      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = SCALE * 0.5;
      ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, boxWPx - ctx.lineWidth, boxHPx - ctx.lineWidth);

      ctx.font = `${fontSizePx}px sans-serif`;
      ctx.fillStyle = '#1a1a2e';
      ctx.textBaseline = 'top';
      wrappedLines.forEach((line, i) => {
        ctx.fillText(line, padPx, padPx + i * lineHPx);
      });

      return { canvas, widthPt: BOX_W_PT, heightPt: boxHPx / SCALE };
    };

    sideTextAnnotations.forEach((ann) => {
      try {
        if (!ann || typeof ann.xIn !== 'number' || typeof ann.yIn !== 'number') return;
        if (!isFinite(ann.xIn) || !isFinite(ann.yIn)) return;

        const rawText = typeof ann.text === 'string' ? ann.text : '';
        if (!rawText) return;

        const txPdf = mx(ox + (ann.xIn + run / 2) * sc);
        const tyPdf = oy - ann.yIn * sc + yAdj;
        if (!isFinite(txPdf) || !isFinite(tyPdf)) return;

        const result = createTextAnnotationCanvas(rawText);
        if (!result) return;

        const { canvas, widthPt, heightPt } = result;
        // Anchor slightly above/right of the clicked point so it doesn't cover it
        const bx = txPdf + 4;
        const by = tyPdf - heightPt - 4;
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', bx, by, widthPt, heightPt);
      } catch {
        // skip bad annotation — don't crash PDF export
      }
    });
  }

  pageFooter(LW, LH);
  } // end if/else primaryPageType

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

  // ── Helper: render draft dimensions onto current page ─────────────────────
  // dimData: array of { ax, ay, bx, by, label } with normalized 0..1 coords
  // pageW, pageH: page dimensions in pts
  const renderDraftDimensions = (dimData, pageW, pageH) => {
    if (!Array.isArray(dimData) || dimData.length === 0) return;
    const DC = '#1e3a5f';
    const TICK = 8;
    dimData.forEach(dim => {
      if (!dim || !isFinite(dim.ax) || !isFinite(dim.ay) || !isFinite(dim.bx) || !isFinite(dim.by)) return;
      const ax = dim.ax * pageW, ay = dim.ay * pageH;
      const bx = dim.bx * pageW, by = dim.by * pageH;
      const len = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
      if (len < 5) return;
      const midX = (ax + bx) / 2, midY = (ay + by) / 2;
      const ux = (bx - ax) / len, uy = (by - ay) / len;
      const perX = -uy, perY = ux;

      doc.setDrawColor(DC);
      doc.setLineWidth(1.2);
      doc.line(ax, ay, bx, by);
      doc.line(ax - perX * TICK, ay - perY * TICK, ax + perX * TICK, ay + perY * TICK);
      doc.line(bx - perX * TICK, by - perY * TICK, bx + perX * TICK, by + perY * TICK);

      const label = String(dim.label ?? 'DIM');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      const tw = doc.getTextWidth(label);
      const lpad = 2.5;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(255, 255, 255);
      doc.rect(midX - tw / 2 - lpad, midY - 6.5, tw + lpad * 2, 9.5, 'F');
      doc.setTextColor(DC);
      doc.text(label, midX, midY + 1.5, { align: 'center' });
    });
  };

  // ── Helper: render draft texts onto current page ──────────────────────────
  const renderDraftTexts = (textData, pageW, pageH) => {
    if (!Array.isArray(textData) || textData.length === 0) return;
    textData.forEach(ann => {
      if (!ann || !isFinite(ann.x) || !isFinite(ann.y) || !ann.text) return;
      const x = ann.x * pageW;
      const y = ann.y * pageH;
      const text = String(ann.text);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const tw = doc.getTextWidth(text);
      const pad = 3;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.4);
      doc.rect(x - pad, y - 8, tw + pad * 2, 11, 'FD');
      doc.setTextColor('#1a1a2e');
      doc.text(text, x, y);
    });
  };

  // ── Side PDF Draft page ───────────────────────────────────────────────────
  const sideDims = pdfDrafts?.side?.dimensions ?? [];
  const sideTxts = pdfDrafts?.side?.texts ?? [];
  if (sideDims.length > 0 || sideTxts.length > 0) {
    doc.addPage([792, 612]); // landscape

    // Simple header
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#1a1a2e');
    doc.text('SIDE PDF DRAFT', M, 40);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#666666');
    doc.text('Side View — User-placed dimensions', M, 54);
    hline(M, LW - M, 60, '#1a1a2e', 1);

    // Re-draw stair side profile using the same layout variables as page 1
    // (ox, oy, sc, rPx, tPx, dw, dh, mx, steps are all in scope from page 1)
    doc.setDrawColor('#888888');
    doc.setLineWidth(0.8);
    doc.line(mx(ox - 28), oy, mx(ox + dw + 28), oy);

    doc.setDrawColor('#1a1a2e');
    doc.setLineWidth(1.5);
    {
      let ssx = ox, ssy = oy;
      for (let i = 0; i < steps; i++) {
        doc.line(mx(ssx), ssy, mx(ssx), ssy - rPx);
        if (!(stairConfig.topLandingEnabled && i === steps - 1)) {
          doc.line(mx(ssx), ssy - rPx, mx(ssx + tPx), ssy - rPx);
        }
        ssx += tPx;
        ssy -= rPx;
      }
    }

    renderDraftDimensions(sideDims, LW, LH);
    renderDraftTexts(sideTxts, LW, LH);

    hline(M, LW - M, LH - 36, '#cccccc');
    txt(
      `${project.name || 'Untitled Project'} — Side PDF Draft — Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      LW / 2, LH - 22, { size: 8, color: '#888888', align: 'center' }
    );
  }

  // ── 3D PDF Draft extra page (omitted when primaryPageType==='threeD'; content is already on page 1) ─
  const threeDDraft = pdfDrafts?.threeD;
  const has3dDraft = primaryPageType !== 'threeD' && (threeDDraft?.backgroundImage ||
    (Array.isArray(threeDDraft?.dimensions) && threeDDraft.dimensions.length > 0) ||
    (Array.isArray(threeDDraft?.texts) && threeDDraft.texts.length > 0));
  if (has3dDraft) {
    doc.addPage([792, 612]); // landscape

    // Fill page white before drawing 3D image so no colored canvas background bleeds through
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, LW, LH, 'F');

    // Background: captured 3D canvas image
    if (threeDDraft.backgroundImage) {
      try {
        doc.addImage(threeDDraft.backgroundImage, 'PNG', 0, 0, LW, LH);
      } catch {
        // Skip image if it fails — still render dimensions and header
      }
    }

    // Overlay header (semi-transparent band)
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(255, 255, 255);
    doc.rect(0, 0, LW, 64, 'F');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#1a1a2e');
    doc.text('3D PDF DRAFT', M, 40);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#666666');
    doc.text('3D View — User-placed dimensions', M, 54);
    hline(M, LW - M, 60, '#1a1a2e', 1);

    if (Array.isArray(threeDDraft.dimensions)) {
      renderDraftDimensions(threeDDraft.dimensions, LW, LH);
    }
    if (Array.isArray(threeDDraft.texts) && threeDDraft.texts.length > 0) {
      renderDraftTexts(threeDDraft.texts, LW, LH);
    }

    hline(M, LW - M, LH - 36, '#cccccc');
    txt(
      `${project.name || 'Untitled Project'} — 3D PDF Draft — Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      LW / 2, LH - 22, { size: 8, color: '#888888', align: 'center' }
    );
  }

  if (mode === 'print') {
    doc.autoPrint();
    return doc.output('bloburl');
  }
  doc.save(`${(project.name || 'project').replace(/[^a-z0-9_-]/gi, '_')}_stair_designer.pdf`);
}
