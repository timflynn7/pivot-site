// Writes test DXFs for every design: one file per design plus one file with all of them.
// Usage: node scripts/sample-dxf.js [output-folder]
const fs = require("fs");
const path = require("path");
const E = require("../public/js/engine.js");

// Test sizes: a typical wall-unit door, taller where the design needs it.
const SIZES = { archtop: [500, 1100], ringpanel: [450, 900], shaker: [450, 1100] };
const EXTRA = { shaker: { rails: 1 }, slab: { corners: "round" } };

const outDir = process.argv[2] || "test-dxf";
fs.mkdirSync(outDir, { recursive: true });

const all = [];
E.DESIGNS.forEach((d, i) => {
  const [width, height] = SIZES[d.id] || [450, 700];
  const { door, errors } = E.normalizeDoor({ design: d.id, width, height, opts: EXTRA[d.id] || {}, hingeSide: "left", name: d.name });
  if (Object.keys(errors).length) throw new Error(d.id + ": " + JSON.stringify(errors));
  all.push(door);
  const file = path.join(outDir, `${String(i + 1).padStart(2, "0")}-${d.id}-${width}x${height}.dxf`);
  fs.writeFileSync(file, E.orderDXF({ ref: "TEST-" + d.id.toUpperCase(), doors: [door] }));
});
fs.writeFileSync(path.join(outDir, "00-all-designs.dxf"), E.orderDXF({ ref: "TEST-ALL", doors: all }));

const lines = ["Pivot test DXFs", "", "File | Design | Size | Settings | Layers"];
E.DESIGNS.forEach((d, i) => {
  const door = all[i];
  lines.push(`${String(i + 1).padStart(2, "0")} | ${d.name} | ${door.width} x ${door.height} mm | ${E.describe(door)} | ${E.layerList([door]).map((l) => l.layer).join(", ")}`);
});
lines.push("", "Layers", ...E.layerList(all).map((l) => `${l.layer}: ${l.label}`));
fs.writeFileSync(path.join(outDir, "README.txt"), lines.join("\r\n") + "\r\n");
console.log(`Wrote ${E.DESIGNS.length + 1} DXFs to ${outDir}`);
