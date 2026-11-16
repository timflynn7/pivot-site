// Writes a sample order DXF covering every design, for testing imports in VCarve.
// Usage: node scripts/sample-dxf.js [output.dxf]
const fs = require("fs");
const E = require("../public/js/engine.js");

const raw = [
  { design: "slab", width: 400, height: 700, opts: { corners: "round" }, hingeSide: "left", name: "Slab test" },
  { design: "shaker", width: 500, height: 1100, opts: { border: 70, rails: 1 }, hingeSide: "right", hingeCount: 3, name: "Larder" },
  { design: "skinny", width: 450, height: 600, hingeSide: "left", name: "Skinny test" },
  { design: "flutedshaker", width: 500, height: 720, opts: { border: 70, spacing: 20 }, hingeSide: "left", name: "Fluted shaker test" },
  { design: "fluted", width: 450, height: 600, opts: { margin: 40, spacing: 22 }, name: "Fluted test", qty: 2 },
  { design: "reeded", width: 400, height: 900, opts: { spacing: 17 }, name: "Reeded test" },
  { design: "tvgroove", width: 600, height: 720, opts: { spacing: 100 }, name: "T and V test" },
  { design: "lattice", width: 400, height: 700, name: "Lattice test" }
];
const doors = raw.map((r) => {
  const { door, errors } = E.normalizeDoor(r);
  if (Object.keys(errors).length) throw new Error(r.design + ": " + JSON.stringify(errors));
  return door;
});
const out = process.argv[2] || "sample-order.dxf";
fs.writeFileSync(out, E.orderDXF({ ref: "PD-SAMPLE", doors }));
console.log("Wrote " + out);
console.table(E.layerList(doors));
