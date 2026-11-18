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
1. **Beaded shaker** and the new **Single bead shaker** (Tim's choice, 2026-11-18). Built; waiting on a test cut.
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

### Tim's answers (2026-11-18)
- Beaded shaker: two form-tool lines, **no pocket between them**, the pocket is in the centre. Tested at 6 mm deep, but **5 mm has worked better** before. 2D Profile set to **On**. Corner rails **work clockwise**.
- Single bead: use the 12.7 mm size. Step 0-2 mm, bead top 0-2 mm below the face; defaults are fine for now.

### Built in the engine (2026-11-18, branch `claude/fervent-ride-vmspcn`, engine VERSION 2). Not yet cut.
- `cornerRails(pts, closed, side, leg)` in engine.js: works on any path, straight or curved, at any angle. It finds corners turning more than 10° where the profile hangs on the outside of the turn, and returns open rails `leg` mm each way (default `CORNER_LEG` = 5), drawn clockwise as seen in VCarve so the profile hangs on the left of travel. On the ring panel it finds 4 corners per arc panel (2 square, 2 where the arc meets the side) and none on the ring.
- **Beaded shaker:** 8 mm pocket; round-over lines **6 mm and 18.7 mm** out from the pocket on `ROUNDOVER_FORM12_D5`; 4 corner rails on the pocket edge on `MOULD_RAIL_BEAD12_D5`; profile `MOULD_PROFILE_BEAD12_D5`, which starts at the pocket edge, on the face, and covers both cuts.
- **Single bead shaker** (new draft, `singlebead`): one closed rail at the pocket edge on `MOULD_RAIL_SBEAD12` (full-length Moulding toolpath, no form tool); profile `MOULD_PROFILE_SBEAD12`: field at 8 mm, a 1 mm flat, a step up to the bead's foot, a 12.7 mm half-round bead with its top `top` below the face (default 1), then a vertical wall up to the frame face. The rest of the panel is the 8 mm pocket. The floor is fixed at 8 to match `POCKET_EM6_D8`, so the step under the bead is 8 - 6.35 - top (0 to 1.65 mm), and top can be 0 to 1.65.
  - **Assumption to confirm:** I read Tim's "step" as the small drop from the bead's foot down to the panel field.
- **Profiles** are drawn once per order, below the parts (y = -40 and down, off the board), with notes on LABELS. The first vertex is the start point and sits on the rail. If VCarve hangs it the wrong way: right-click > Reverse Profile, and tell Claude so the engine can be flipped.
- Rails and profiles are not shown in the website preview.
- `node scripts/test-board-dxf.js <folder> beads` writes a beads test board: Beaded at legs 3, 5 and 10 mm (top row); Single bead with top 0, 1 and 1.65 (bottom row). `... <folder>` alone still writes the original all-drafts board.
- Checked: read back with ezdxf (no errors), drawn, and the rail direction confirmed.

### Found while building
- With the round-over drawn as two 6.35 mm quarter circles meeting at a point (as in VCarve), a cut **5 mm** deep is only **4.9 mm wide at the face** (2.44 each side). So with lines 12.7 apart, the "bead" between them is flat-topped (about 7.8 mm flat) with rounded shoulders, not a full round. A full round needs 6.35 deep (the cuts then meet tangent at the top), which may be why 6 mm looked different. To decide on a cut: keep 5 mm, go to 6.35 mm, or bring the lines closer.

### Next
1. Tim cuts the beads board. For each corner leg length, check whether the moulding blends into the form-tool cut, and whether there's a witness line at the leg ends. Then set `CORNER_LEG`.
2. Check in VCarve: does the profile hang on the correct side with the first vertex as start? Can the Vector Selector pick rails and profile by layer for a toolpath template? Is "Sharp Internal Corner (3D)" offered with the form tool?
3. Decide the bead depth (see above). Then confirm the single-bead dimensions.
4. Apply `cornerRails` to Ring and arc panel, Victorian, Moulded frame fluted and Arch-top once their profiles are known.

## Proven settings
(None yet. For each, record: design, toolpath type, bit, depths, passes, stepover, the vectors and layer names the DXF must contain, and a photo of the result.)

## Tools available
- `node scripts/test-board-dxf.js <folder>` writes all draft designs onto one 1220 x 500 mm offcut. Edit `PLAN` at the top to change which designs, sizes or positions.
- The recipes and layer names are in `public/js/engine.js` (`TOOLS` and `DESIGNS`).
