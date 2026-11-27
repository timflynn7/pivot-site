// Experiment board for a 360 x 360 mm piece of 18 mm MDF (the uncut fluted
// blank at the bottom right of the 1200 x 1200 test sheet, Nov 2026).
// It tests the findings from the 25 Nov 2026 test cut before any change is
// made to the website's door engine. It does NOT use or change engine.js.
//
// 14 tests in a 4 x 4 grid of 77 mm cells, 10 mm apart, 10 mm in from the
// board edge (two cells spare). Every layer starts with its test number, so
// each test can get its own toolpath. Depths in layer names: D2_5 = 2.5 mm.
// FLOOR = measured down from that test's pocket floor, not from the face.
// Origin: the board's bottom-left corner, x right, y up.
//
// Usage: node scripts/test-cut-360.js [output-folder]
const fs = require("fs");
const path = require("path");

const BOARD = 360, CELL = 77, PITCH = 87, EDGE = 10;
const LABEL_H = 3;

const ents = [];
const layers = new Map(); // name -> colour
const n3 = (v) => (Math.round(v * 1000) / 1000).toFixed(3);
function poly(layer, pts, closed, color) {
  if (!layers.has(layer)) layers.set(layer, color || 7);
  ents.push("0", "POLYLINE", "8", layer, "66", "1", "10", "0.0", "20", "0.0", "30", "0.0", "70", closed ? "1" : "0");
  for (const [x, y] of pts) ents.push("0", "VERTEX", "8", layer, "10", n3(x), "20", n3(y), "30", "0.0");
  ents.push("0", "SEQEND", "8", layer);
}
function text(str, x, y, h) {
  if (!layers.has("LABELS")) layers.set("LABELS", 2);
  ents.push("0", "TEXT", "8", "LABELS", "10", n3(x), "20", n3(y), "30", "0.0", "40", n3(h || LABEL_H), "1", str);
}
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const box = (L, x0, y0, x1, y1, c) => poly(L, rect(x0, y0, x1, y1), true, c);
const line = (L, a, b, c) => poly(L, [a, b], false, c);
const dName = (d) => "D" + String(d).replace(".", "_");

// Cell origin (bottom-left). row 0 is the top row, as you look at the board.
const cell = (row, col) => [EDGE + col * PITCH, EDGE + (3 - row) * PITCH];

const C = { pocket: 5, vgroove: 1, bevel: 6, reed: 4, slot: 3, round: 30, cut: 7, face: 8, ref: 9 };
const notes = [];
function test(no, row, col, title, how, draw) {
  const [x, y] = cell(row, col);
  const id = "T" + String(no).padStart(2, "0");
  text(`${id} ${title.toUpperCase()}`, x + 2, y + 2);
  draw(id, x, y);
  notes.push({ id, title, how, at: `cell x ${x}-${x + CELL}, y ${y}-${y + CELL}` });
}

// ---------- row 1: corners and bit calibration ----------
const cornerPocket = (id, x, y) => box(`${id}_POCKET_D8`, x + 11, y + 14, x + 66, y + 69, C.pocket);
test(1, 0, 0, "corner 1/8in", "55 x 55 mm pocket, 8 mm deep. Cut it all with the 1/8 in downcut, as on the Georgian. Measure the corners.", cornerPocket);
test(2, 0, 1, "corner 2mm", "The same pocket. Cut it all with the 2 mm straight bit.", cornerPocket);
test(3, 0, 2, "corner 6+2mm", "The same pocket. VCarve Pocket toolpath with 'Use larger clearance tool': 6 mm bit clears, 2 mm bit does the edges and corners.", cornerPocket);
test(4, 0, 3, "slots", "Four 55 mm slots, 3 mm deep, one pass each. A = 1/8 in downcut, B = 2 mm straight, C = 6 mm, D = 90 degree V-bit. Measure each slot's width with calipers and put it in the tool library. The V slot should be exactly 6.0 mm wide at 3 mm deep; if not, the angle, tip or Z zero is off.", (id, x, y) => {
  ["A", "B", "C", "D"].forEach((k, i) => line(`${id}_SLOT_${k}_D3`, [x + 11, y + 62 - i * 14], [x + 66, y + 62 - i * 14], C.slot));
});

