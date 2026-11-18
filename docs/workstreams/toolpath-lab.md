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
- **Tim's current beaded shaker (test, 2026-11-18):** two concentric form-tool lines about 12.7 mm apart (one bit width), giving a full bead between them and a half bead (quarter round) into the rest of the door, plus a small Moulding toolpath at each corner with the matching profile drawn in the panel.

### What Vectric's help says (VCarve Pro 12.5 docs, Moulding Toolpath page, read 2026-11-18)
- Select the rail(s) first, the profile **last**. The profile must be an **open** vector.
- **The profile's start point is attached to the rail's start point.** Right-click > Reverse Profile swaps which end hangs on the rail.
- Red lines on the rail show which side the profile is swept to; **Reverse Rail** flips it. On a **closed** rail the profile always hangs on the **outside**, so the rail should be the inside edge of the frame.
- At the end of an open rail the tool lifts, steps over and comes back the other way.
- **Create Sharp Corners** forces mitred corners instead of rolling round them.
- **Use automatic boundary offset** pushes the tool far enough past the profile's ends to finish steep or vertical ends.
- **Use Larger Area Clearance Tool** (with Machine Flat Regions and Skip Flat Regions) roughs with a bigger bit first, cuts flats with it, and makes a separate `[Clear]` toolpath to run first.
- **Automatic vector selection:** the Moulding toolpath has **two selectors, one for the rail and one for the profile**, and they are saved in toolpath templates. So once the DXF puts rails and profiles on fixed layers, one saved template should pick them up with no clicking (to confirm in VCarve: that the selector can pick by layer).
- 2D Profile toolpath, Corners tab: **Sharp Internal Corner (3D)** runs the tip of a V-bit up into the corner. The help only mentions V-bits; worth checking whether it's offered with the form tool, because if it is it might replace the corner mouldings.
- Custom form tools: draw the right-hand half of the cutter to scale, select it, then create a Form Tool in the tool database.
- Not read yet (the site started refusing after a few pages): Vector Selector, Toolpath Templates, Create Fillets, Chamfer, and a "Create Rounding Toolpath" page that may be relevant.

### Corner geometry (worked out 2026-11-18, to prove on a test cut)
- Running "On" a line, a round cutter leaves a **sharp mitre on the inside of a turn** and a **rounded corner on the outside of a turn**. So corner mouldings are only needed where the profile hangs on the **outside of the turn** (e.g. the frame side of a pocket corner). Corners where the profile hangs on the inside need nothing.
- The leftover material sits entirely in the wedge **beyond** the corner, not along the legs. In theory the legs only need to be long enough for the moulding tool to blend in: about the moulding tool's radius at full depth plus a margin (the 20° TBN with a 0.5 mm tip is about 1.1 mm radius at 5 mm deep). So **about 5 mm legs** should do, in place of about 25 mm, and that holds for any angle and for curved legs (measure along the curve). Test 3, 5 and 10 mm legs side by side.
- The moulding profile must match the form-tool cut exactly (same shape, depth and position), or there'll be a step where they meet.

### Engine plan (not built yet)
- A general function: give it a path (open or closed, straight or curved), the side the profile hangs on, and a leg length. It finds the real corners (turn over about 10°, so arc facets don't count), keeps only those where the profile is on the outside of the turn, and writes an open rail along the path from leg-before to leg-after, all in the same direction, so the profile always lands on the same side.
- Layers (names to agree): form-tool lines e.g. `ROUNDOVER_FORM12_D6`; corner rails `MOULD_CORNER_RAIL`; the matching profile once per door `MOULD_PROFILE`, drawn with its start point at the end that must sit on the rail.
- Use it for Beaded shaker first, then Victorian, Moulded frame fluted, Ring and arc panel (angled and curved corners), and Arch-top.

### New idea: single bead with a hard step (Tim's sketch, 2026-11-18)
- Profile: the frame surface, a vertical step down, a half-round bead whose top sits a little below the frame face, then flat into the panel.
- A round-over form tool can't make this. The cutter can only shape the bead's left half from the left, where the frame wall is, so it would round the frame edge over too. So this one is a **full-length Moulding toolpath**, not form tool plus corners.
- To save time: pocket the panel with the 6 mm end mill first (or use the Larger Area Clearance Tool with Machine Flat Regions), then finish the step and bead with the tapered ball nose. A 20° TBN leaves about 10° of draft on the "vertical" step.
- Needs from Tim: the bead radius, the step height, and how far below the frame face the bead top sits.

## Proven settings
(None yet. For each, record: design, toolpath type, bit, depths, passes, stepover, the vectors and layer names the DXF must contain, and a photo of the result.)

## Tools available
- `node scripts/test-board-dxf.js <folder>` writes all draft designs onto one 1220 x 500 mm offcut. Edit `PLAN` at the top to change which designs, sizes or positions.
- The recipes and layer names are in `public/js/engine.js` (`TOOLS` and `DESIGNS`).
