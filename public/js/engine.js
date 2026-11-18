/* Pivot door engine.
 * One source of truth for every door: the configurator preview, the price,
 * and the DXF you cut from all come from these recipes. Runs in the browser
 * (window.PivotEngine) and in Node (require("./public/js/engine.js")).
 *
 * Units are millimetres. Door coordinates have the origin at the top-left
 * corner of the front, x to the right, y down. The DXF writer flips y.
 *
 * TOOLING IS PLACEHOLDER. Change the TOOLS table once the live tests settle
 * each design's bits, depths and layer names. A layer name is the contract
 * with your VCarve toolpath templates.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PivotEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const VERSION = 2;
  const LIMITS = { wMin: 300, wMax: 600, hMin: 300, hMax: 1150 };
  const OVERCUT = 10;            // grooves that run off the door go this far past the edge
  const LABEL_LAYER = "LABELS";

  /* ---------- tooling (placeholders) ---------- */
  // width = the groove width the tool leaves at its depth, used for spacing and the preview.
  const TOOLS = {
    cutout:   { layer: "CUTOUT_EM6",          label: "6 mm end mill, profile outside, with tabs", width: 6,    color: 7 },
    pocket8:  { layer: "POCKET_EM6_D8",       label: "6 mm end mill pocket, 8 mm deep",           width: 6,    color: 5, pocket: true },
    pocket6:  { layer: "POCKET_EM6_D6",       label: "6 mm end mill pocket, 6 mm deep",           width: 6,    color: 5, pocket: true },
    pocket4:  { layer: "POCKET_EM6_D4",       label: "6 mm end mill pocket, 4 mm deep (first step)", width: 6, color: 150, pocket: true },
    flute16:  { layer: "FLUTE_CORE16_D5",     label: "16 mm fluting bit, 5 mm deep",              width: 16,   color: 3 },
    flute8:   { layer: "FLUTE_BALL8_D4",      label: "8 mm ball nose, 4 mm deep",                 width: 8,    color: 3 },
    reed13:   { layer: "REED_FORM13_D4",      label: "12.7 mm round-nose form tool, 4 mm deep",   width: 12.7, color: 4 },
    bead6:    { layer: "BEAD_FORM6_D3",       label: "6 mm bead form tool, 3 mm deep",            width: 6,    color: 4 },
    v90d4:    { layer: "GROOVE_V90_D4",       label: "90 degree V-bit, 4 mm deep",                width: 8,    color: 1 },
    v90d5:    { layer: "GROOVE_V90_D5",       label: "90 degree V-bit, 5 mm deep",                width: 10,   color: 1 },
    bevel:    { layer: "BEVEL_V90_D8",        label: "90 degree V-bit bevel along the panel edge, 8 mm deep", width: 16, color: 6 },
    roundover12d5: { layer: "ROUNDOVER_FORM12_D5", label: "12.7 mm round-over form tool, 2D Profile ON the line, 5 mm deep", width: 4.9, color: 4 },
    // Moulding toolpath rails. rail: true = never drawn in the preview. The matching profile is in PROFILES.
    railBead12: { layer: "MOULD_RAIL_BEAD12_D5", label: "Moulding toolpath corner rails (tapered ball nose, Create Sharp Corners on, Gap Above 0). Profile on MOULD_PROFILE_BEAD12_D5", width: 0, color: 30, rail: true, profile: "bead12" },
    railSbead12: { layer: "MOULD_RAIL_SBEAD12", label: "Moulding toolpath closed rail, full length (tapered ball nose finish, 6 mm end mill as Larger Area Clearance Tool, Create Sharp Corners on, Gap Above 0). Profile on MOULD_PROFILE_SBEAD12", width: 0, color: 30, rail: true, profile: "sbead12" },
    sbeadView: { layer: null, label: "preview only", width: 12.7, color: 0, previewOnly: true },
    mould:    { layer: "MOULD_TBN_RAIL",      label: "Moulding toolpath drive rail (tapered ball nose). Draw the profile in VCarve.", width: 18, color: 30 },
    chamfer:  { layer: "EDGE_CHAMFER_V90_D3", label: "90 degree V-bit edge chamfer, 3 mm",        width: 6,    color: 6 }
  };

  /* ---------- prices (provisional, by size band) ---------- */
  const BANDS = [
    { id: "small",   name: "Small",   maxW: 300, maxH: 600,  price: 30 },
    { id: "regular", name: "Regular", maxW: 600, maxH: 600,  price: 40 },
    { id: "large",   name: "Large",   maxW: 600, maxH: 1150, price: 60 }
  ];
  const DELIVERY = { first: 10, extra: 5 };

  /* ---------- geometry helpers ---------- */
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  function roundRect(W, H, r, seg) {
    seg = seg || 6;
    const pts = [];
    const corners = [[W - r, r, -90], [W - r, H - r, 0], [r, H - r, 90], [r, r, 180]];
    for (const [cx, cy, a0] of corners) {
      for (let i = 0; i <= seg; i++) {
        const a = (a0 + (90 * i) / seg) * Math.PI / 180;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
    }
    return pts;
  }
  // Liang-Barsky: clip segment a-b to rectangle r; returns null or [p, q]
  function clipSeg(a, b, r) {
    let t0 = 0, t1 = 1;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const P = [-dx, dx, -dy, dy];
    const Q = [a[0] - r.x0, r.x1 - a[0], a[1] - r.y0, r.y1 - a[1]];
    for (let i = 0; i < 4; i++) {
      if (Math.abs(P[i]) < 1e-12) { if (Q[i] < 0) return null; continue; }
      const t = Q[i] / P[i];
      if (P[i] < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
      else { if (t < t0) return null; if (t < t1) t1 = t; }
    }
    return [[a[0] + dx * t0, a[1] + dy * t0], [a[0] + dx * t1, a[1] + dy * t1]];
  }
  // Points along an arc, angles in degrees (y down, so -90 is the top).
  function arc(cx, cy, r, a0, a1, seg) {
    seg = seg || Math.max(12, Math.ceil(Math.abs(a1 - a0) / 4));
    const pts = [];
    for (let i = 0; i <= seg; i++) {
      const a = (a0 + ((a1 - a0) * i) / seg) * Math.PI / 180;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pts;
  }
  // A rectangle with a semicircular top, inset by d from a W x H door.
  function archShape(W, H, d) {
    const r = W / 2 - d, cx = W / 2, cy = W / 2;
    return [[d, H - d], [d, cy]].concat(arc(cx, cy, r, 180, 360).slice(1, -1), [[W - d, cy], [W - d, H - d]]);
  }
  class DesignError extends Error {}
  const fail = (msg) => { throw new DesignError(msg); };

  // Stopped flutes centred in an area; ends stop half a tool width inside it.
  function stoppedFlutes(x0, y0, x1, y1, spacing, width) {
    const usable = (x1 - x0) - width;
    if (usable < 0) fail("There isn't room for a flute at this size. Make the door wider or the margin smaller.");
    const n = Math.floor(usable / spacing + 1e-9) + 1;
    const cx = (x0 + x1) / 2, start = cx - ((n - 1) * spacing) / 2;
    const ya = y0 + width / 2, yb = y1 - width / 2;
    if (yb - ya < 40) fail("The fluted area is too short. Make the door taller or the margin smaller.");
    const lines = [];
    for (let k = 0; k < n; k++) lines.push([[start + k * spacing, ya], [start + k * spacing, yb]]);
    return lines;
  }
  const fullHeight = (x, H) => [[x, -OVERCUT], [x, H + OVERCUT]];

  /* ---------- moulding toolpath helpers ---------- */
  // VCarve's Moulding toolpath sweeps a profile along a drive rail. From Vectric's help:
  // the profile's START point hangs on the rail's start point, and the profile is swept
  // to one side of the rail (on a closed rail, always the outside). Tim's tests: rails
  // drawn clockwise (as seen in VCarve, y up) put the profile on the correct (outer) side,
  // i.e. on the LEFT of the direction of travel.
  //
  // A round form tool run ON a line leaves a sharp mitre on the inside of a turn and a
  // rounded corner on the outside. So only corners where the profile hangs on the
  // outside of the turn need a corner rail, and the leftover material sits beyond the
  // corner, so the legs only need to be long enough for the moulding bit to blend in.
  const CORNER_LEG = 5;        // mm along the path each side of the corner (to prove on a test cut)
  const CORNER_MIN_TURN = 10;  // degrees; smaller turns (arc facets) are not corners

  const signedArea = (q) => { let a = 0; for (let i = 0; i < q.length; i++) { const [x0, y0] = q[i], [x1, y1] = q[(i + 1) % q.length]; a += x0 * y1 - x1 * y0; } return a / 2; };
  const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  // Walk `len` mm along the polyline q from vertex i, forwards (dir 1) or backwards (-1).
  // Returns the vertices passed, ending at the interpolated point.
  function walk(q, i, dir, len, closed) {
    const out = [];
    let cur = q[i], k = i, left = len;
    for (let guard = 0; guard < q.length; guard++) {
      let nk = k + dir;
      if (closed) nk = (nk + q.length) % q.length; else if (nk < 0 || nk >= q.length) break;
      const nxt = q[nk], d = dist(cur, nxt);
      if (d >= left) { const t = left / d; out.push([cur[0] + (nxt[0] - cur[0]) * t, cur[1] + (nxt[1] - cur[1]) * t]); return out; }
      out.push(nxt); left -= d; cur = nxt; k = nk;
    }
    return out;
  }
  // pts: a path in door coordinates (y down). side: for a closed path "outside" or
  // "inside"; for an open path "left" or "right" of its direction as seen in VCarve.
  // Returns open rails (door coordinates) for the corners the form tool can't make sharp.
  function cornerRails(pts, closed, side, leg) {
    leg = leg || CORNER_LEG;
    let q = pts.map(([x, y]) => [x, -y]);                       // to VCarve's y-up view
    if (closed && q.length > 2 && dist(q[0], q[q.length - 1]) < 1e-9) q = q.slice(0, -1);
    const wantLeft = closed ? (side === "outside" ? signedArea(q) > 0 : signedArea(q) < 0) : side === "right";
    if (wantLeft) q = q.slice().reverse();                      // now the profile is on the left of travel
    const rails = [];
    const n = q.length;
    for (let i = 0; i < n; i++) {
      if (!closed && (i === 0 || i === n - 1)) continue;
      const a = q[(i - 1 + n) % n], b = q[i], c = q[(i + 1) % n];
      const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]];
      const cross = u[0] * v[1] - u[1] * v[0], dot = u[0] * v[0] + u[1] * v[1];
      const turn = Math.atan2(Math.abs(cross), dot) * 180 / Math.PI;
      if (cross >= 0 || turn < CORNER_MIN_TURN) continue;       // left turns are already sharp
      const back = walk(q, i, -1, leg, closed).reverse(), fwd = walk(q, i, 1, leg, closed);
      rails.push(back.concat([b], fwd).map(([x, y]) => [x, -y]));
    }
    return rails;
  }

  // Cross-section profiles for the Moulding toolpath, in mm: x = distance from the rail
  // (the first point is the start point, which sits on the rail), y = height, with the
  // door face at 0 and depths negative. Drawn once per order on their own layer.
  const R12 = 12.7 / 2;
  // Material left by the 12.7 mm round-over ON a line, cut `depth` deep, at distance dx.
  const roundoverReach = (depth) => R12 - Math.sqrt(R12 * R12 - depth * depth);
  function roundoverFlank(c, depth, dir) {
    // From the cut bottom at x=c up to the face, going in direction dir (+1 / -1).
    const pts = [];
    for (let i = 0; i <= 20; i++) { const h = depth * i / 20; pts.push([c + dir * (R12 - Math.sqrt(R12 * R12 - h * h)), -depth + h]); }
    return pts;
  }
  const BEAD = { depth: 5, first: 6 };   // two round-over lines: 6 mm and 6 + 12.7 mm out from the pocket edge
  const PROFILES = {
    bead12: {
      layer: "MOULD_PROFILE_BEAD12_D5",
      label: "Beaded shaker profile: 2 round-over lines 12.7 apart, 5 deep. Start point on the rail (pocket edge).",
      pts() {
        const D = BEAD.depth, a = BEAD.first, b = a + 2 * R12, xs = roundoverReach(D);
        let p = [[0, 0]];
        p = p.concat(roundoverFlank(a, D, -1).reverse(), roundoverFlank(a, D, 1).slice(1));
        p = p.concat(roundoverFlank(b, D, -1).reverse(), roundoverFlank(b, D, 1).slice(1));
        p.push([b + xs + 0.5, 0]);
        return p.filter((q, i) => i === 0 || dist(q, p[i - 1]) > 1e-6);
      }
    },
    sbead12: {
      layer: "MOULD_PROFILE_SBEAD12",
      label: "Single bead profile: 12.7 bead, its top below the face as noted beside it, field 8 deep. Start point on the rail (pocket edge).",
      pts(o) {
        const t = o && o.top != null ? o.top : SBEAD.top, g = SBEAD.gap, foot = -(t + R12), floor = -SBEAD.floor;
        const p = [[0, floor], [g, floor]];
        if (foot - floor > 1e-6) p.push([g, foot]);
        for (let i = 0; i <= 36; i++) { const th = Math.PI * i / 36; p.push([g + R12 - R12 * Math.cos(th), foot + R12 * Math.sin(th)]); }
        p.push([g + 2 * R12, 0]);
        return p;
      }
    }
  };
  // Single bead with a hard step: wall down from the frame face, a 12.7 mm half-round
  // bead whose top is `top` below the face, a small step down to the field.
  const SBEAD = { top: 1, gap: 1, floor: 8 };   // floor matches POCKET_EM6_D8

  // Frame-and-panel: returns the recessed panel rectangles.
  function shakerPanels(W, H, border, rails) {
    const railW = border;
    const avail = H - 2 * border - rails * railW;
    const ph = avail / (rails + 1);
    if (W - 2 * border < 80) fail("The border is too wide for this width. Make the border narrower or the door wider.");
    if (ph < 80) fail(rails ? "The panels between the rails are too short. Use fewer rails, a narrower border or a taller door." : "The border is too wide for this height. Make the border narrower or the door taller.");
    const panels = [];
    for (let i = 0; i <= rails; i++) {
      const y0 = border + i * (ph + railW);
      panels.push([border, y0, W - border, y0 + ph]);
    }
    return panels;
  }

  /* ---------- the design recipes ---------- */
  const num = (key, label, def, min, max, step, help) => ({ key, type: "number", label, def, min, max, step: step || 1, unit: "mm", help });
  const int = (key, label, def, min, max, help) => ({ key, type: "int", label, def, min, max, help });
  const choice = (key, label, def, choices, help) => ({ key, type: "choice", label, def, choices, help });

  const DESIGNS = [
    {
      id: "slab", name: "Slab", family: "Shaker family", adjustable: true,
      blurb: "A plain flat door with a chamfered edge.",
      opts: [choice("corners", "Corners", "square", [["square", "Square"], ["round", "Rounded"]])],
      build(W, H, o) {
        const outline = o.corners === "round" ? roundRect(W, H, 6) : rect(0, 0, W, H);
        return { outline, paths: [{ tool: "chamfer", pts: outline, closed: true }] };
      }
    },
    {
      id: "shaker", name: "Traditional shaker", family: "Shaker family", adjustable: true,
      blurb: "A square-edged frame around a recessed panel.",
      opts: [num("border", "Frame width", 70, 40, 120, 5), int("rails", "Mid rails", 0, 0, 3, "Rails are the same width as the frame and evenly spaced.")],
      build(W, H, o) {
        const panels = shakerPanels(W, H, o.border, o.rails);
        return { outline: rect(0, 0, W, H), paths: panels.map((p) => ({ tool: "pocket8", pts: rect(...p), closed: true })) };
      }
    },
    {
      id: "skinny", name: "Skinny shaker", family: "Shaker family", adjustable: true,
      blurb: "A narrow frame for a modern look.",
      opts: [num("border", "Frame width", 25, 18, 40, 1)],
      build(W, H, o) {
        const panels = shakerPanels(W, H, o.border, 0);
        return { outline: rect(0, 0, W, H), paths: panels.map((p) => ({ tool: "pocket8", pts: rect(...p), closed: true })) };
      }
    },
    {
      id: "flutedshaker", name: "Fluted shaker", family: "Frame with pattern", adjustable: true,
      blurb: "A recessed frame with flutes filling the centre.",
      opts: [num("border", "Frame width", 70, 40, 120, 5), num("spacing", "Flute spacing", 20, 18, 32, 1, "Centre to centre. The flutes are 16 mm wide.")],
      build(W, H, o) {
        const [p] = shakerPanels(W, H, o.border, 0);
        const inset = 6;
        const flutes = stoppedFlutes(p[0] + inset, p[1] + inset, p[2] - inset, p[3] - inset, o.spacing, TOOLS.flute16.width);
        return {
          outline: rect(0, 0, W, H),
          paths: [{ tool: "pocket6", pts: rect(...p), closed: true }].concat(flutes.map((pts) => ({ tool: "flute16", pts })))
        };
      }
    },
    {
      id: "fluted", name: "Fluted", family: "Your current range", adjustable: true,
      blurb: "Rounded flutes stopped inside a plain margin.",
      opts: [num("margin", "Plain margin", 40, 25, 80, 1), num("spacing", "Flute spacing", 22, 18, 32, 1, "Centre to centre. The flutes are 16 mm wide.")],
      build(W, H, o) {
        const m = o.margin;
        if (W - 2 * m < 40 || H - 2 * m < 80) fail("The margin is too wide for this size. Make the margin smaller or the door bigger.");
        const flutes = stoppedFlutes(m, m, W - m, H - m, o.spacing, TOOLS.flute16.width);
        return { outline: rect(0, 0, W, H), paths: flutes.map((pts) => ({ tool: "flute16", pts })) };
      }
    },
    {
      id: "reeded", name: "Reeded", family: "Your current range", adjustable: true,
      blurb: "Reeds running the full height of the door.",
      opts: [num("spacing", "Reed spacing", 17, 15, 25, 0.5, "Centre to centre. The reeds are cut with a 12.7 mm form tool.")],
      build(W, H, o) {
        const n = Math.floor(W / o.spacing + 1e-9);
        if (n < 2) fail("The door is too narrow for this reed spacing.");
        const start = W / 2 - ((n - 1) * o.spacing) / 2;
        const paths = [];
        for (let k = 0; k < n; k++) paths.push({ tool: "reed13", pts: fullHeight(start + k * o.spacing, H) });
        return { outline: rect(0, 0, W, H), paths };
      }
    },
    {
      id: "tvgroove", name: "Tongue & V groove", family: "Grooved slab", adjustable: true,
      blurb: "A flat door divided into equal boards by V-grooves.",
      opts: [num("spacing", "Board width (approx.)", 100, 50, 200, 5, "Boards are made equal, so the actual width is the nearest even split.")],
      build(W, H, o) {
        const boards = Math.max(2, Math.round(W / o.spacing));
        const paths = [];
        for (let k = 1; k < boards; k++) paths.push({ tool: "v90d4", pts: fullHeight((k * W) / boards, H) });
        return { outline: rect(0, 0, W, H), paths, info: `${boards} boards, ${Math.round((W / boards) * 10) / 10} mm each` };
      }
    },
    {
      id: "lattice", name: "Diamond lattice", family: "Your current range", adjustable: false,
      blurb: "V-grooved diamonds fitted to each door.",
      opts: [],
      build(W, H) {
        const N = Math.max(2, Math.round(W / 100)), M = Math.max(2, Math.round(H / 170));
        const s = W / N, h = H / M, k = s / h;
        const box = { x0: -OVERCUT, y0: -OVERCUT, x1: W + OVERCUT, y1: H + OVERCUT };
        const ya = -OVERCUT - 1, yb = H + OVERCUT + 1;
        const paths = [];
        const span = Math.ceil((H + 2 * OVERCUT) * k / s) + 2;
        for (let i = -span; i <= N + span; i++) {
          const a = i * s;
          for (const dir of [1, -1]) {
            const seg = clipSeg([a + dir * k * ya, ya], [a + dir * k * yb, yb], box);
            if (seg && Math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]) > 1) paths.push({ tool: "v90d5", pts: seg });
          }
        }
        return { outline: rect(0, 0, W, H), paths, info: `${N} × ${M} diamonds` };
      }
    },

    /* ----- draft designs for the first test cuts ----- */
    {
      id: "bevelled", name: "Bevelled shaker", family: "Shaker family", adjustable: true, draft: true,
      blurb: "A shaker with an angled edge where the frame meets the panel.",
      opts: [num("border", "Frame width", 70, 40, 120, 5)],
      build(W, H, o) {
        const [p] = shakerPanels(W, H, o.border, 0);
        return { outline: rect(0, 0, W, H), paths: [{ tool: "pocket8", pts: rect(...p), closed: true }, { tool: "bevel", pts: rect(...p), closed: true }] };
      }
    },
    {
      id: "beaded", name: "Beaded shaker", family: "Shaker family", adjustable: true, draft: true,
      blurb: "A shaker with a rounded bead round the inside of the frame.",
      opts: [num("border", "Frame width", 70, 40, 120, 5)],
      build(W, H, o) {
        // Round-over form tool ON two lines, 12.7 mm apart, outside the pocket: a full bead
        // between them, a quarter round either side. Corner rails make the corners crisp.
        const [p] = shakerPanels(W, H, o.border, 0);
        const a = BEAD.first, b = a + 2 * R12;
        if (o.border < b + roundoverReach(BEAD.depth) + 10) fail("The frame is too narrow for the bead. Make the frame wider.");
        const pocket = rect(...p);
        const paths = [
          { tool: "pocket8", pts: pocket, closed: true },
          { tool: "roundover12d5", pts: rect(p[0] - a, p[1] - a, p[2] + a, p[3] + a), closed: true },
          { tool: "roundover12d5", pts: rect(p[0] - b, p[1] - b, p[2] + b, p[3] + b), closed: true }
        ];
        for (const r of cornerRails(pocket, true, "outside", o.leg)) paths.push({ tool: "railBead12", pts: r });
        return { outline: rect(0, 0, W, H), paths };
      }
    },
    {
      id: "singlebead", name: "Single bead shaker", family: "Shaker family", adjustable: true, draft: true,
      blurb: "A shaker with one crisp bead set down beside the frame.",
      opts: [num("border", "Frame width", 70, 40, 120, 5)],
      build(W, H, o) {
        // Frame inner edge = shakerPanels rectangle. The bead strip (gap + 12.7 mm) inside it
        // is cut by one full-length Moulding toolpath on a closed rail at the pocket edge;
        // the rest of the panel is a plain 8 mm pocket.
        const [f] = shakerPanels(W, H, o.border, 0);
        const top = o.top != null ? o.top : SBEAD.top;
        if (top < 0 || top > SBEAD.floor - R12) fail("The bead top must be between 0 and " + (SBEAD.floor - R12).toFixed(2) + " mm below the face.");
        const s = SBEAD.gap + 2 * R12, p = [f[0] + s, f[1] + s, f[2] - s, f[3] - s];
        const pocket = rect(...p);
        return {
          outline: rect(0, 0, W, H),
          paths: [
            { tool: "pocket8", pts: rect(...f), closed: true, previewOnly: true },
            { tool: "pocket8", pts: pocket, closed: true },
            { tool: "railSbead12", pts: pocket, closed: true, profileOpts: { top } },
            { tool: "sbeadView", pts: rect(f[0] + s / 2, f[1] + s / 2, f[2] - s / 2, f[3] - s / 2), closed: true }
          ]
        };
      }
    },
    {
      id: "newcountry", name: "New Country", family: "Shaker family", adjustable: true, draft: true,
      blurb: "A shaker with V-grooved boards in the panel.",
      opts: [num("border", "Frame width", 70, 40, 120, 5), num("spacing", "Board width (approx.)", 80, 50, 150, 5, "Boards are made equal across the panel.")],
      build(W, H, o) {
        const [p] = shakerPanels(W, H, o.border, 0);
        const pw = p[2] - p[0], boards = Math.max(2, Math.round(pw / o.spacing));
        const paths = [{ tool: "pocket8", pts: rect(...p), closed: true }];
        for (let k = 1; k < boards; k++) { const x = p[0] + (k * pw) / boards; paths.push({ tool: "v90d4", pts: [[x, p[1]], [x, p[3]]] }); }
        return { outline: rect(0, 0, W, H), paths, info: `${boards} boards in the panel` };
      }
    },
    {
      id: "mouldedflute", name: "Moulded frame, fluted", family: "Frame with pattern", adjustable: true, draft: true,
      blurb: "A moulded frame round a finely fluted centre.",
      opts: [num("spacing", "Flute spacing", 12, 10, 20, 0.5, "Centre to centre. The flutes are 8 mm wide.")],
      build(W, H, o) {
        // Fixed for customers; the test-board script may narrow them (o.border, o.step).
        const b = o.border || 75, step = o.step || 22;
        if (W - 2 * (b + step) < 60 || H - 2 * (b + step) < 100) fail("This door is too small for the moulded frame. Make it bigger.");
        const rail = rect(b, b, W - b, H - b), p = [b + step, b + step, W - b - step, H - b - step];
        const flutes = stoppedFlutes(p[0] + 4, p[1] + 4, p[2] - 4, p[3] - 4, o.spacing, TOOLS.flute8.width);
        return { outline: rect(0, 0, W, H), paths: [{ tool: "mould", pts: rail, closed: true }, { tool: "pocket6", pts: rect(...p), closed: true }].concat(flutes.map((pts) => ({ tool: "flute8", pts }))) };
      }
    },
    {
      id: "victorian", name: "Victorian", family: "Frame with pattern", adjustable: false, draft: true,
      blurb: "A shaker with a decorative moulding inside the panel.",
      opts: [],
      build(W, H, o) {
        const [p] = shakerPanels(W, H, o.border || 70, 0), m = o.inset || 20;
        if (p[2] - p[0] < 2 * m + 60 || p[3] - p[1] < 2 * m + 80) fail("This door is too small for the inner moulding. Make it bigger.");
        return { outline: rect(0, 0, W, H), paths: [{ tool: "pocket8", pts: rect(...p), closed: true }, { tool: "mould", pts: rect(p[0] + m, p[1] + m, p[2] - m, p[3] - m), closed: true }] };
      }
    },
    {
      id: "georgian", name: "Georgian", family: "Frame with pattern", adjustable: false, draft: true,
      blurb: "A frame that steps down twice to the panel.",
      opts: [],
      build(W, H, o) {
        const [outer] = shakerPanels(W, H, o.outer || 55, 0), [inner] = shakerPanels(W, H, o.inner || 75, 0);
        return { outline: rect(0, 0, W, H), paths: [{ tool: "pocket4", pts: rect(...outer), closed: true }, { tool: "pocket8", pts: rect(...inner), closed: true }] };
      }
    },
    {
      id: "tbgroove", name: "Tongue & bead groove", family: "Grooved slab", adjustable: true, draft: true,
      blurb: "Equal boards, each groove with a bead beside it.",
      opts: [num("spacing", "Board width (approx.)", 100, 50, 200, 5, "Boards are made equal, so the actual width is the nearest even split.")],
      build(W, H, o) {
        const boards = Math.max(2, Math.round(W / o.spacing));
        const paths = [];
        for (let k = 1; k < boards; k++) {
          const x = (k * W) / boards;
          paths.push({ tool: "v90d4", pts: fullHeight(x, H) }, { tool: "bead6", pts: fullHeight(x + 9, H) });
        }
        return { outline: rect(0, 0, W, H), paths, info: `${boards} boards, ${Math.round((W / boards) * 10) / 10} mm each` };
      }
    },
    {
      id: "arched", name: "Arched", family: "Your current range", adjustable: false, draft: true,
      blurb: "Concentric arches rising from the bottom edge.",
      opts: [],
      build(W, H) {
        const R = Math.min(W * 0.38, H * 0.42), gap = R / 4.5, cx = W / 2, cy = H * 0.16 + R;
        if (cy > H - 40) fail("This door is too short for the arches. Make it taller.");
        const paths = [];
        for (let i = 0; i < 4; i++) {
          const r = R - i * gap;
          paths.push({ tool: "reed13", pts: [[cx - r, H + OVERCUT]].concat(arc(cx, cy, r, 180, 360), [[cx + r, H + OVERCUT]]) });
        }
        return { outline: rect(0, 0, W, H), paths, info: "4 arches" };
      }
    },
    {
      id: "archtop", name: "Arch-top beaded door", family: "Statement", adjustable: false, draft: true,
      blurb: "A round-topped door with three beads following its shape.",
      opts: [],
      build(W, H) {
        if (W < 200) fail("An arch-top door must be at least 200 mm wide.");
        if (H < W / 2 + 120) fail("An arch-top door must be at least half its width plus 120 mm tall.");
        const paths = [30, 55, 80].map((d) => ({ tool: "reed13", pts: archShape(W, H, d), closed: true }));
        return { outline: archShape(W, H, 0), paths, info: `Arch radius ${W / 2} mm` };
      }
    },
    {
      id: "ringpanel", name: "Ring and arc panel", family: "Statement", adjustable: false, draft: true,
      blurb: "Two panels shaped round a large circle, with a ring at the centre.",
      opts: [],
      build(W, H, o) {
        const b = o.frame || 40, cx = W / 2, cy = H / 2, R = W / 2 - b;
        if (cy - R < b + 60) fail("This design needs the door at least 120 mm taller than it is wide.");
        const top = [[b, b], [W - b, b], [W - b, cy]].concat(arc(cx, cy, R, 0, -180).slice(1, -1), [[b, cy]]);
        const bottom = [[b, H - b], [W - b, H - b], [W - b, cy]].concat(arc(cx, cy, R, 0, 180).slice(1, -1), [[b, cy]]);
        const ring = arc(cx, cy, R * 0.32, 0, 360, 72).slice(0, -1);
        return {
          outline: rect(0, 0, W, H),
          paths: [
            { tool: "pocket6", pts: top, closed: true }, { tool: "pocket6", pts: bottom, closed: true },
            { tool: "mould", pts: top, closed: true }, { tool: "mould", pts: bottom, closed: true }, { tool: "mould", pts: ring, closed: true }
          ],
          info: `Circle ${Math.round(2 * R)} mm across`
        };
      }
    }
  ];
  const ORDER = ["slab", "shaker", "skinny", "bevelled", "beaded", "singlebead", "newcountry", "flutedshaker", "mouldedflute", "victorian", "georgian", "tvgroove", "tbgroove", "fluted", "reeded", "lattice", "arched", "archtop", "ringpanel"];
  DESIGNS.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  const designById = (id) => DESIGNS.find((d) => d.id === id);

  /* ---------- validation ---------- */
  function hingeDefault(H) { return H <= 900 ? 2 : 3; }
  function cleanText(s, max) { return String(s == null ? "" : s).replace(/[^\x20-\x7E£]/g, "").trim().slice(0, max); }

  // Accepts loose input (from a form or a request body). Returns { door, errors }.
  // errors is an object of field -> message; empty when the door can be made.
  function normalizeDoor(input) {
    input = input || {};
    const errors = {};
    const d = designById(input.design);
    if (!d) return { door: null, errors: { design: "Choose a design." } };
    const W = Math.round(Number(input.width));
    const H = Math.round(Number(input.height));
    if (!Number.isFinite(W) || W < LIMITS.wMin || W > LIMITS.wMax) errors.width = `Width must be between ${LIMITS.wMin} and ${LIMITS.wMax} mm.`;
    if (!Number.isFinite(H) || H < LIMITS.hMin || H > LIMITS.hMax) errors.height = `Height must be between ${LIMITS.hMin} and ${LIMITS.hMax} mm.`;
    const opts = {};
    const given = input.opts || {};
    for (const o of d.opts) {
      let v = given[o.key];
      if (v === undefined || v === null || v === "") v = o.def;
      if (o.type === "choice") {
        if (!o.choices.some((c) => c[0] === v)) v = o.def;
      } else {
        v = Number(v);
        if (o.type === "int") v = Math.round(v);
        if (!Number.isFinite(v) || v < o.min || v > o.max) errors[o.key] = `${o.label} must be between ${o.min} and ${o.max}${o.unit ? " " + o.unit : ""}.`;
      }
      opts[o.key] = v;
    }
    const side = ["none", "left", "right"].includes(input.hingeSide) ? input.hingeSide : "none";
    let count = Math.round(Number(input.hingeCount));
    if (!Number.isFinite(count) || count < 2 || count > 4) count = Number.isFinite(H) ? hingeDefault(H) : 2;
    let qty = Math.round(Number(input.qty));
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    if (qty > 50) errors.qty = "The most of one door in an order is 50.";
    const door = {
      design: d.id, version: VERSION, width: W, height: H, opts,
      hingeSide: side, hingeCount: side === "none" ? 0 : count,
      name: cleanText(input.name, 40), qty: Math.min(qty, 50)
    };
    if (!errors.width && !errors.height && !Object.keys(errors).some((k) => d.opts.some((o) => o.key === k))) {
      try { buildDoor(door); } catch (e) { if (e instanceof DesignError) errors.geometry = e.message; else throw e; }
    }
    return { door, errors };
  }

  /* ---------- geometry ---------- */
  function hingePositions(door) {
    if (door.hingeSide === "none" || !door.hingeCount) return [];
    const H = door.height, n = door.hingeCount, bottom = 100;
    const top = door.design === "archtop" ? door.width / 2 + 50 : 100; // keep the top hinge below the arch
    const x = door.hingeSide === "left" ? 22.5 : door.width - 22.5;
    const ys = [];
    for (let i = 0; i < n; i++) ys.push(top + ((H - top - bottom) * i) / (n - 1));
    return ys.map((y) => [x, y]);
  }
  function buildDoor(door) {
    const d = designById(door.design);
    if (!d) fail("Unknown design.");
    const g = d.build(door.width, door.height, door.opts || {});
    g.paths.unshift({ tool: "cutout", pts: g.outline, closed: true });
    return { W: door.width, H: door.height, outline: g.outline, paths: g.paths, info: g.info || "", hinges: hingePositions(door), design: d };
  }

  /* ---------- prices ---------- */
  function bandFor(W, H) { return BANDS.find((b) => W <= b.maxW && H <= b.maxH) || null; }
  function priceDoor(door) { const b = bandFor(door.width, door.height); return b ? b.price : null; }
  function priceOrder(doors) {
    const count = doors.reduce((a, d) => a + d.qty, 0);
    const sub = doors.reduce((a, d) => a + d.qty * (priceDoor(d) || 0), 0);
    const ship = count ? DELIVERY.first + DELIVERY.extra * (count - 1) : 0;
    return { count, sub, ship, total: sub + ship };
  }

  /* ---------- descriptions ---------- */
  function describe(door) {
    const d = designById(door.design);
    const bits = d.opts.map((o) => {
      const v = door.opts[o.key];
      if (o.type === "choice") return `${o.label}: ${(o.choices.find((c) => c[0] === v) || [v, v])[1]}`;
      return `${o.label}: ${v}${o.unit ? " " + o.unit : ""}`;
    });
    bits.push(door.hingeSide === "none" ? "No hinge holes" : `Hinges ${door.hingeSide}, ${door.hingeCount}`);
    return bits.join(" · ");
  }

  /* ---------- SVG preview ---------- */
  let uid = 0;
  const f1 = (v) => Math.round(v * 10) / 10;
  const ptsAttr = (pts) => pts.map((p) => f1(p[0]) + "," + f1(p[1])).join(" ");
  function doorSVG(door, opt) {
    opt = opt || {};
    const g = buildDoor(door);
    const W = g.W, H = g.H, id = "pv" + (++uid);
    const fill = opt.fill || "#CDB28A", edge = opt.edge || "#9C8462";
    const dims = !!opt.dims, pad = dims ? Math.max(W, H) * 0.12 : 8;
    const vb = [-pad * (dims ? 0.35 : 1), -pad * (dims ? 0.35 : 1), W + pad * (dims ? 1.35 : 2), H + pad * (dims ? 1.35 : 2)];
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(f1).join(" ")}" role="img" aria-label="${g.design.name}, ${W} by ${H} mm">`;
    s += `<defs><clipPath id="${id}c"><polygon points="${ptsAttr(g.outline)}"/></clipPath>` +
      `<linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient></defs>`;
    s += `<polygon points="${ptsAttr(g.outline)}" fill="${fill}"/>`;
    s += `<g clip-path="url(#${id}c)">`;
    for (const p of g.paths) {
      const t = TOOLS[p.tool];
      if (p.tool === "cutout" || t.rail) continue;
      if (t.pocket) {
        s += `<polygon points="${ptsAttr(p.pts)}" fill="#000" fill-opacity=".10" stroke="#000" stroke-opacity=".35" stroke-width="2"/>`;
        if (p.pts.length === 4) s += `<polyline points="${ptsAttr([p.pts[3], p.pts[0], p.pts[1]])}" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="4"/>`;
      } else if (p.tool === "chamfer") {
        s += `<polygon points="${ptsAttr(p.pts)}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="5"/>`;
      } else {
        const w = t.width, el = p.closed ? "polygon" : "polyline";
        s += `<${el} points="${ptsAttr(p.pts)}" fill="none" stroke="#000" stroke-opacity="${p.tool === "mould" || p.tool === "bevel" ? ".14" : ".24"}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
        s += `<${el} points="${ptsAttr(p.pts.map((q) => [q[0] + w * 0.22, q[1] + w * 0.22]))}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="${f1(w * 0.28)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
    }
    s += `</g>`;
    s += `<polygon points="${ptsAttr(g.outline)}" fill="url(#${id}g)" stroke="${edge}" stroke-width="2"/>`;
    for (const [x, y] of g.hinges) s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="17.5" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    if (dims) {
      const fs = Math.max(W, H) * 0.035, c = opt.ink || "currentColor", lw = Math.max(W, H) * 0.003, tk = fs * 0.45;
      const yd = H + pad * 0.45, xd = W + pad * 0.45;
      s += `<g stroke="${c}" stroke-width="${f1(lw)}"><line x1="0" y1="${f1(yd)}" x2="${W}" y2="${f1(yd)}"/><line x1="0" y1="${f1(yd - tk)}" x2="0" y2="${f1(yd + tk)}"/><line x1="${W}" y1="${f1(yd - tk)}" x2="${W}" y2="${f1(yd + tk)}"/>` +
        `<line x1="${f1(xd)}" y1="0" x2="${f1(xd)}" y2="${H}"/><line x1="${f1(xd - tk)}" y1="0" x2="${f1(xd + tk)}" y2="0"/><line x1="${f1(xd - tk)}" y1="${H}" x2="${f1(xd + tk)}" y2="${H}"/></g>`;
      s += `<text x="${f1(W / 2)}" y="${f1(yd + fs * 1.35)}" text-anchor="middle" font-size="${f1(fs)}" fill="${c}" font-family="system-ui, sans-serif">${W} mm</text>`;
      s += `<text transform="translate(${f1(xd + fs * 1.2)} ${f1(H / 2)}) rotate(90)" text-anchor="middle" font-size="${f1(fs)}" fill="${c}" font-family="system-ui, sans-serif">${H} mm</text>`;
    }
    return s + `</svg>`;
  }

  /* ---------- DXF (R12 ASCII) ---------- */
  const n3 = (v) => (Math.round(v * 1000) / 1000).toFixed(3);
  function dxfText(s) { return String(s).replace(/[^\x20-\x7E]/g, "").slice(0, 60); }

  // order: { ref, doors: [normalized door], sheetWidth? }. Each door copy becomes its
  // own part, spread out in rows no wider than sheetWidth (default 2440 mm) for VCarve to nest.
  function orderDXF(order) {
    const parts = [];
    order.doors.forEach((door, i) => {
      for (let c = 1; c <= door.qty; c++) {
        const tag = door.qty > 1 ? `${i + 1}.${c}` : `${i + 1}`;
        parts.push({ door, tag, g: buildDoor(door) });
      }
    });
    parts.sort((a, b) => b.g.H - a.g.H);
    const SHEET = order.sheetWidth || 2440, GAP = order.gap != null ? order.gap : 50 + 2 * OVERCUT;
    if (parts.every((p) => Array.isArray(p.door.pos))) {
      // Placed by hand (test boards): pos is [x, y] of the part's bottom-left corner.
      for (const p of parts) { p.ox = p.door.pos[0]; p.oy = p.door.pos[1]; }
    } else {
      let x = 0, y = 0, rowH = 0;
      for (const p of parts) {
        if (x > 0 && x + p.g.W > SHEET) { y += rowH + GAP; x = 0; rowH = 0; }
        p.ox = x; p.oy = y; x += p.g.W + GAP; rowH = Math.max(rowH, p.g.H);
      }
    }
    const used = new Set([LABEL_LAYER]);
    const ents = [];
    const profiles = new Map();
    const poly = (layer, pts, closed) => {
      used.add(layer);
      ents.push("0", "POLYLINE", "8", layer, "66", "1", "10", "0.0", "20", "0.0", "30", "0.0", "70", closed ? "1" : "0");
      for (const [px, py] of pts) ents.push("0", "VERTEX", "8", layer, "10", n3(px), "20", n3(py), "30", "0.0");
      ents.push("0", "SEQEND", "8", layer);
    };
    const text = (str, px, py, h) => ents.push("0", "TEXT", "8", LABEL_LAYER, "10", n3(px), "20", n3(py), "30", "0.0", "40", n3(h), "1", dxfText(str));
    for (const p of parts) {
      const tx = (q) => [p.ox + q[0], p.oy + (p.g.H - q[1])];
      for (const path of p.g.paths) {
        const t = TOOLS[path.tool];
        if (t.previewOnly || path.previewOnly) continue;
        poly(t.layer, path.pts.map(tx), !!path.closed);
        if (t.profile) {
          const key = t.profile + JSON.stringify(path.profileOpts || {});
          if (!profiles.has(key)) profiles.set(key, { prof: PROFILES[t.profile], opts: path.profileOpts || {}, rail: t.layer });
        }
      }
      const d = p.door, lx = p.ox + 12;
      const named = d.name && d.name !== p.g.design.name;
      const lines0 = `${p.tag} ${named ? d.name : p.g.design.name}`;
      // Text about 0.75 x its height per character; keep the longest line inside the door.
      const lh = Math.max(4, Math.min(10, (p.g.W - 24) / (0.75 * Math.max(lines0.length, 22))));
      let ly = p.oy + p.g.H / 2 + lh * 2;
      const lines = [
        lines0,
        `${d.width} x ${d.height}${named ? " " + p.g.design.name : ""}`,
        d.hingeSide === "none" ? "NO HINGES" : `HINGES ${d.hingeSide.toUpperCase()} x${d.hingeCount} (hand drill)`,
        order.ref || ""
      ];
      for (const l of lines) { if (l) text(l, lx, ly, lh); ly -= lh * 1.6; }
    }
    // Moulding profiles: one of each, below the parts (off the board), each with a note.
    // The first vertex is the start point and is the end that sits on the rail.
    let py = -40;
    for (const { prof, opts, rail } of profiles.values()) {
      const pts = prof.pts(opts);
      const minY = Math.min(...pts.map((q) => q[1]));
      poly(prof.layer, pts.map(([x, y]) => [x, py + y - minY]), false);
      const notes = [`PROFILE ${prof.layer}`, `FOR RAILS ON ${rail}`, "START POINT (1ST VERTEX) SITS ON THE RAIL"];
      if (opts.top != null) notes.push(`BEAD TOP ${opts.top} MM BELOW FACE`);
      notes.forEach((l, i) => text(l, 40, py + 6 - i * 5, 3));
      py -= 40;
    }
    const layerColor = (name) => { const t = Object.values(TOOLS).find((t) => t.layer === name); return t ? t.color : Object.values(PROFILES).some((p) => p.layer === name) ? 30 : 2; };
    const out = [
      "0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1009", "0", "ENDSEC",
      "0", "SECTION", "2", "TABLES",
      "0", "TABLE", "2", "LTYPE", "70", "1",
      "0", "LTYPE", "2", "CONTINUOUS", "70", "0", "3", "Solid line", "72", "65", "73", "0", "40", "0.0",
      "0", "ENDTAB",
      "0", "TABLE", "2", "LAYER", "70", String(used.size)
    ];
    for (const l of used) out.push("0", "LAYER", "2", l, "70", "0", "62", String(layerColor(l)), "6", "CONTINUOUS");
    out.push("0", "ENDTAB", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES");
    return out.concat(ents, ["0", "ENDSEC", "0", "EOF"]).join("\r\n") + "\r\n";
  }

  // The toolpath list for an order: one row per layer used.
  function layerList(doors) {
    const seen = new Map();
    for (const door of doors) for (const p of buildDoor(door).paths) {
      const t = TOOLS[p.tool];
      if (t.previewOnly || p.previewOnly) continue;
      seen.set(t.layer, t.label);
      if (t.profile) seen.set(PROFILES[t.profile].layer, PROFILES[t.profile].label);
    }
    return Array.from(seen, ([layer, label]) => ({ layer, label }));
  }

  return { VERSION, LIMITS, TOOLS, PROFILES, cornerRails, BANDS, DELIVERY, DESIGNS, designById, normalizeDoor, buildDoor, hingeDefault, priceDoor, priceOrder, bandFor, describe, doorSVG, orderDXF, layerList };
});