// ---------- row 2: bevel, beaded lip, V ladder on the face ----------
function bevel(d) {
  return (id, x, y) => {
    const o = [x + 11, y + 14, x + 66, y + 69];
    box(`${id}_BEVEL_${dName(d)}`, ...o, C.bevel);
    box(`${id}_POCKET_${dName(d)}`, o[0] + d, o[1] + d, o[2] - d, o[3] - d, C.pocket);
  };
}
test(5, 1, 0, "bevel 4mm", "Bevelled shaker at half depth: bevel line (top of the bevel) and a pocket 4 mm inside it, 4 mm deep. V-bit along the bevel line, profile inside, 2 mm passes.", bevel(4));
test(6, 1, 1, "bevel 8mm", "Bevelled shaker as the website draws it: pocket 8 mm inside the bevel line, 8 mm deep. V-bit in 2-3 mm passes. Compare with T05, measuring each bevel's width on a straight side (should equal its depth) and the corner overshoot: if both errors double from T05 to T06, the V-bit's angle in the library is off; if they stay the same, it's Z depth.", bevel(8));
test(7, 1, 2, "beaded lip", "Beaded shaker: 45 x 45 mm pocket 8 mm deep with the round-over rail on the same line. Try the moulding profile overlapping the line by 0.2-0.3 mm and 0.1 mm below the floor, OR a 2 mm tidy-up profile on the line at 8 mm with a -0.2 mm allowance. Note which.", (id, x, y) => {
  box(`${id}_POCKET_D8`, x + 16, y + 19, x + 61, y + 64, C.pocket);
  box(`${id}_ROUNDOVER`, x + 16, y + 19, x + 61, y + 64, C.round);
});
test(8, 1, 3, "v ladder face", "Tongue & V depth ladder on the face: 90 degree V-grooves 1.5, 2, 2.5 and 3 mm deep (3, 4, 5, 6 mm wide), left to right.", (id, x, y) => {
  [1.5, 2, 2.5, 3].forEach((d, i) => line(`${id}_VGROOVE_${dName(d)}`, [x + 14 + i * 16, y + 10], [x + 14 + i * 16, y + 71], C.vgroove));
});

// ---------- row 3: New Country ----------
const ncPocket = [9, 10, 68, 69]; // inside the cell
test(9, 2, 0, "nc 8mm ladder", "New Country, 8 mm pocket (59 x 59). Four V-grooves running right up to the wall, 1.5, 2, 2.5, 3 mm below the floor (start depth 8 in VCarve). Shows the notch in the frame wall at each depth.", (id, x, y) => {
  const [a, b, c, d] = ncPocket.map((v, i) => v + (i % 2 ? y : x));
  box(`${id}_POCKET_D8`, a, b, c, d, C.pocket);
  [1.5, 2, 2.5, 3].forEach((g, i) => { const gx = a + ((c - a) * (i + 1)) / 5; line(`${id}_VGROOVE_FLOOR_${dName(g)}`, [gx, b], [gx, d], C.vgroove); });
});
test(10, 2, 1, "nc 6mm stops", "New Country, 6 mm pocket. Three V-grooves 2 mm below the floor (start depth 6). Left: run to the wall. Middle: stop 3.2 mm short (the radius of a 1/4 in bit). Right: stop 6.4 mm short (1/2 in bit). Cut with the V-bit you'd use for real and see which ends look right.", (id, x, y) => {
  const [a, b, c, d] = ncPocket.map((v, i) => v + (i % 2 ? y : x));
  box(`${id}_POCKET_D6`, a, b, c, d, C.pocket);
  [0, 3.2, 6.4].forEach((s, i) => { const gx = a + ((c - a) * (i + 1)) / 4; line(`${id}_VGROOVE_FLOOR_D2`, [gx, b + s], [gx, d - s], C.vgroove); });
});
test(11, 2, 2, "nc 5mm", "New Country, 5 mm pocket. Three V-grooves 2 mm below the floor (start depth 5), running to the wall. Compare the look with T09 (8 mm) and T10 (6 mm).", (id, x, y) => {
  const [a, b, c, d] = ncPocket.map((v, i) => v + (i % 2 ? y : x));
  box(`${id}_POCKET_D5`, a, b, c, d, C.pocket);
  [1, 2, 3].forEach((k) => { const gx = a + ((c - a) * k) / 4; line(`${id}_VGROOVE_FLOOR_D2`, [gx, b], [gx, d], C.vgroove); });
});
test(12, 2, 3, "reed depth", "Reed bit depth ladder: three grooves 4, 4.5 and 5 mm deep, left to right. Find where the shoulder starts to touch. Try 2-stage passes on the 5 mm one.", (id, x, y) => {
  [4, 4.5, 5].forEach((d, i) => line(`${id}_REED_${dName(d)}`, [x + 18.5 + i * 20, y + 10], [x + 18.5 + i * 20, y + 71], C.reed));
});

