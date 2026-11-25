// Writes the cutting geometry of chosen doors as JSON, for scripts/render_designs.py.
// Usage: node scripts/render-geometry.js > /tmp/doors.json
const E = require("../public/js/engine.js");
const DOORS = [
  { design: "slab", width: 450, height: 720, colour: "#E7E2D6", name: "warm white" },
  { design: "shaker", width: 500, height: 720, colour: "#9AA78F", name: "sage green" },
  { design: "skinny", width: 450, height: 720, colour: "#2F3B4C", name: "navy" },
  { design: "bevelled", width: 500, height: 720, colour: "#CBC3B3", name: "stone" },
  { design: "beaded", width: 500, height: 720, colour: "#3F5A4A", name: "deep green" },
  { design: "newcountry", width: 500, height: 720, opts: { fit: "exact", spacing: 80 }, colour: "#E4DAC3", name: "cream" },
  { design: "georgian", width: 500, height: 720, colour: "#A8A398", name: "putty grey" },
  { design: "tvgroove", width: 600, height: 720, colour: "#8D9AA3", name: "blue grey" }
];
const out = DOORS.map((d) => {
  const { door, errors } = E.normalizeDoor({ design: d.design, width: d.width, height: d.height, opts: d.opts || {} });
  if (Object.keys(errors).length) throw new Error(d.design + ": " + JSON.stringify(errors));
  const g = E.buildDoor(door);
  return { id: d.design, title: E.designById(d.design).name, colour: d.colour, colourName: d.name, W: g.W, H: g.H,
    paths: g.paths.filter((p) => !E.TOOLS[p.tool].ref).map((p) => ({ tool: p.tool, pts: p.pts, closed: !!p.closed, inner: p.inner || null, width: E.TOOLS[p.tool].width, depth: E.TOOLS[p.tool].depth || null })) };
});
process.stdout.write(JSON.stringify(out));
