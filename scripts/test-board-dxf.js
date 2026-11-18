// Test-cut DXFs for one offcut board: every design still being worked out,
// at small sizes, placed by hand to fit BOARD. Detail sizes (mouldings, beads,
// flutes) stay real; only door sizes and frame widths shrink.
// Writes one combined board file plus one file per design.
// Usage: node scripts/test-board-dxf.js [output-folder] [plan: all | beads]
const fs = require("fs");
const path = require("path");
const E = require("../public/js/engine.js");

const BOARD = { width: 1220, height: 500 };
const GAP = 20;

// pos = bottom-left corner on the board, in mm.
// "all": every draft design. Rows: top 255-490, bottom 0-235.
// "beads": the two beaded shakers, with corner-rail leg lengths and bead heights to compare.
const PLANS = {
  all: [
    { design: "ringpanel",    width: 260, height: 490, pos: [0, 0],     opts: { frame: 40 } },
    { design: "bevelled",     width: 200, height: 235, pos: [280, 255], opts: { border: 50 } },
    { design: "beaded",       width: 200, height: 235, pos: [500, 255], opts: { border: 50 } },
    { design: "flutedshaker", width: 220, height: 235, pos: [720, 255], opts: { border: 50, spacing: 20 } },
    { design: "archtop",      width: 220, height: 235, pos: [960, 255], opts: {} },
    { design: "georgian",     width: 240, height: 235, pos: [280, 0],   opts: { outer: 55, inner: 75 } },
    { design: "victorian",    width: 260, height: 235, pos: [540, 0],   opts: { border: 50, inset: 20 } },
    { design: "mouldedflute", width: 280, height: 235, pos: [820, 0],   opts: { border: 45, step: 22, spacing: 12 } }
  ],
  beads: [
    { design: "beaded",     width: 200, height: 235, pos: [0, 255],   opts: { border: 50, leg: 3 } },
    { design: "beaded",     width: 200, height: 235, pos: [220, 255], opts: { border: 50, leg: 5 } },
    { design: "beaded",     width: 200, height: 235, pos: [440, 255], opts: { border: 50, leg: 10 } },
    { design: "singlebead", width: 200, height: 235, pos: [0, 0],     opts: { border: 50, top: 0 } },
    { design: "singlebead", width: 200, height: 235, pos: [220, 0],   opts: { border: 50, top: 1 } },
    { design: "singlebead", width: 200, height: 235, pos: [440, 0],   opts: { border: 50, top: 1.65 } }
  ]
};
const planName = process.argv[3] || "all";
const PLAN = PLANS[planName];
if (!PLAN) throw new Error(`Unknown plan "${planName}". Use one of: ${Object.keys(PLANS).join(", ")}`);

const outDir = process.argv[2] || "test-board-dxf";
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

fs.writeFileSync(path.join(outDir, planName === "all" ? "00-test-board-all-designs.dxf" : `00-test-board-${planName}.dxf`), E.orderDXF({ ref: "TEST-BOARD", doors }));

const rows = [
  "Pivot test board",
  `Board ${BOARD.width} x ${BOARD.height} mm. Parts use ${ext.w} x ${ext.h} mm, ${GAP} mm apart. Origin is the board's bottom-left corner.`,
  "Door sizes and frame widths are reduced for testing. Moulding, bead, flute and V-bit sizes are full size.",
  "",
  "No | Design | Size (mm) | Position x, y (mm) | Test settings | Layers"
];
doors.forEach((door, i) => {
  const name = `${String(i + 1).padStart(2, "0")}-${door.design}-${door.width}x${door.height}${planName === "all" ? "" : "-" + Object.entries(door.opts).filter(([k]) => k !== "border").map(([k, v]) => k + v).join("-")}.dxf`;
  fs.writeFileSync(path.join(outDir, name), E.orderDXF({ ref: "TEST-" + door.design.toUpperCase(), doors: [Object.assign({}, door, { pos: [0, 0] })] }));
  const settings = Object.entries(door.opts).map(([k, v]) => `${k} ${v}`).join(", ") || "standard";
  rows.push(`${i + 1} | ${E.designById(door.design).name} | ${door.width} x ${door.height} | ${door.pos.join(", ")} | ${settings} | ${E.layerList([door]).map((l) => l.layer).join(", ")}`);
});
rows.push("", "Layers", ...E.layerList(doors).map((l) => `${l.layer}: ${l.label}`));
fs.writeFileSync(path.join(outDir, "README.txt"), rows.join("\r\n") + "\r\n");
console.log(rows.join("\n"));
