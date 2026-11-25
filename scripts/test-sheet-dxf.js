// Test sheet (25 Nov 2026): nine 360 x 360 test panels on one 1200 x 1200 sheet of
// standard MDF, to prove bits and depths before cutting MR MDF examples. Every cut
// layer is tested once. Slab, Traditional shaker and Arched are left off (see docs/BACKLOG.md).
// The three designs whose grooves overcut 10 mm past the top and bottom edge sit in the
// middle row, with 40 mm gaps above and below, so overcuts stay clear of other panels.
// Writes one combined sheet file plus one file per design.
// Usage: node scripts/test-sheet-dxf.js [output-folder]
const fs = require("fs");
const path = require("path");
const E = require("../public/js/engine.js");

const BOARD = { width: 1200, height: 1200 };
const GAP = 25;        // the tightest any two panels may be, overcuts included
const S = 360;         // panel size
const X = [35, 420, 805];  // 35 mm side borders, 25 mm gaps
const Y = [820, 420, 20];  // 20 mm top and bottom borders, 40 mm gaps (rows: top, middle, bottom)

// pos = bottom-left corner on the sheet, in mm. Numbered left to right, top row first.
const PLAN = [
  { design: "skinny",     pos: [X[0], Y[0]] },
  { design: "bevelled",   pos: [X[1], Y[0]] },
  { design: "beaded",     pos: [X[2], Y[0]] },
  { design: "tvgroove",   pos: [X[0], Y[1]] },
  { design: "tbgroove",   pos: [X[1], Y[1]] },
  { design: "reeded",     pos: [X[2], Y[1]] },
  { design: "newcountry", pos: [X[0], Y[2]] },
  { design: "georgian",   pos: [X[1], Y[2]] },
  { design: "fluted",     pos: [X[2], Y[2]] }
].map((p) => Object.assign({ width: S, height: S, opts: {} }, p));

const outDir = process.argv[2] || "test-sheet-dxf";
fs.mkdirSync(outDir, { recursive: true });

// Start from the design's normal defaults, then apply the test sizes.
const doors = PLAN.map((p) => {
  const d = E.designById(p.design);
  const defaults = {};
  for (const o of d.opts) defaults[o.key] = o.def;
  const door = { design: p.design, version: E.VERSION, width: p.width, height: p.height, opts: Object.assign(defaults, p.opts), hingeSide: "none", hingeCount: 0, name: d.name, qty: 1, pos: p.pos };
  E.buildDoor(door); // throws if the geometry doesn't fit
  return door;
});

// Check: nothing overlaps (with the gap) and everything is on the board, overcut included.
function bounds(door) {
  const g = E.buildDoor(door);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const path of g.paths) for (const [x, y] of path.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  // door y runs down; board y runs up from pos
  return { x0: door.pos[0] + x0, x1: door.pos[0] + x1, y0: door.pos[1] + (g.H - y1), y1: door.pos[1] + (g.H - y0) };
}
const boxes = doors.map(bounds);
boxes.forEach((b, i) => {
  if (b.x0 < 0 || b.y0 < 0 || b.x1 > BOARD.width || b.y1 > BOARD.height) throw new Error(`${doors[i].design} is off the board`);
  boxes.forEach((c, j) => {
    if (j <= i) return;
    const apart = b.x1 + GAP <= c.x0 + 1e-6 || c.x1 + GAP <= b.x0 + 1e-6 || b.y1 + GAP <= c.y0 + 1e-6 || c.y1 + GAP <= b.y0 + 1e-6;
    if (!apart) throw new Error(`${doors[i].design} and ${doors[j].design} are closer than ${GAP} mm`);
  });
});
const ext = { w: Math.max(...boxes.map((b) => b.x1)), h: Math.max(...boxes.map((b) => b.y1)) };

fs.writeFileSync(path.join(outDir, "00-test-sheet-9-panels.dxf"), E.orderDXF({ ref: "TEST-SHEET", doors }));

const rows = [
  "Pivot test sheet: nine panels in standard MDF",
  `Sheet ${BOARD.width} x ${BOARD.height} mm. Parts use ${ext.w} x ${ext.h} mm, ${GAP} mm apart. Origin (0, 0) is the sheet's bottom-left corner.`,
  "Panels use the standard settings for each design. Groove ends on Tongue & V, Tongue & bead and Reeded run 10 mm past the top and bottom edges.",
  "",
  "No | Design | Size (mm) | Position x, y (mm) | Test settings | Layers"
];
doors.forEach((door, i) => {
  const name = `${String(i + 1).padStart(2, "0")}-${door.design}-${door.width}x${door.height}.dxf`;
  fs.writeFileSync(path.join(outDir, name), E.orderDXF({ ref: "TEST-" + door.design.toUpperCase(), doors: [Object.assign({}, door, { pos: [0, 0] })] }));
  const settings = Object.entries(door.opts).map(([k, v]) => `${k} ${v}`).join(", ") || "standard";
  rows.push(`${i + 1} | ${E.designById(door.design).name} | ${door.width} x ${door.height} | ${door.pos.join(", ")} | ${settings} | ${E.layerList([door]).map((l) => l.layer).join(", ")}`);
});
rows.push("", "Layers", ...E.layerList(doors).map((l) => `${l.layer}: ${l.label}`));
fs.writeFileSync(path.join(outDir, "README.txt"), rows.join("\r\n") + "\r\n");
console.log(rows.join("\n"));
