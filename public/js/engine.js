/* Pivot door engine.
 * One source of truth for every door: the configurator preview, the price,
 * and the DXF you cut from all come from these recipes. Runs in the browser
 * (window.PivotEngine) and in Node (require("./public/js/engine.js")).
 *
 * Units are millimetres. Door coordinates have the origin at the top-left
 * corner of the front, x to the right, y down. The DXF writer flips y.
 *
 * DXF layers are named by the type of cut and its depth (e.g. POCKET_D8,
 * VGROOVE_D4). Tim sets the bits and toolpaths in VCarve.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PivotEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const VERSION = 8; // 8: tongue & bead groove: the bead is cut with the 12.7 mm reed bit at 5 mm (REED_D5), its line 12.5 mm from the V-groove line (was a 6 mm bead 9 mm away). 7: bevelled shaker options: five-piece joints, and a bevel that stops 2 mm above the panel (a chamfer on the pocket line). 6: New Country redrawn from the test cuts (3 mm pocket, grooves 5 mm from the face, a 5 mm chamfer round the panel, frame width to the top of the chamfer, optional five-piece joint grooves). 5: bevelled shaker pocket 8 mm deep with an 8 mm bevel. 4: 4: bevel matches the 5 mm pocket (90 degree V-bit); beaded shaker uses a round-over moulding rail; arched sized by side margin, mirrored about the centre; fluted margins split; reeds fixed at 12.5 mm. 2: hinge distances and notes; bevelled shaker redrawn as a 5 mm recessed panel with a bevel. 3: skinny shaker pocket 5 mm deep (was 8); arched doors adjustable, with left, right and pair layouts
  const LIMITS = { wMin: 300, wMax: 1000, hMin: 300, hMax: 1200 }; // machine bed takes 1200 x 1200 sheets; 1000 x 1200 is the largest that can be held down safely
  const OVERCUT = 10;
  const BEVEL_W = 12;            // bevelled shaker before engine version 4. From version 4 a 90 degree V-bit makes the bevel, so its width equals the pocket depth.
  const REED_PITCH = 12.5;       // reeded: centre-to-centre spacing, refined over time and fixed for customers
  const CORNER_R = 1.5;          // inside-corner radius of pockets: finished with a 1/8 in downcut or 2 mm straight bit
  const NC = { chamfer: 5 };  // New Country from version 6: chamfer depth round the panel
  const TB_BEAD = 12.5;        // tongue & bead groove from version 8: V-groove line to bead line, mm (the same as the reed spacing)
  const BEVEL_STEP = 2;       // bevelled shaker "with a step": the vertical ridge left between the bevel and the panel, mm
  const HINGE = { def: 100, min: 50 }; // hinge cup centres from the top and bottom edges, mm            // grooves that run off the door go this far past the edge
  const LABEL_LAYER = "LABELS";

  /* ---------- tooling (placeholders) ---------- */
  // width = the groove width the tool leaves at its depth, used for spacing and the preview.
  // Layers are named by the type of cut and its depth only. Tim picks the bits and
  // toolpath settings in VCarve. width = the groove width the cut leaves, used for
  // spacing and the preview.
  const TOOLS = {
    cutout:   { layer: "CUTOUT",       label: "Cut out: the door outline, profile outside",        width: 6,    color: 7 },
    pocket8:  { layer: "POCKET_D8",    label: "Pocket, 8 mm deep (inside corners 1.5 mm radius)",  width: 6,    color: 5,   pocket: true, depth: 8 },
    pocket6:  { layer: "POCKET_D6",    label: "Pocket, 6 mm deep (inside corners 1.5 mm radius)",  width: 6,    color: 5,   pocket: true, depth: 6 },
    pocket5:  { layer: "POCKET_D5",    label: "Pocket, 5 mm deep (inside corners 1.5 mm radius)",  width: 6,    color: 5,   pocket: true, depth: 5 },
    pocket4:  { layer: "POCKET_D4",    label: "Pocket, 4 mm deep (inside corners 1.5 mm radius)",  width: 6,    color: 150, pocket: true, depth: 4 },
    pocket3:  { layer: "POCKET_D3",    label: "Pocket, 3 mm deep (inside corners 1.5 mm radius)",  width: 6,    color: 150, pocket: true, depth: 3 },
    pocket2:  { layer: "POCKET_D2",    label: "Pocket, 2 mm deep (inside corners 1.5 mm radius)",  width: 6,    color: 150, pocket: true, depth: 2 },
    flute16:  { layer: "FLUTE_D5",     label: "Flute, 16 mm wide, 5 mm deep",                       width: 16,   color: 3 },
    flute8:   { layer: "FLUTE_D4",     label: "Flute, 8 mm wide, 4 mm deep",                        width: 8,    color: 3 },
    reed13:   { layer: "REED_D4",      label: "Reed groove, 12.7 mm wide, 4 mm deep",               width: 12.7, color: 4 },
    reed5:    { layer: "REED_D5",      label: "Reed bit (12.7 mm), 5 mm deep",                       width: 12.7, color: 4 },
    bead6:    { layer: "BEAD_D3",      label: "Bead, 6 mm wide, 3 mm deep",                         width: 6,    color: 4 },
    v90d4:    { layer: "VGROOVE_D4",   label: "V-groove, 90 degrees, 4 mm deep",                    width: 8,    color: 1 },
    v90d5:    { layer: "VGROOVE_D5",   label: "V-groove, 90 degrees, 5 mm deep",                    width: 10,   color: 1 },
    v90d5p:   { layer: "VGROOVE_D5",   label: "V-groove, 90 degrees, 5 mm deep from the face (2 mm below a 3 mm pocket floor)", width: 4, color: 1 },
    v90d2:    { layer: "VGROOVE_D2",   label: "V-groove, 90 degrees, 2 mm deep",                    width: 4,    color: 1 },
    bevel:    { layer: "BEVEL_D5",     label: "Bevel, 45 degrees, from this line (at the face) down to the 5 mm pocket edge", width: 5, color: 6 },
    bevel8:   { layer: "BEVEL_D8",     label: "Bevel, 45 degrees, from this line (at the face) down to the 8 mm pocket edge", width: 8, color: 6 },
    roundover:{ layer: "ROUNDOVER",    label: "Round-over on the pocket edge (12.7 mm), corners squared", width: 12.7, color: 30 },
    mould:    { layer: "MOULD",        label: "Moulding rail: set the profile in VCarve",           width: 18,   color: 30 },
    chamfer:  { layer: "CHAMFER_D3",   label: "Edge chamfer, 45 degrees, 3 mm",                     width: 6,    color: 6 },
    pchamfer6:{ layer: "CHAMFER_D6",   label: "Chamfer, 45 degrees, 6 mm deep: on this line (the pocket edge), outside, sloping up to the face 6 mm out", width: 6, color: 6, depth: 6 },
    pchamfer5:{ layer: "CHAMFER_D5",   label: "Chamfer, 45 degrees, 5 mm deep: on this line (the pocket edge), outside, sloping up to the face 5 mm out", width: 5, color: 6, depth: 5 }
  };

  /* ---------- delivery area ---------- */
  // Online payment is for mainland Great Britain only. These postcode districts
  // (Tim, 24 Nov 2026) get a quote instead, because couriers charge extra or
  // need a ferry. Returns the area's name, or null when the postcode is fine.
  const OUTSIDE = [
    ["Northern Ireland", "BT"], ["Isle of Man", "IM"], ["the Channel Islands", "JE GY"],
    ["the Isles of Scilly", "TR21-25"], ["the Isle of Wight", "PO30-41"],
    ["the Scottish islands", "HS ZE KW15-17 IV41-51 IV55-56 KA27-28 PA20 PA41-49 PA60-78 PH42-44"],
    ["the Scottish Highlands", "AB31-38 AB44-56 FK17-21 G83 IV1-40 IV52-54 IV63 KW1-14 PA21-40 PH4-41 PH49-50"]
  ];
  function deliveryArea(postcode) {
    const m = String(postcode || "").toUpperCase().replace(/\s+/g, "").match(/^([A-Z]{1,2})(\d{1,2})[A-Z]?\d[A-Z]{2}$/) ||
      String(postcode || "").toUpperCase().trim().match(/^([A-Z]{1,2})(\d{1,2})[A-Z]?$/); // a part postcode (outward code only) is checked too
    if (!m) return null;
    const area = m[1], district = Number(m[2]);
    for (const [name, list] of OUTSIDE) {
      for (const item of list.split(" ")) {
        const r = item.match(/^([A-Z]+)(?:(\d+)(?:-(\d+))?)?$/);
        if (r[1] !== area) continue;
        if (r[2] === undefined) return name;
        const lo = Number(r[2]), hi = r[3] !== undefined ? Number(r[3]) : lo;
        if (district >= lo && district <= hi) return name;
      }
    }
    return null;
  }

  /* ---------- prices: size bands (Tim, 24 Nov 2026) ---------- */
  // Every door in a band costs the same, whatever the design. Doors bigger than
  // the largest band are priced by how much of a half sheet they use, scaled from
  // the largest band's price, so the price carries on smoothly. Tim sets the band
  // prices on /admin/pricing (the server works them out and passes them in with
  // setPricing; the configurator loads them from /api/pricing).
  const PRICING_DEFAULTS = {
    bands: [
      { name: "Small", maxW: 300, maxH: 600, price: 27 },
      { name: "Regular", maxW: 600, maxH: 600, price: 36 },
      { name: "Large", maxW: 600, maxH: 1150, price: 54 },
      { name: "Extra large", maxW: 800, maxH: 1150, price: 67 }
    ],
    sheet: 1220,          // half sheet of MR MDF, 1220 x 1220 mm, for sizes beyond the bands
    border: 30,           // left round the sheet edge for screwing down, mm
    gap: 25,              // between parts, mm
    wasteShare: 0.5,      // share of a strip too narrow for another door that's charged to the door
    delivery: { first: 12, extra: 5, freeOver: 400 }, // £; free when the doors come to at least freeOver (0 = never)
    hinges: { charge: false, perDoor: 0 } // £ added to each door with hinge holes, when charge is on (Tim's choice on /admin/pricing; off by default)
  };
  let PRICING = JSON.parse(JSON.stringify(PRICING_DEFAULTS));
  // Use saved settings where they're sensible, otherwise the defaults.
  function setPricing(cfg) {
    const next = JSON.parse(JSON.stringify(PRICING_DEFAULTS));
    const numOk = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
    cfg = cfg || {};
    for (const k of ["sheet", "border", "gap", "wasteShare"]) if (numOk(cfg[k])) next[k] = cfg[k];
    next.wasteShare = Math.min(1, next.wasteShare);
    if (Array.isArray(cfg.bands) && cfg.bands.length && cfg.bands.every((b) => b && numOk(b.maxW) && numOk(b.maxH) && numOk(b.price))) {
      next.bands = cfg.bands.map((b) => ({ name: String(b.name || "").slice(0, 30), maxW: b.maxW, maxH: b.maxH, price: b.price }));
    }
    if (cfg.delivery) for (const k of ["first", "extra", "freeOver"]) if (numOk(cfg.delivery[k])) next.delivery[k] = cfg.delivery[k];
    if (cfg.hinges) {
      next.hinges.charge = cfg.hinges.charge === true;
      if (numOk(cfg.hinges.perDoor)) next.hinges.perDoor = Math.round(cfg.hinges.perDoor * 100) / 100;
    }
    PRICING = next;
    return getPricing();
  }
  const getPricing = () => JSON.parse(JSON.stringify(PRICING));

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
  // Clip a polyline to rectangle r; returns the pieces that lie inside it.
  function clipPolyline(pts, r) {
    const out = [];
    let cur = null;
    for (let i = 0; i + 1 < pts.length; i++) {
      const seg = clipSeg(pts[i], pts[i + 1], r);
      if (!seg) { cur = null; continue; }
      const last = cur && cur[cur.length - 1];
      if (last && Math.abs(last[0] - seg[0][0]) < 1e-6 && Math.abs(last[1] - seg[0][1]) < 1e-6) cur.push(seg[1]);
      else { cur = [seg[0], seg[1]]; out.push(cur); }
    }
    return out.filter((q) => q.length > 1);
  }
  // A measurement for the preview overlay: from a to b (door coordinates), with a label.
  const dim = (a, b, label, left) => ({ a, b, label, left: !!left }); // left: put a vertical label on the left of its line
  const mm = (v) => `${Math.round(v * 10) / 10} mm`;
  // A text note for the preview overlay, with an optional leader line to a point.
  const note = (at, label, to) => ({ at, label, to });
  // Grooves dividing [x0, x1] into boards. fit "exact": every board is exactly
  // `spacing` wide, centred, with the edge boards taking up the difference, so the
  // pattern matches across doors of different widths. Otherwise boards are equal.
  function boardLines(x0, x1, o) {
    const L = x1 - x0, s = o.spacing;
    if (o.fit === "exact") {
      const n = Math.floor((L - s) / s + 1e-9) + 1; // edge boards at least half a board
      if (n < 1) fail("The door is too narrow for this board width. Make the boards narrower.");
      const edge = (L - (n - 1) * s) / 2;
      return { xs: Array.from({ length: n }, (_, k) => x0 + edge + k * s), board: s, edge, info: `${n - 1} boards of ${s} mm, plus edge boards of ${Math.round(edge * 10) / 10} mm` };
    }
    const boards = Math.max(2, Math.round(L / s)), b = L / boards;
    return { xs: Array.from({ length: boards - 1 }, (_, k) => x0 + (k + 1) * b), board: b, edge: b, info: `${boards} boards, ${Math.round(b * 10) / 10} mm each` };
  }
  function boardDims(x0, x1, bl, y) {
    const out = [];
    const k = Math.max(0, Math.floor(bl.xs.length / 2) - 1);
    if (bl.xs.length > 1) out.push(dim([bl.xs[k], y], [bl.xs[k + 1], y], mm(bl.board)));
    if (bl.xs.length && Math.abs(bl.edge - bl.board) > 0.05) out.push(dim([x0, y + 60], [bl.xs[0], y + 60], `edge ${mm(bl.edge)}`));
    else if (bl.xs.length === 1) out.push(dim([x0, y], [bl.xs[0], y], mm(bl.board)));
    return out;
  }
  const fitOpt = () => choice("fit", "Board widths", "even", [["even", "Fit evenly"], ["exact", "Exact width"]],
    "Fit evenly: all boards equal, as close as possible to the board width above. Exact: every board is exactly that width, centred on the door, so the pattern matches across doors of different widths (the edge boards take up the difference).");
  function frameDims(W, H, border, rails) {
    const out = [dim([0, H * 0.3], [border, H * 0.3], mm(border)), dim([W * 0.3, 0], [W * 0.3, border], mm(border))];
    if (rails) {
      const ph = (H - 2 * border - rails * border) / (rails + 1), y0 = border + ph;
      out.push(dim([W * 0.3, y0], [W * 0.3, y0 + border], mm(border)));
    }
    return out;
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
  // Five-piece joint grooves (New Country, Bevelled shaker): from the corners of the frame's inner
  // edge (the top of the chamfer or bevel, rectangle e) to the top and bottom edges. Each groove is set
  // out by its own depth, so its inner edge meets the frame's inner edge. joint: the preview draws them
  // half a groove width inwards, as a line on that edge (the DXF uses pts).
  const JOINT = { depth: 2, tool: "v90d2" };
  function jointGrooves(e, H) {
    const d = JOINT.depth, xl = e[0] - d, xr = e[2] + d, yt = e[1] - d, yb = e[3] + d;
    return [{ tool: JOINT.tool, joint: 1, pts: [[xl, -OVERCUT], [xl, yt]] }, { tool: JOINT.tool, joint: -1, pts: [[xr, -OVERCUT], [xr, yt]] },
      { tool: JOINT.tool, joint: 1, pts: [[xl, yb], [xl, H + OVERCUT]] }, { tool: JOINT.tool, joint: -1, pts: [[xr, yb], [xr, H + OVERCUT]] }];
  }
  const jointsOpt = () => choice("joints", "Frame joints", "none", [["none", "None"], ["fivepiece", "Five-piece look"]], "Adds a groove where each rail meets a stile, so the frame looks like a traditional five-piece door.");

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

  // Arched doors as drawn by engine version 3 (sideways shift instead of a side margin), kept for old orders.
  function archedV3(W, H, o, layout, gap, box) {
    const span = layout === "single" ? W : 2 * W + gap;
    const cx = (layout === "single" ? W / 2 : layout === "left" ? W + gap / 2 : -gap / 2) + (o.shift || 0);
    const R = Math.min(span * 0.38, H - o.top - 40), cy = o.top + R;
    if (R < 40 || R - (o.count - 1) * o.spacing < 15) fail("The arches don't fit.");
    const paths = [];
    for (let i = 0; i < o.count; i++) {
      const r = R - i * o.spacing;
      for (const pts of clipPolyline([[cx - r, H + OVERCUT]].concat(arc(cx, cy, r, 180, 360, 90), [[cx + r, H + OVERCUT]]), box)) paths.push({ tool: "reed13", pts });
    }
    return { outline: rect(0, 0, W, H), paths, info: `${o.count} arches` };
  }

  /* ---------- the design recipes ---------- */
  // showIf: { otherKey: [values] } shows the option only when another option has one of those values.
  const num = (key, label, def, min, max, step, help, showIf) => ({ key, type: "number", label, def, min, max, step: step || 1, unit: "mm", help, showIf });
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
        return { outline: rect(0, 0, W, H), paths: panels.map((p) => ({ tool: "pocket8", pts: rect(...p), closed: true })), dims: frameDims(W, H, o.border, o.rails) };
      }
    },
    {
      id: "skinny", name: "Skinny shaker", family: "Shaker family", adjustable: true,
      blurb: "A narrow frame for a modern look.",
      opts: [num("border", "Frame width", 25, 18, 35, 1)],
      build(W, H, o, door) {
        // From engine version 3 the skinny panel is 5 mm deep, so hinge cups on the back don't break through the narrow frame.
        const tool = door && door.version < 3 ? "pocket8" : "pocket5";
        const panels = shakerPanels(W, H, o.border, 0);
        return { outline: rect(0, 0, W, H), paths: panels.map((p) => ({ tool, pts: rect(...p), closed: true })), dims: frameDims(W, H, o.border, 0) };
      }
    },
    {
      id: "flutedshaker", name: "Fluted shaker", family: "Frame with pattern", archived: true, adjustable: true,
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
      opts: [num("mside", "Side margins", 40, 25, 80, 1), num("mend", "Top and bottom margins", 40, 25, 120, 1), num("spacing", "Flute spacing", 22, 18, 32, 1, "Centre to centre. The flutes are 16 mm wide.")],
      build(W, H, o) {
        // Orders before engine version 4 had one margin for all four sides.
        const ms = o.mside != null ? o.mside : o.margin != null ? o.margin : 40, me = o.mend != null ? o.mend : o.margin != null ? o.margin : 40;
        if (W - 2 * ms < 40 || H - 2 * me < 80) fail("The margins are too wide for this size. Make the margins smaller or the door bigger.");
        const flutes = stoppedFlutes(ms, me, W - ms, H - me, o.spacing, TOOLS.flute16.width);
        const dims = [dim([0, H * 0.25], [ms, H * 0.25], mm(ms)), dim([W * 0.5, 0], [W * 0.5, me], mm(me))];
        if (flutes.length > 1) { const k = Math.floor(flutes.length / 2) - 1, x = flutes[k][0][0]; dims.push(dim([x, H * 0.5], [x + o.spacing, H * 0.5], mm(o.spacing))); }
        return { outline: rect(0, 0, W, H), paths: flutes.map((pts) => ({ tool: "flute16", pts })), dims };
      }
    },
    {
      id: "reeded", name: "Reeded", family: "Your current range", adjustable: false,
      blurb: "Reeds 12.5 mm apart, running the full height of the door.",
      opts: [],
      build(W, H, o) {
        const pitch = o.spacing || REED_PITCH; // orders before engine version 4 chose their own spacing
        const n = Math.floor(W / pitch + 1e-9);
        if (n < 2) fail("The door is too narrow for reeds.");
        const start = W / 2 - ((n - 1) * pitch) / 2;
        const paths = [];
        for (let k = 0; k < n; k++) paths.push({ tool: "reed13", pts: fullHeight(start + k * pitch, H) });
        const x = start + (Math.floor(n / 2) - 1) * pitch;
        return { outline: rect(0, 0, W, H), paths, dims: [dim([x, H * 0.5], [x + pitch, H * 0.5], mm(pitch))] };
      }
    },
    {
      id: "tvgroove", name: "Tongue & V groove", family: "Grooved slab", adjustable: true,
      blurb: "A flat door divided into boards by V-grooves.",
      opts: [num("spacing", "Board width", 100, 50, 200, 5), fitOpt()],
      build(W, H, o) {
        const bl = boardLines(0, W, o);
        return { outline: rect(0, 0, W, H), paths: bl.xs.map((x) => ({ tool: "v90d4", pts: fullHeight(x, H) })), dims: boardDims(0, W, bl, H * 0.45) };
      }
    },
    {
      id: "lattice", name: "Diamond lattice", family: "Your current range", archived: true, adjustable: false,
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
        // Grooves cross at x = multiples of s on the rows y = h, 2h...: each diamond is s wide and h tall.
        const dims = [dim([s, h], [2 * s, h], mm(s)), dim([s, h], [s, 2 * h], mm(h))];
        return { outline: rect(0, 0, W, H), paths, dims, info: `${N} × ${M} diamonds` };
      }
    },

    /* ----- draft designs for the first test cuts ----- */
    {
      id: "bevelled", name: "Bevelled shaker", family: "Shaker family", adjustable: true, draft: true,
      blurb: "A flat frame with a 45 degree bevel down to a recessed centre panel.",
      opts: [num("border", "Frame width", 70, 40, 120, 5, "To the top of the bevel."),
        choice("bevel", "Bevel", "floor", [["floor", "Down to the panel"], ["step", "With a 2 mm step"]], "Down to the panel: the bevel runs all the way to the recessed panel. With a 2 mm step: the bevel stops 2 mm above the panel, leaving a small square edge round it."),
        jointsOpt()],
      build(W, H, o, door) {
        // Frame (full thickness) → 45 degree bevel (90 degree V-bit, as wide as it is deep) → flat panel.
        // Version 5: 8 mm pocket and bevel. Version 4: 5 mm. Earlier: 5 mm pocket with a 12 mm bevel.
        // The frame width runs to the top of the bevel (p).
        const v = door ? door.version : VERSION;
        const [p] = shakerPanels(W, H, o.border, 0);
        const pocket = v < 5 ? "pocket5" : "pocket8", bevel = v < 5 ? "bevel" : "bevel8";
        const step = v >= 7 && o.bevel === "step";
        // Down to the panel: BEVEL line at the top of the bevel (VCarve Chamfer: inside, slope downwards, the pocket depth).
        // With a step (version 7): a chamfer on the pocket line instead (outside, slope upwards, the pocket depth less the step).
        const b = v < 4 ? BEVEL_W : TOOLS[pocket].depth - (step ? BEVEL_STEP : 0);
        const inner = rect(p[0] + b, p[1] + b, p[2] - b, p[3] - b);
        const paths = [{ tool: pocket, pts: inner, closed: true }];
        if (step) paths.push({ tool: "pchamfer" + b, pts: inner, closed: true });
        else paths.push({ tool: bevel, pts: rect(...p), inner, closed: true });
        if (v >= 7 && o.joints === "fivepiece") paths.push(...jointGrooves(p, H));
        return { outline: rect(0, 0, W, H), paths,
          dims: frameDims(W, H, o.border, 0).concat([note([p[2] - 10, p[1] + (p[3] - p[1]) * 0.75], step ? "45° bevel, 2 mm step" : "45° bevel", [p[2] - b / 2, p[1] + (p[3] - p[1]) * 0.75])]) };
      }
    },
    {
      id: "beaded", name: "Beaded shaker", family: "Shaker family", adjustable: true, draft: true,
      blurb: "A shaker with a rounded edge round the inside of the frame.",
      opts: [num("border", "Frame width", 70, 40, 120, 5)],
      build(W, H, o, door) {
        const [p] = shakerPanels(W, H, o.border, 0);
        const paths = [{ tool: "pocket8", pts: rect(...p), closed: true }];
        if (door && door.version < 4) { const bead = 6; paths.push({ tool: "bead6", pts: rect(p[0] - bead, p[1] - bead, p[2] + bead, p[3] + bead), closed: true }); }
        else paths.push({ tool: "roundover", pts: rect(...p), closed: true }); // 12.7 mm round-over, moulding toolpath for square corners
        return { outline: rect(0, 0, W, H), paths, dims: frameDims(W, H, o.border, 0).concat([note([p[2] - 8, p[1] + (p[3] - p[1]) * 0.75], "12.7 mm round-over", [p[2] + 4, p[1] + (p[3] - p[1]) * 0.75])]) };
      }
    },
    {
      id: "newcountry", name: "New Country", family: "Shaker family", adjustable: true, draft: true, noNote: true,
      blurb: "A shaker with V-grooved boards in the panel.",
      opts: [num("border", "Frame width", 70, 40, 120, 5, "To the top of the chamfer round the panel."), num("spacing", "Board width", 80, 50, 150, 5), fitOpt(),
        jointsOpt()],
      build(W, H, o, door) {
        if (door && door.version < 6) { // engine version 5 and earlier: 8 mm pocket at the frame width, 4 mm grooves
          const [p] = shakerPanels(W, H, o.border, 0);
          const bl = boardLines(p[0], p[2], o);
          const paths = [{ tool: "pocket8", pts: rect(...p), closed: true }];
          for (const x of bl.xs) paths.push({ tool: "v90d4", pts: [[x, p[1]], [x, p[3]]] });
          return { outline: rect(0, 0, W, H), paths, dims: frameDims(W, H, o.border, 0).concat(boardDims(p[0], p[2], bl, H * 0.62)) };
        }
        // Version 6 (Tim's test cuts): 3 mm pocket; grooves 2 mm below its floor (5 mm from the face);
        // a 5 mm chamfer on the pocket line rising to the face 5 mm out. The frame width runs to the
        // top of the chamfer, so the pocket line is NC.chamfer further in.
        const [p] = shakerPanels(W, H, o.border + NC.chamfer, 0);
        const bl = boardLines(p[0], p[2], o);
        const paths = [{ tool: "pocket3", pts: rect(...p), closed: true }, { tool: "pchamfer5", pts: rect(...p), closed: true }];
        for (const x of bl.xs) paths.push({ tool: "v90d5p", pts: [[x, p[1]], [x, p[3]]] });
        // Joint grooves set out from the top of the chamfer (the pocket line + the chamfer depth), plus the groove depth.
        if (o.joints === "fivepiece") paths.push(...jointGrooves([p[0] - NC.chamfer, p[1] - NC.chamfer, p[2] + NC.chamfer, p[3] + NC.chamfer], H));
        return { outline: rect(0, 0, W, H), paths, dims: frameDims(W, H, o.border, 0).concat(boardDims(p[0], p[2], bl, H * 0.62)) };
      }
    },
    {
      id: "mouldedflute", name: "Moulded frame, fluted", family: "Frame with pattern", archived: true, adjustable: true, draft: true,
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
      id: "victorian", name: "Victorian", family: "Frame with pattern", archived: true, adjustable: false, draft: true,
      blurb: "A shaker with a decorative moulding inside the panel.",
      opts: [],
      build(W, H, o) {
        const [p] = shakerPanels(W, H, o.border || 70, 0), m = o.inset || 20;
        if (p[2] - p[0] < 2 * m + 60 || p[3] - p[1] < 2 * m + 80) fail("This door is too small for the inner moulding. Make it bigger.");
        return { outline: rect(0, 0, W, H), paths: [{ tool: "pocket8", pts: rect(...p), closed: true }, { tool: "mould", pts: rect(p[0] + m, p[1] + m, p[2] - m, p[3] - m), closed: true }] };
      }
    },
    {
      id: "georgian", name: "Georgian", family: "Frame with pattern", adjustable: true, draft: true,
      blurb: "A frame that steps down twice to the panel.",
      opts: [
        num("border", "Frame width", 55, 40, 120, 5),
        num("shoulder", "Shoulder width", 20, 10, 40, 1, "The step between the frame and the panel."),
        choice("sdepth", "Shoulder depth", "4", [["2", "2 mm"], ["3", "3 mm"], ["4", "4 mm"], ["5", "5 mm"], ["6", "6 mm"]], "4 mm is half the 8 mm panel depth.")
      ],
      build(W, H, o) {
        // Orders before engine version 4 were fixed at 55 + 20 mm and a 4 mm shoulder, the same as the defaults.
        const fw = o.border || o.outer || 55, sw = o.shoulder || (o.inner ? o.inner - fw : 20), sd = Number(o.sdepth) || 4;
        const [outer] = shakerPanels(W, H, fw, 0), [inner] = shakerPanels(W, H, fw + sw, 0);
        return { outline: rect(0, 0, W, H), paths: [{ tool: "pocket" + sd, pts: rect(...outer), closed: true }, { tool: "pocket8", pts: rect(...inner), closed: true }],
          dims: frameDims(W, H, fw, 0).concat([dim([outer[0], H * 0.45], [inner[0], H * 0.45], mm(sw))]) };
      }
    },
    {
      id: "tbgroove", name: "Tongue & bead groove", family: "Grooved slab", adjustable: true, draft: true,
      blurb: "Boards divided by grooves, each with a bead beside it.",
      opts: [num("spacing", "Board width", 100, 50, 200, 5), fitOpt()],
      build(W, H, o, door) {
        const bl = boardLines(0, W, o);
        const paths = [];
        // Version 8 (Tim's test cuts): the bead is cut with the reed bit at 5 mm, its line TB_BEAD mm from the V-groove line.
        // Earlier orders: a 6 mm bead 9 mm away.
        const old = door && door.version < 8;
        for (const x of bl.xs) paths.push({ tool: "v90d4", pts: fullHeight(x, H) }, old ? { tool: "bead6", pts: fullHeight(x + 9, H) } : { tool: "reed5", pts: fullHeight(x + TB_BEAD, H) });
        return { outline: rect(0, 0, W, H), paths, dims: boardDims(0, W, bl, H * 0.45) };
      }
    },
    {
      id: "arched", name: "Arched", family: "Your current range", adjustable: true, draft: true,
      blurb: "Concentric arches rising from the bottom edge. Designed to flow across a pair of doors (a quarter turn on each), or on one door.",
      opts: [
        choice("layout", "Doors", "single", [["single", "Single door"], ["left", "Left of a pair"], ["right", "Right of a pair"], ["pair", "Both doors"]],
          "The arches are centred on the gap between a pair of doors. Both doors are the size you enter."),
        int("count", "Number of arches", 4, 1, 5),
        num("gap", "Gap between the doors", 3, 0, 10, 0.5, "The gap you'll leave between the pair when they're hung.", { layout: ["left", "right", "pair"] }),
        num("spacing", "Arch spacing", 30, 16, 60, 1, "Centre to centre. The grooves are cut with a 12.7 mm form tool."),
        num("top", "Top of the arches from the top edge", 100, 20, 600, 5, "Stays where you set it when you change the width."),
        num("margin", "Side margin", 50, 15, 300, 5, "From the outside edge of the door to the outer arch. The arches stay centred on the door, or on the gap between a pair, so both sides match.")
      ],
      build(W, H, o, door) {
        if (door && door.version < 3) { // the fixed design from before engine version 3, kept for old orders
          const R = Math.min(W * 0.38, H * 0.42), gap = R / 4.5, cx = W / 2, cy = H * 0.16 + R;
          if (cy > H - 40) fail("This door is too short for the arches. Make it taller.");
          const paths = [];
          for (let i = 0; i < 4; i++) {
            const r = R - i * gap;
            paths.push({ tool: "reed13", pts: [[cx - r, H + OVERCUT]].concat(arc(cx, cy, r, 180, 360), [[cx + r, H + OVERCUT]]) });
          }
          return { outline: rect(0, 0, W, H), paths, info: "4 arches" };
        }
        const layout = o.layout === "pair" ? "left" : o.layout, gap = layout === "single" ? 0 : o.gap;
        const box = { x0: -OVERCUT, y0: -OVERCUT, x1: W + OVERCUT, y1: H + OVERCUT };
        const tw = TOOLS.reed13.width;
        if (door && door.version < 4) return archedV3(W, H, o, layout, gap, box);
        // Version 4: the arches are mirrored about the centre line of the door, or of the
        // gap for a pair. The side margin sets their width; the top stays where it's set.
        const cx = layout === "single" ? W / 2 : layout === "left" ? W + gap / 2 : -gap / 2;
        const reach = layout === "single" ? W / 2 : W + gap / 2; // from the outer edge to the centre line
        const R = reach - o.margin - tw / 2, cy = o.top + tw / 2 + R, rIn = R - (o.count - 1) * o.spacing;
        if (R < 40) fail("The side margin is too wide for this door. Make the margin smaller.");
        if (rIn - tw / 2 < 10) fail("There isn't room for that many arches. Use fewer arches, closer spacing or a smaller side margin.");
        if (cy > H - 30) fail("The arches don't fit at this height. Move them up, make the side margin wider, or make the door taller.");
        const paths = [];
        for (let i = 0; i < o.count; i++) {
          const r = R - i * o.spacing;
          for (const pts of clipPolyline([[cx - r, H + OVERCUT]].concat(arc(cx, cy, r, 180, 360, 90), [[cx + r, H + OVERCUT]]), box)) paths.push({ tool: "reed13", pts });
        }
        // Measurements: top, spacing, side margin, and from the innermost arch to the door's inner edge.
        const mx = layout === "single" ? cx : layout === "left" ? W - 30 : 30, left = layout === "left";
        const yAt = (r) => cy - Math.sqrt(Math.max(0, r * r - (mx - cx) * (mx - cx)));
        const yl = (cy + H) / 2;
        const dims = [dim([mx, 0], [mx, yAt(R) - tw / 2], mm(o.top), left)];
        if (o.count > 1) dims.push(dim([mx, yAt(R)], [mx, yAt(R - o.spacing)], mm(o.spacing), left));
        if (layout === "right") dims.push(dim([cx + R + tw / 2, yl], [W, yl], mm(o.margin)), dim([0, yl - 60], [cx + rIn - tw / 2, yl - 60], mm(cx + rIn - tw / 2)));
        else dims.push(dim([0, yl], [cx - R - tw / 2, yl], mm(o.margin)));
        if (layout === "left") dims.push(dim([cx - rIn + tw / 2, yl - 60], [W, yl - 60], mm(W - (cx - rIn + tw / 2))));
        if (layout === "single") dims.push(dim([cx - rIn + tw / 2, yl - 60], [cx + rIn - tw / 2, yl - 60], mm(2 * (rIn - tw / 2))));
        return { outline: rect(0, 0, W, H), paths, dims, info: `${o.count} arch${o.count === 1 ? "" : "es"}` };
      }
    },
    {
      id: "archtop", name: "Arch-top beaded door", family: "Statement", archived: true, adjustable: false, draft: true,
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
      id: "ringpanel", name: "Ring and arc panel", family: "Statement", archived: true, adjustable: false, draft: true,
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
  const ORDER = ["slab", "shaker", "skinny", "bevelled", "beaded", "newcountry", "flutedshaker", "mouldedflute", "victorian", "georgian", "tvgroove", "tbgroove", "fluted", "reeded", "lattice", "arched", "archtop", "ringpanel"];
  DESIGNS.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  const designById = (id) => DESIGNS.find((d) => d.id === id);
  // Archived designs (kept for old orders) and lab designs (test page only) can't be ordered.
  const orderable = (d) => !!d && !d.archived && !d.lab;
  const optShown = (o, opts) => !o.showIf || Object.keys(o.showIf).every((k) => o.showIf[k].includes(opts[k]));

  // The physical doors one order line makes. An arched pair is two doors, left and right,
  // both the size entered, with hinges (if any) on their outer edges.
  function doorParts(door) {
    if (door.design === "arched" && door.opts && door.opts.layout === "pair" && !(door.version < 3)) {
      return ["left", "right"].map((side) => Object.assign({}, door, {
        opts: Object.assign({}, door.opts, { layout: side }), part: side,
        hingeSide: door.hingeSide === "none" ? "none" : side
      }));
    }
    return [door];
  }

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
    if (side !== "none") {
      // Distance of the top and bottom hinge cups from the door's top and bottom edges.
      const dist = (v) => { v = (v === undefined || v === null || v === "") ? HINGE.def : Math.round(Number(v)); return v; };
      door.hingeTop = dist(input.hingeTop);
      door.hingeBottom = dist(input.hingeBottom);
      for (const [k, label] of [["hingeTop", "Top hinge distance"], ["hingeBottom", "Bottom hinge distance"]]) {
        if (!Number.isFinite(door[k]) || door[k] < HINGE.min || (Number.isFinite(H) && door[k] > H / 2 - 25)) errors[k] = `${label} must be between ${HINGE.min} mm and ${Number.isFinite(H) ? Math.floor(H / 2 - 25) : "half the door height"} mm.`;
      }
      if (!errors.hingeTop && !errors.hingeBottom && Number.isFinite(H) && count > 2 && (H - door.hingeTop - door.hingeBottom) / (count - 1) < 60) errors.hingeCount = "Those hinges would be too close together. Use fewer hinges or move them further apart.";
      const notes = cleanText(input.hingeNotes, 200);
      if (notes) door.hingeNotes = notes;
    }
    if (!errors.width && !errors.height && !Object.keys(errors).some((k) => d.opts.some((o) => o.key === k))) {
      try { doorParts(door).forEach(buildDoor); } catch (e) { if (e instanceof DesignError) errors.geometry = e.message; else throw e; }
    }
    return { door, errors };
  }

  /* ---------- geometry ---------- */
  function hingePositions(door) {
    if (door.hingeSide === "none" || !door.hingeCount) return [];
    const H = door.height, n = door.hingeCount, bottom = door.hingeBottom || HINGE.def;
    let top = door.hingeTop || HINGE.def;
    if (door.design === "archtop") top = Math.max(top, door.width / 2 + 50); // keep the top hinge below the arch
    const x = door.hingeSide === "left" ? 22.5 : door.width - 22.5;
    const ys = [];
    for (let i = 0; i < n; i++) ys.push(top + ((H - top - bottom) * i) / (n - 1));
    return ys.map((y) => [x, y]);
  }
  function buildDoor(door) {
    const d = designById(door.design);
    if (!d) fail("Unknown design.");
    const g = d.build(door.width, door.height, door.opts || {}, door);
    g.paths.unshift({ tool: "cutout", pts: g.outline, closed: true });
    return { W: door.width, H: door.height, outline: g.outline, paths: g.paths, dims: g.dims || [], info: g.info || "", hinges: hingePositions(door), design: d };
  }

  /* ---------- prices ---------- */
  // How much of a usable half sheet one door takes. Each side is the door plus one
  // gap; if what's left beside it is too narrow for another door, part of that
  // strip (wasteShare) is charged too. A door bigger than the usable area takes the whole side.
  function sheetShare(W, H) {
    const P = PRICING, usable = P.sheet - 2 * P.border + P.gap, room = LIMITS.wMin + P.gap;
    const side = (d) => {
      if (d > P.sheet - 2 * P.border) return usable;
      const e = d + P.gap, left = usable - e;
      return left < room ? e + left * P.wasteShare : e;
    };
    return Math.min(1, side(W) * side(H) / (usable * usable));
  }
  const bandFor = (W, H) => PRICING.bands.find((b) => W <= b.maxW && H <= b.maxH) || null;
  // Price of one door, in whole pounds, before any hinge charge.
  function priceOne(door) {
    const W = door.width, H = door.height, band = bandFor(W, H);
    if (band) return band.price;
    const top = PRICING.bands.reduce((a, b) => (b.maxW * b.maxH > a.maxW * a.maxH ? b : a));
    return Math.max(top.price, Math.round(top.price * sheetShare(W, H) / sheetShare(top.maxW, top.maxH)));
  }
  // The hinge-hole charge for one order line's worth (each door of a pair is charged), in £.
  // Nothing when the charge is switched off (the default) or the door has no hinge holes.
  function hingeCharge(door) {
    const h = PRICING.hinges;
    if (!h.charge || !h.perDoor || !door.hingeSide || door.hingeSide === "none") return 0;
    return h.perDoor * doorParts(door).length;
  }
  const minDoorPrice = () => Math.min(...PRICING.bands.map((b) => b.price));
  // Price of one order line's worth (a pair counts as two doors).
  function priceDoor(door) {
    if (!Number.isFinite(door.width) || !Number.isFinite(door.height)) return null;
    return doorParts(door).reduce((a, p) => a + priceOne(p), 0) + hingeCharge(door);
  }
  const pounds = (n) => Math.round(n * 100) / 100;
  // How much a discount code takes off the doors (never delivery), in £.
  // code: { code, kind: "percent" | "amount", value, minSpend } as checked by the server.
  function discountFor(code, sub) {
    if (!code || !sub) return 0;
    if (code.minSpend && sub < code.minSpend) return 0;
    const off = code.kind === "percent" ? sub * Math.min(100, code.value) / 100 : code.value;
    return pounds(Math.max(0, Math.min(sub, off)));
  }
  // Totals for a basket. Free delivery is judged on the doors before any discount.
  function priceOrder(doors, code) {
    const D = PRICING.delivery;
    const count = doors.reduce((a, d) => a + d.qty * doorParts(d).length, 0);
    const sub = pounds(doors.reduce((a, d) => a + d.qty * (priceDoor(d) || 0), 0));
    const hinges = pounds(doors.reduce((a, d) => a + d.qty * hingeCharge(d), 0));
    const free = !!(count && D.freeOver > 0 && sub >= D.freeOver);
    const ship = count && !free ? D.first + D.extra * (count - 1) : 0;
    const off = discountFor(code, sub);
    const t = { count, sub, hinges, ship, total: pounds(sub - off + ship), freeDelivery: free, freeOver: D.freeOver };
    if (code) {
      t.discount = { code: code.code, kind: code.kind, value: code.value, minSpend: code.minSpend || 0, amount: off };
    }
    return t;
  }

  /* ---------- descriptions ---------- */
  function describe(door) {
    const d = designById(door.design);
    const bits = d.opts.filter((o) => door.opts[o.key] !== undefined && optShown(o, door.opts)).map((o) => {
      const v = door.opts[o.key];
      if (o.type === "choice") return `${o.label}: ${(o.choices.find((c) => c[0] === v) || [v, v])[1]}`;
      return `${o.label}: ${v}${o.unit ? " " + o.unit : ""}`;
    });
    if (door.hingeSide === "none") bits.push("No hinge holes");
    else {
      const t = door.hingeTop || HINGE.def, b = door.hingeBottom || HINGE.def;
      bits.push(`Hinges ${doorParts(door).length > 1 ? "on the outer edges" : door.hingeSide}, ${door.hingeCount}, ${t === b ? `${t} mm from top and bottom` : `${t} mm from top, ${b} mm from bottom`}`);
      if (door.hingeNotes) bits.push(`Hinge notes: ${door.hingeNotes}`);
    }
    return bits.join(" · ");
  }

  // What a customer should know about the recess: depth and the cutter's corner radius.
  function designNote(door) {
    if (designById(door.design).noNote) return "";
    const pockets = buildDoor(door).paths.map((p) => TOOLS[p.tool]).filter((t) => t.pocket && t.depth);
    if (!pockets.length) return "";
    const depths = Array.from(new Set(pockets.map((t) => t.depth))).sort((a, b) => a - b);
    const depth = depths.length > 1 ? `The frame steps down ${depths.slice(0, -1).join(" mm, then ")} mm, then ${depths[depths.length - 1]} mm to the panel.` : `The panel is recessed ${depths[0]} mm.`;
    return `${depth} The inside corners of the recess have a ${CORNER_R} mm radius, left by the cutter.`;
  }

  /* ---------- SVG preview ---------- */
  let uid = 0;
  const f1 = (v) => Math.round(v * 10) / 10;
  const ptsAttr = (pts) => pts.map((p) => f1(p[0]) + "," + f1(p[1])).join(" ");
  // opt.dims: overall width and height. opt.measures: the detailed overlay (frame widths, spacing, hinge distances).
  function doorSVG(door, opt) {
    opt = opt || {};
    const gs = doorParts(door).map(buildDoor);
    const W = gs[0].W, H = gs[0].H, pair = gs.length > 1, id = "pv" + (++uid);
    const realGap = pair ? Number(door.opts.gap) || 0 : 0, gap = pair ? Math.max(realGap, 10) : 0; // drawn at least 10 mm so the seam shows
    const TW = gs.length * W + (gs.length - 1) * gap;
    const fill = opt.fill || "#CDB28A", edge = opt.edge || "#9C8462";
    const dims = !!opt.dims, M = Math.max(TW, H), pad = dims ? M * 0.12 : 8;
    const vb = [-pad * (dims ? 0.35 : 1), -pad * (dims ? 0.35 : 1), TW + pad * (dims ? 1.35 : 2), H + pad * (dims ? 1.35 : 2)];
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(f1).join(" ")}" role="img" aria-label="${gs[0].design.name}, ${pair ? "a pair of doors, each " : ""}${W} by ${H} mm">`;
    s += `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient>`;
    gs.forEach((g, k) => { s += `<clipPath id="${id}c${k}"><polygon points="${ptsAttr(g.outline)}"/></clipPath>`; });
    s += `</defs>`;
    gs.forEach((g, k) => {
      s += `<g transform="translate(${f1(k * (W + gap))} 0)">`;
      s += `<polygon points="${ptsAttr(g.outline)}" fill="${fill}"/>`;
      s += `<g clip-path="url(#${id}c${k})">`;
      for (const p of g.paths) {
        const t = TOOLS[p.tool];
        if (p.tool === "cutout") continue;
        if (t.pocket) {
          s += `<polygon points="${ptsAttr(p.pts)}" fill="#000" fill-opacity=".10" stroke="#000" stroke-opacity=".35" stroke-width="2"/>`;
          if (p.pts.length === 4) s += `<polyline points="${ptsAttr([p.pts[3], p.pts[0], p.pts[1]])}" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="4"/>`;
        } else if ((p.tool === "bevel" || p.tool === "bevel8") && p.inner) {
          // Four sloping faces between the frame and the recessed panel, lit from the top left.
          const o = p.pts, i = p.inner;
          const faces = [[o[0], o[1], i[1], i[0], ".22"], [o[1], o[2], i[2], i[1], ".05"], [o[2], o[3], i[3], i[2], ".02"], [o[3], o[0], i[0], i[3], ".16"]];
          for (const [a, b, c, d2, op] of faces) s += `<polygon points="${ptsAttr([a, b, c, d2])}" fill="#000" fill-opacity="${op}"/>`;
          s += `<polygon points="${ptsAttr([o[1], o[2], i[2], i[1]])}" fill="#fff" fill-opacity=".10"/><polygon points="${ptsAttr([o[2], o[3], i[3], i[2]])}" fill="#fff" fill-opacity=".16"/>`;
          s += `<polygon points="${ptsAttr(o)}" fill="none" stroke="#000" stroke-opacity=".30" stroke-width="1.5"/><polygon points="${ptsAttr(i)}" fill="none" stroke="#000" stroke-opacity=".22" stroke-width="1"/>`;
        } else if (p.tool === "roundover" && p.pts.length === 4) {
          // A rounded edge on the frame, just outside the pocket: shaded band, lit from the top left.
          const w = t.width, [a, , c] = p.pts, o = rect(a[0] - w, a[1] - w, c[0] + w, c[1] + w), i = p.pts;
          const faces = [[o[0], o[1], i[1], i[0], ".10"], [o[1], o[2], i[2], i[1], ".04"], [o[2], o[3], i[3], i[2], ".03"], [o[3], o[0], i[0], i[3], ".08"]];
          for (const [q1, q2, q3, q4, op] of faces) s += `<polygon points="${ptsAttr([q1, q2, q3, q4])}" fill="#000" fill-opacity="${op}"/>`;
          s += `<polygon points="${ptsAttr(o)}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>`;
        } else if (p.tool.startsWith("pchamfer") && p.pts.length === 4) {
          // A chamfer rising from the pocket edge to the frame face, lit from the top left.
          const w = t.width, [a, , c] = p.pts, o = rect(a[0] - w, a[1] - w, c[0] + w, c[1] + w), i = p.pts;
          const faces = [[o[0], o[1], i[1], i[0], ".20"], [o[1], o[2], i[2], i[1], ".05"], [o[2], o[3], i[3], i[2], ".02"], [o[3], o[0], i[0], i[3], ".14"]];
          for (const [q1, q2, q3, q4, op] of faces) s += `<polygon points="${ptsAttr([q1, q2, q3, q4])}" fill="#000" fill-opacity="${op}"/>`;
          s += `<polygon points="${ptsAttr(o)}" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="1.5"/>`;
        } else if (p.tool === "chamfer") {
          s += `<polygon points="${ptsAttr(p.pts)}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="5"/>`;
        } else if (p.joint) {
          // Five-piece joint groove: a fine shadow line on the chamfer's top edge.
          const w = t.width, pts = p.pts.map((q) => [q[0] + p.joint * w / 2, q[1]]);
          s += `<polyline points="${ptsAttr(pts)}" fill="none" stroke="#000" stroke-opacity=".30" stroke-width="${f1(w * 0.6)}"/>`;
          s += `<polyline points="${ptsAttr(pts.map((q) => [q[0] + p.joint * w * 0.4, q[1]]))}" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="${f1(w * 0.25)}"/>`;
        } else {
          const w = t.width, el = p.closed ? "polygon" : "polyline";
          s += `<${el} points="${ptsAttr(p.pts)}" fill="none" stroke="#000" stroke-opacity="${p.tool === "mould" || p.tool === "bevel" ? ".14" : ".24"}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
          s += `<${el} points="${ptsAttr(p.pts.map((q) => [q[0] + w * 0.22, q[1] + w * 0.22]))}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="${f1(w * 0.28)}" stroke-linecap="round" stroke-linejoin="round"/>`;
        }
      }
      s += `</g>`;
      s += `<polygon points="${ptsAttr(g.outline)}" fill="url(#${id}g)" stroke="${edge}" stroke-width="2"/>`;
      for (const [x, y] of g.hinges) s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="17.5" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="1.5" stroke-dasharray="4 3"/>`;
      if (opt.measures) {
        const fs = M * 0.026, list = k ? [] : g.dims.slice(); // a pair's design measurements are shown once, on the left door
        if (g.hinges.length) {
          const hx = g.hinges[0][0], ys = g.hinges.map((q) => q[1]);
          const inLeft = hx > W / 2;
          list.push(dim([hx, 0], [hx, ys[0]], mm(ys[0]), inLeft), dim([hx, ys[ys.length - 1]], [hx, H], mm(H - ys[ys.length - 1]), inLeft));
        }
        if (!k || !pair) for (const m of pocketNotes(g, fs)) list.push(m);
        for (const m of list) s += measureSVG(m, fs);
      }
      s += `</g>`;
    });
    if (dims) {
      const fs = M * 0.035, c = opt.ink || "currentColor", lw = M * 0.003, tk = fs * 0.45;
      const yd = H + pad * 0.45, xd = TW + pad * 0.45;
      s += `<g stroke="${c}" stroke-width="${f1(lw)}"><line x1="0" y1="${f1(yd)}" x2="${W}" y2="${f1(yd)}"/><line x1="0" y1="${f1(yd - tk)}" x2="0" y2="${f1(yd + tk)}"/><line x1="${W}" y1="${f1(yd - tk)}" x2="${W}" y2="${f1(yd + tk)}"/>` +
        `<line x1="${f1(xd)}" y1="0" x2="${f1(xd)}" y2="${H}"/><line x1="${f1(xd - tk)}" y1="0" x2="${f1(xd + tk)}" y2="0"/><line x1="${f1(xd - tk)}" y1="${H}" x2="${f1(xd + tk)}" y2="${H}"/></g>`;
      s += `<text x="${f1(W / 2)}" y="${f1(yd + fs * 1.35)}" text-anchor="middle" font-size="${f1(fs)}" fill="${c}" font-family="system-ui, sans-serif">${W} mm${pair ? " each" : ""}</text>`;
      s += `<text transform="translate(${f1(xd + fs * 1.2)} ${f1(H / 2)}) rotate(90)" text-anchor="middle" font-size="${f1(fs)}" fill="${c}" font-family="system-ui, sans-serif">${H} mm</text>`;
      if (pair && opt.measures) s += `<text x="${f1(W + gap / 2)}" y="${f1(yd + fs * 1.35)}" text-anchor="middle" font-size="${f1(fs * 0.8)}" fill="${c}" font-family="system-ui, sans-serif">${mm(realGap)} gap</text>`;
    }
    return s + `</svg>`;
  }
  // Depth labels for each pocket depth, and the inside-corner radius on the deepest pocket.
  function pocketNotes(g, fs) {
    const bb = (pts) => { const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
    const pk = g.paths.filter((p) => TOOLS[p.tool].pocket).map((p) => ({ d: TOOLS[p.tool].depth, b: bb(p.pts), rect: p.pts.length === 4 }));
    const out = [], seen = new Set();
    for (const p of pk) {
      if (seen.has(p.d)) continue;
      seen.add(p.d);
      const inner = pk.find((q) => q.d > p.d && q.b[0] >= p.b[0] && q.b[2] <= p.b[2] && q.b[1] >= p.b[1] && q.b[3] <= p.b[3]);
      const y = inner ? (p.b[1] + inner.b[1]) / 2 + fs * 0.35 : (p.b[1] + p.b[3]) / 2;
      out.push(note([(p.b[0] + p.b[2]) / 2, y], `${p.d} mm deep`));
    }
    const deep = pk.filter((p) => p.rect).sort((a, b) => b.d - a.d)[0];
    if (deep) out.push(note([deep.b[0] + fs * 1.4, deep.b[1] + fs * 2.6], `R ${CORNER_R} mm corners`, [deep.b[0] + 1, deep.b[1] + 1]));
    return out;
  }
  // One measurement line with end ticks and a haloed label, or a note (m.at) with an optional leader.
  function measureSVG(m, fs) {
    if (m.at) {
      const ink = "#1F2A22", [x, y] = m.at, right = m.to && m.to[0] > x;
      let s = m.to ? `<line x1="${f1(x)}" y1="${f1(y - fs * 0.35)}" x2="${f1(m.to[0])}" y2="${f1(m.to[1])}" stroke="${ink}" stroke-width="${f1(fs * 0.07)}"/><circle cx="${f1(m.to[0])}" cy="${f1(m.to[1])}" r="${f1(fs * 0.15)}" fill="${ink}"/>` : "";
      s += `<text x="${f1(x)}" y="${f1(y)}" text-anchor="${m.to ? (right ? "end" : "start") : "middle"}" font-size="${f1(fs)}" font-weight="600" fill="${ink}" stroke="#fff" stroke-width="${f1(fs * 0.28)}" paint-order="stroke" stroke-linejoin="round" font-family="system-ui, sans-serif">${m.label}</text>`;
      return s;
    }
    const [x0, y0] = m.a, [x1, y1] = m.b, horiz = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
    const tk = fs * 0.4, ink = "#1F2A22", lw = f1(fs * 0.08);
    const ticks = horiz ? [[x0, y0 - tk, x0, y0 + tk], [x1, y1 - tk, x1, y1 + tk]] : [[x0 - tk, y0, x0 + tk, y0], [x1 - tk, y1, x1 + tk, y1]];
    let s = `<g stroke="${ink}" stroke-width="${lw}"><line x1="${f1(x0)}" y1="${f1(y0)}" x2="${f1(x1)}" y2="${f1(y1)}"/>` + ticks.map((t) => `<line x1="${f1(t[0])}" y1="${f1(t[1])}" x2="${f1(t[2])}" y2="${f1(t[3])}"/>`).join("") + `</g>`;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const txt = `font-size="${f1(fs)}" font-weight="600" fill="${ink}" stroke="#fff" stroke-width="${f1(fs * 0.28)}" paint-order="stroke" stroke-linejoin="round" font-family="system-ui, sans-serif"`;
    s += horiz ? `<text x="${f1(mx)}" y="${f1(my - fs * 0.45)}" text-anchor="middle" ${txt}>${m.label}</text>`
      : `<text x="${f1(mx + (m.left ? -fs * 0.45 : fs * 0.45))}" y="${f1(my + fs * 0.35)}"${m.left ? ' text-anchor="end"' : ""} ${txt}>${m.label}</text>`;
    return s;
  }

  /* ---------- DXF (R12 ASCII) ---------- */
  const n3 = (v) => (Math.round(v * 1000) / 1000).toFixed(3);
  function dxfText(s) { return String(s).replace(/[^\x20-\x7E]/g, "").slice(0, 60); }

  // order: { ref, doors: [normalized door], sheetWidth? }. Each door copy becomes its
  // own part, spread out in rows no wider than sheetWidth (default 2440 mm) for VCarve to nest.
  function orderDXF(order) {
    const parts = [];
    order.doors.forEach((line, i) => {
      for (let c = 1; c <= line.qty; c++) {
        for (const door of doorParts(line)) {
          const tag = (line.qty > 1 ? `${i + 1}.${c}` : `${i + 1}`) + (door.part ? (door.part === "left" ? "L" : "R") : "");
          parts.push({ door, tag, g: buildDoor(door) });
        }
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
    const poly = (layer, pts, closed) => {
      used.add(layer);
      ents.push("0", "POLYLINE", "8", layer, "66", "1", "10", "0.0", "20", "0.0", "30", "0.0", "70", closed ? "1" : "0");
      for (const [px, py] of pts) ents.push("0", "VERTEX", "8", layer, "10", n3(px), "20", n3(py), "30", "0.0");
      ents.push("0", "SEQEND", "8", layer);
    };
    const text = (str, px, py, h) => ents.push("0", "TEXT", "8", LABEL_LAYER, "10", n3(px), "20", n3(py), "30", "0.0", "40", n3(h), "1", dxfText(str));
    for (const p of parts) {
      const tx = (q) => [p.ox + q[0], p.oy + (p.g.H - q[1])];
      for (const path of p.g.paths) poly(TOOLS[path.tool].layer, path.pts.map(tx), !!path.closed);
      const d = p.door, lx = p.ox + 12;
      const named = d.name && d.name !== p.g.design.name;
      const lines0 = `${p.tag} ${named ? d.name : p.g.design.name}${d.part ? ` (${d.part.toUpperCase()} OF PAIR)` : ""}`;
      // Text about 0.75 x its height per character; keep the longest line inside the door.
      const lines = [
        lines0,
        `${d.width} x ${d.height}${named ? " " + p.g.design.name : ""}`,
        d.hingeSide === "none" ? "NO HINGES" : `HINGES ${d.hingeSide.toUpperCase()} x${d.hingeCount} TOP ${d.hingeTop || HINGE.def} BOTTOM ${d.hingeBottom || HINGE.def}`,
        d.hingeNotes ? "HINGE NOTE: " + d.hingeNotes.slice(0, 30) + (d.hingeNotes.length > 30 ? "..." : "") : "",
        order.ref || ""
      ];
      const lh = Math.max(4, Math.min(10, (p.g.W - 24) / (0.75 * Math.max(22, ...lines.map((l) => l.length)))));
      let ly = p.oy + p.g.H / 2 + lh * 2;
      for (const l of lines) { if (l) text(l, lx, ly, lh); ly -= lh * 1.6; }
    }
    const layerColor = (name) => { const t = Object.values(TOOLS).find((t) => t.layer === name); return t ? t.color : 2; };
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
    for (const line of doors) for (const door of doorParts(line)) for (const p of buildDoor(door).paths) { const t = TOOLS[p.tool]; seen.set(t.layer, t.label); }
    return Array.from(seen, ([layer, label]) => ({ layer, label }));
  }

  return { VERSION, LIMITS, TOOLS, PRICING_DEFAULTS, setPricing, getPricing, deliveryArea, sheetShare, bandFor, minDoorPrice, DESIGNS, designById, orderable, optShown, doorParts, designNote, normalizeDoor, buildDoor, hingeDefault, hingeCharge, priceDoor, priceOrder, discountFor, describe, doorSVG, orderDXF, layerList };
});
