// Round-over calibration strip: measures what the round-over bit really cuts, so the
// engine's model of the bit (ROUNDOVER in engine.js) and VCarve's form tool can be
// built from measurements instead of assumptions.
//
// Top row: a depth ladder. Single grooves, 2D Profile ON the line, each on its own layer
//   (ROUNDOVER_FORM12_D3_5 ... D6_5). Saw across at the SAW line and measure each groove.
// Bottom row: a spacing ladder. Pairs of grooves at the bead depth (4.7) with the lines
//   10.0 to 12.7 mm apart, all on ROUNDOVER_FORM12_D4_7. Shows which spacing gives a
//   round bead with no flat on top at this depth.
// Usage: node scripts/calibration-dxf.js [output-folder]
const fs = require("fs");
const path = require("path");

const outDir = process.argv[2] || "calibration-dxf";
fs.mkdirSync(outDir, { recursive: true });

const STRIP = { w: 300, h: 200 };
const DEPTHS = [3.5, 4, 4.5, 4.7, 5, 5.5, 6, 6.5];
const SPACINGS = [10, 10.5, 11, 11.5, 12, 12.7];
const BEAD_DEPTH = 4.7;
const tag = (v) => String(v).replace(".", "_");

const ents = [];
const layers = new Map([["CUTOUT_EM6", 7], ["LABELS", 2], ["SAW_LINE_NOT_CUT", 1]]);
const n = (v) => (Math.round(v * 1000) / 1000).toFixed(3);
function poly(layer, pts, closed, color) {
  if (!layers.has(layer)) layers.set(layer, color || 4);
  ents.push("0", "POLYLINE", "8", layer, "66", "1", "10", "0.0", "20", "0.0", "30", "0.0", "70", closed ? "1" : "0");
  for (const [x, y] of pts) ents.push("0", "VERTEX", "8", layer, "10", n(x), "20", n(y), "30", "0.0");
  ents.push("0", "SEQEND", "8", layer);
}
function text(s, x, y, h) {
  ents.push("0", "TEXT", "8", "LABELS", "10", n(x), "20", n(y), "30", "0.0", "40", n(h), "1", s);
}

poly("CUTOUT_EM6", [[0, 0], [STRIP.w, 0], [STRIP.w, STRIP.h], [0, STRIP.h]], true, 7);

// Depth ladder: grooves run up and down, y 115-185, 30 mm apart.
const rows = ["Round-over calibration strip", "", "Depth ladder (top row): one groove per depth, 2D Profile ON the line.", ""];
DEPTHS.forEach((d, i) => {
  const x = 25 + i * 34;
  poly(`ROUNDOVER_FORM12_D${tag(d)}`, [[x, 115], [x, 185]], false, 4);
  text(`${d}`, x - 3, 106, 4);
});
text("DEPTH LADDER - SAW ALONG THE RED LINE", 20, 190, 4);
poly("SAW_LINE_NOT_CUT", [[5, 150], [STRIP.w - 5, 150]], false, 1);

// Spacing ladder: pairs at BEAD_DEPTH, y 20-90.
let x = 22;
SPACINGS.forEach((s) => {
  poly(`ROUNDOVER_FORM12_D${tag(BEAD_DEPTH)}`, [[x, 20], [x, 90]], false, 4);
  poly(`ROUNDOVER_FORM12_D${tag(BEAD_DEPTH)}`, [[x + s, 20], [x + s, 90]], false, 4);
  text(`${s}`, x, 11, 4);
  x += s + 33;
});
text(`SPACING LADDER AT ${BEAD_DEPTH} DEEP - SAW ALONG THE RED LINE`, 20, 95, 4);
poly("SAW_LINE_NOT_CUT", [[5, 55], [STRIP.w - 5, 55]], false, 1);
if (x - 33 > STRIP.w - 10) throw new Error("Spacing ladder runs off the strip");

const out = ["0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1009", "0", "ENDSEC",
  "0", "SECTION", "2", "TABLES", "0", "TABLE", "2", "LAYER", "70", String(layers.size)];
for (const [l, c] of layers) out.push("0", "LAYER", "2", l, "70", "0", "62", String(c), "6", "CONTINUOUS");
out.push("0", "ENDTAB", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES");
fs.writeFileSync(path.join(outDir, "roundover-calibration-300x200.dxf"), out.concat(ents, ["0", "ENDSEC", "0", "EOF"]).join("\r\n") + "\r\n");

rows.push(
  `Strip ${STRIP.w} x ${STRIP.h} mm of 18 mm MDF. Origin bottom-left.`,
  "",
  "Toolpaths (round-over form tool, 2D Profile, ON the line, Start Depth 0):",
  ...DEPTHS.map((d) => `  ROUNDOVER_FORM12_D${tag(d)}: Cut Depth ${d}`),
  `  The spacing ladder is also on ROUNDOVER_FORM12_D${tag(BEAD_DEPTH)}.`,
  "  CUTOUT_EM6: cut the strip out. SAW_LINE_NOT_CUT and LABELS: do not cut.",
  "",
  "Before cutting: zero Z on the strip itself, next to the grooves. Measure the MDF thickness at a few points.",
  "",
  "After cutting:",
  "1. Measure each groove's real depth (caliper depth rod) before sawing. Write it next to the programmed depth.",
  "2. Saw the strip across along both red lines, square and clean.",
  "3. Sand the sawn faces lightly (fine paper on a flat block) so the edges of the grooves are crisp.",
  "4. Lay the sawn faces on a flatbed scanner with a steel rule beside them and scan at 600 dpi or more.",
  "   (Or photograph straight down from about 50 cm, phone zoomed in, the rule in the same plane as the cut face.)",
  "5. For each depth ladder groove, measure: width at the face, width of the flat at the bottom, depth.",
  "6. For the spacing ladder, note which pair gives a round bead with no flat on top, and whether the top reaches the face.",
  "7. Measure the bit with calipers: the widest diameter across the cutting edges, the cutting height, the width of the tip.",
  "Send the scans/photos and the numbers to Claude. The engine's bit model and the VCarve form tool are then rebuilt from them."
);
fs.writeFileSync(path.join(outDir, "README.txt"), rows.join("\r\n") + "\r\n");
console.log(rows.join("\n"));
