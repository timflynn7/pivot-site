# Workstream 3a: Toolpath lab (moulding toolpath and round-over bits)

A focused side-project of the designs workstream (designs.md). It works out, in VCarve, which toolpath, bit and settings give the effects Tim wants, and which vectors the DXF must contain for them. **When a combination is proven on a test cut, move it into designs.md and the engine recipe, and mark it done here.**

## The question
How to get the moulding toolpath to work correctly with Tim's round-over bits, and what the DXF must give VCarve so the toolpath works with minimal editing.

## Designs affected
| Design | What's in the DXF now (draft) | Effect wanted |
| --- | --- | --- |
| Moulded frame, fluted | `MOULD_TBN_RAIL` rectangle 75 mm in from the edge; pocket 22 mm further in; 8 mm flutes | A moulded frame round a fluted centre (Tim's white door photo) |
| Victorian | 8 mm pocket at a 70 mm border, plus a `MOULD_TBN_RAIL` rectangle 20 mm inside the panel | A decorative moulding inside the panel |
| Ring and arc panel | Two shaped pockets, with `MOULD_TBN_RAIL` on their edges and a centre ring | Moulded edges on the arcs and the centre ring (Tim's photo) |
| Beaded shaker | 8 mm pocket, plus a bead line 6 mm out on `BEAD_FORM6_D3` | A bead round the inside of the frame |
| Arch-top beaded door | Three beads on `REED_FORM13_D4`, at 30, 55 and 80 mm in | Three rounded beads following the arched outline |

## Things to establish (fill in as they're found)
- **Tim's VCarve version** (affects which moulding options exist): **VCarve Pro 12** (has the Moulding toolpath, and Form Tool entries in the tool database).
- **Round-over bits:** **CNC style, no bearing** (can plunge into the face). In VCarve as **Form Tool 1/2 (12.7 mm)**, tool no. 54: 12.7 mm diameter, profile is two quarter-round arcs meeting at a point (so about 6.35 mm radius), 2 flutes, pass depth 3.175, stepover 2.54 (20%), 20000 rpm, feed 5000, plunge 800 mm/min.
- **Each effect wanted:** a photo or sketch of the cross-section, with the profile width and depth: _
- **The route for each design:** VCarve's Moulding toolpath (a profile swept along a drive rail and cut with raster passes, usually with a ball nose or tapered ball nose), **or** a 2D Profile toolpath with the round-over defined as a form tool in the tool database (the bit cuts its own shape in one pass). These are two different approaches. Which suits each design is the first thing to settle. _
- **Vectors VCarve needs:** a drive rail only, or a rail plus a profile vector, or two rails, and which side of the line the profile sits on: _
- **What went wrong on the first test board,** for each design: board **partly cut** (2026-11-18); details per design: _

## Order of work
1. **Beaded shaker** (Tim's choice, 2026-11-18). In progress.
2. Then the others in the table.

### Beaded shaker: working notes
- **Settled (Tim, 2026-11-18):** the round-over set up as a Form Tool on a 2D profile works well for the straight runs. Keep it.
- **The real problem: crisp corners.** A 12.7 mm round-over can't reach into an inside corner, so it leaves a rounded corner (extra material within about 6.35 mm of each corner). Tim cleans the corners up with VCarve's **Moulding toolpath**: he drew a short **L-shaped open rail at each corner** plus a profile vector, with these settings: Tapered Ball Nose 20°, 0.5 mm tip; Gap Above Toolpath 0; cut depth 5.002 (from the profile); Vary Stepover on; Machining allowance 0; **Create Sharp Corners on**; automatic boundary offset on. Preview shows mitre lines into each corner.
- **Plan to bake into the engine** (waiting on Tim's answers): for every round-over rectangle, add (a) the form-tool line on its own layer, (b) four L-shaped corner rails on a `MOULD_CORNER_RAIL`-type layer, all drawn the same direction so the profile lands on the same side at every corner, legs about 15 mm, and (c) the round-over cross-section drawn once per door, off the door, on a `MOULD_PROFILE`-type layer, sized to match the form-tool cut exactly.
- **Open questions to Tim:** which line the form tool runs on (pocket edge or the 6 mm bead line) and at what depth/side; the exact profile he drew and which end sits on the rail; leg length; whether the preview/cut blends into the form-tool cut.
- Could not read Vectric's online help from this cloud session (docs.vectric.com is blocked by the network settings), so rail-direction and profile-anchor rules come from Tim's tests, not the manual.

## Proven settings
(None yet. For each, record: design, toolpath type, bit, depths, passes, stepover, the vectors and layer names the DXF must contain, and a photo of the result.)

## Tools available
- `node scripts/test-board-dxf.js <folder>` writes all draft designs onto one 1220 x 500 mm offcut. Edit `PLAN` at the top to change which designs, sizes or positions.
- The recipes and layer names are in `public/js/engine.js` (`TOOLS` and `DESIGNS`).
