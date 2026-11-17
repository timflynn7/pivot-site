// Test-cut DXFs sized for an offcut board: one file per design, plus combined
// boards with as many designs as fit. Every file stays inside BOARD.
// Usage: node scripts/test-board-dxf.js [output-folder]
const fs = require("fs");
const path = require("path");
const E = require("../public/js/engine.js");

const BOARD = { width: 1220, height: 500 };
const DOOR = { width: 340, height: 480 };
// Designs whose toolpaths still need working out. The rest are settled.
const DESIGNS = ["bevelled", "beaded", "flutedshaker", "mouldedflute", "victorian", "georgian", "archtop", "ringpanel"];

const outDir = process.argv[2] || "test-board-dxf";
fs.mkdirSync(outDir, { recursive: true });

// Every part, overcut included, must sit within the board.
function extents(doors, sheetWidth) {
  const dxf = E.orderDXF({ ref: "X", doors, sheetWidth });
  const xs = [], ys = [];
  const lines = dxf.split("\r\n");
  for (let i = 0; i < lines.length - 1; i += 2) {
    if (lines[i] === "10") xs.push(Number(lines[i + 1]));
    if (lines[i] === "20") ys.push(Number(lines[i + 1]));
  }
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}
function check(doors, label) {
  const e = extents(doors, BOARD.width);
  if (e.w > BOARD.width + 1e-6 || e.h > BOARD.height + 1e-6) throw new Error(`${label} is ${e.w} x ${e.h} mm, bigger than the board`);
  return e;
}

const doors = DESIGNS.map((id) => {
  const d = E.designById(id);
  const { door, errors } = E.normalizeDoor({ design: id, width: DOOR.width, height: DOOR.height, hingeSide: "none", name: d.name });
  if (Object.keys(errors).length) throw new Error(id + ": " + JSON.stringify(errors));
  return door;
});

const rows = ["Pivot test-cut DXFs", `Board: ${BOARD.width} x ${BOARD.height} mm. Doors: ${DOOR.width} x ${DOOR.height} mm, no hinge holes.`, "", "File | Design | Project size (mm) | Layers"];
doors.forEach((door, i) => {
  const name = `${String(i + 1).padStart(2, "0")}-${door.design}-${door.width}x${door.height}.dxf`;
  const e = check([door], name);
  fs.writeFileSync(path.join(outDir, name), E.orderDXF({ ref: "TEST-" + door.design.toUpperCase(), doors: [door], sheetWidth: BOARD.width }));
  rows.push(`${name} | ${E.designById(door.design).name} | ${Math.round(e.w)} x ${Math.round(e.h)} | ${E.layerList([door]).map((l) => l.layer).join(", ")}`);
});

// Combined boards: fill each board left to right with as many doors as fit.
rows.push("", "Combined boards");
let board = [], n = 0;
const flush = () => {
  if (!board.length) return;
  n++;
  const name = `board-${String.fromCharCode(64 + n)}.dxf`;
  const e = check(board, name);
  fs.writeFileSync(path.join(outDir, name), E.orderDXF({ ref: "TEST-BOARD-" + String.fromCharCode(64 + n), doors: board, sheetWidth: BOARD.width }));
  rows.push(`${name} | ${board.map((d) => E.designById(d.design).name).join(", ")} | ${Math.round(e.w)} x ${Math.round(e.h)}`);
  board = [];
};
for (const door of doors) {
  const next = board.concat([door]);
  const e = extents(next, BOARD.width);
  if (board.length && (e.w > BOARD.width || e.h > BOARD.height)) { flush(); board = [door]; } else board = next;
}
flush();

rows.push("", "Layers", ...E.layerList(doors).map((l) => `${l.layer}: ${l.label}`));
fs.writeFileSync(path.join(outDir, "README.txt"), rows.join("\r\n") + "\r\n");
console.log(rows.join("\n"));
