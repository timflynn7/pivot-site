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
// "beads": the two beaded shakers. Beaded: corner legs 3, 5, 10 mm (6 mm pocket), then the
// pocket level with the groove floor and at 8 mm, and the round-over 5 deep instead of 4.7.
// Single bead: bead top 0 and 1 mm below the face (6 mm pocket), then 1 mm with the pocket
// level with the bead's foot and at 8 mm. Also writes the round-over bit's shape for
// VCarve's tool database.
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
    { design: "beaded",     width: 200, height: 235, pos: [660, 255], opts: { border: 50, leg: 5, pocket: "level" } },
    { design: "beaded",     width: 200, height: 235, pos: [880, 255], opts: { border: 50, leg: 5, pocket: 8 } },
    { design: "singlebead", width: 200, height: 235, pos: [0, 0],     opts: { border: 50, top: 0 } },
    { design: "singlebead", width: 200, height: 235, pos: [220, 0],   opts: { border: 50, top: 1 } },
    { design: "singlebead", width: 200, height: 235, pos: [440, 0],   opts: { border: 50, top: 1, pocket: "level" } },
    { design: "singlebead", width: 200, height: 235, pos: [660, 0],   opts: { border: 50, top: 1, pocket: 8 } },
    { design: "beaded",     width: 200, height: 235, pos: [880, 0],   opts: { border: 50, leg: 5, depth: 5 } }
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

if (planName === "beads") {
  // Right-hand half of the round-over bit, drawn to scale (tip at 0,0, y up), so it can be
  // selected in VCarve and made into a Form Tool in the tool database.
  const pts = E.roundoverToolShape();
  const L = "FORM_TOOL_SHAPE";
  const out = ["0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1009", "0", "ENDSEC",
    "0", "SECTION", "2", "TABLES", "0", "TABLE", "2", "LAYER", "70", "1", "0", "LAYER", "2", L, "70", "0", "62", "4", "6", "CONTINUOUS", "0", "ENDTAB", "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES", "0", "POLYLINE", "8", L, "66", "1", "10", "0.0", "20", "0.0", "30", "0.0", "70", "0"];
  for (const [x, y] of pts) out.push("0", "VERTEX", "8", L, "10", x.toFixed(4), "20", y.toFixed(4), "30", "0.0");
  out.push("0", "SEQEND", "8", L, "0", "ENDSEC", "0", "EOF");
  fs.writeFileSync(path.join(outDir, "form-tool-roundover-12.7-R4.7.dxf"), out.join("\r\n") + "\r\n");
  rows.push("", `form-tool-roundover-12.7-R4.7.dxf: right-hand half of the round-over bit (${E.ROUNDOVER.dia} mm across, ${E.ROUNDOVER.radius} mm radius, flat tip ${(E.ROUNDOVER.dia - 2 * E.ROUNDOVER.radius).toFixed(1)} mm across), to scale. Select it in VCarve, then Tool Database > new tool > type Form Tool.`);
}
fs.writeFileSync(path.join(outDir, "README.txt"), rows.join("\r\n") + "\r\n");
console.log(rows.join("\n"));