// ---------- row 4: tongue & bead, reeded edge ----------
test(13, 3, 0, "t&b 12.5", "Tongue & bead as proposed: V-groove (2 mm, change to the depth T08 picks) with the bead line 12.5 mm to its right, cut with the reed bit at 5 mm (or the depth T12 picks). Two pairs.", (id, x, y) => {
  for (const vx of [x + 12, x + 42]) {
    line(`${id}_VGROOVE_D2`, [vx, y + 10], [vx, y + 71], C.vgroove);
    line(`${id}_REED_D5`, [vx + 12.5, y + 10], [vx + 12.5, y + 71], C.reed);
  }
});
test(14, 3, 1, "reeded edge", "Reeded with the lines carried past both side edges (12.5 mm apart, centred, plus one more each side while the 12.7 mm bit still touches the panel). Order: 1 facing pass 0.5 mm over the FACING box, 2 reeds at 4 mm (or T12's depth), 3 cut out the 55 x 55 panel on CUTOUT with tabs, or saw it out, to see the edge reeds.", (id, x, y) => {
  const W = 55, px = x + 11, py = y + 16, py1 = py + W, pitch = 12.5, tw = 12.7;
  box(`${id}_FACING_D0_5`, px - 3, py - 3, px + W + 3, py1 + 3, C.face);
  const n = Math.floor(W / pitch + 1e-9), start = W / 2 - ((n - 1) * pitch) / 2;
  const xs = [];
  for (let k = -5; k < n + 5; k++) { const c = start + k * pitch; if (c > -tw / 2 && c < W + tw / 2) xs.push(c); }
  for (const c of xs) line(`${id}_REED_D4`, [px + c, py - 10], [px + c, py1 + 10], C.reed);
  box(`${id}_CUTOUT`, px, py, px + W, py1, C.cut);
});
test(15, 3, 2, "spare", "Spare for a re-test.", () => {});
test(16, 3, 3, "spare", "Spare for a re-test (e.g. fluted, once the bit and spacing are confirmed).", () => {});

// Board edge for reference only: do not cut.
box("BOARD_EDGE_NOCUT", 0, 0, BOARD, BOARD, C.ref);

// ---------- write ----------
const out = ["0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1009", "0", "ENDSEC",
  "0", "SECTION", "2", "TABLES",
  "0", "TABLE", "2", "LTYPE", "70", "1", "0", "LTYPE", "2", "CONTINUOUS", "70", "0", "3", "Solid line", "72", "65", "73", "0", "40", "0.0", "0", "ENDTAB",
  "0", "TABLE", "2", "LAYER", "70", String(layers.size)];
for (const [l, c] of layers) out.push("0", "LAYER", "2", l, "70", "0", "62", String(c), "6", "CONTINUOUS");
out.push("0", "ENDTAB", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES");
const dxf = out.concat(ents, ["0", "ENDSEC", "0", "EOF"]).join("\r\n") + "\r\n";

const dir = process.argv[2] || "test-cut-360";
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "test-cut-360x360.dxf"), dxf);
const readme = [
  "Pivot experiment board, 360 x 360 mm, 18 mm MDF (standard, not MR)",
  "Origin (X0 Y0): the board's bottom-left corner. Z zero: the top of the board.",
  "If the board is still part of the 1200 x 1200 sheet, either zero on its bottom-left corner,",
  "or in VCarve select everything and move it so BOARD_EDGE_NOCUT sits over the uncut square.",
  "Layer names: T01.. = test number. D2_5 = 2.5 mm deep. FLOOR = below that test's pocket floor",
  "(VCarve: start depth = the pocket depth, cut depth = the figure). Pass depths are up to you.",
  "Cut pockets before the V-grooves that sit in them. Do not cut LABELS or BOARD_EDGE_NOCUT.",
  "",
  ...notes.map((t) => `${t.id} ${t.title} (${t.at}): ${t.how}`),
  "",
  "Write down for each test: bit, depth, passes, and what you measured or saw."
];
fs.writeFileSync(path.join(dir, "README.txt"), readme.join("\r\n") + "\r\n");
console.log(readme.join("\n"));
console.log("\nLayers:", [...layers.keys()].join(", "));
