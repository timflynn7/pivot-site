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
- **Round-over bits:** **CNC style, no bearing** (can plunge into the face). **Measured by Tim (2026-11-18): 12.7 mm across, 4.7 mm cutting height** (about 3/16" radius). The engine takes it as a 4.7 mm radius arc whose cutting edges stop 1.65 mm from the centre at the tip (`ROUNDOVER` in engine.js). Tim (2026-11-18): the cutting edge is about 1.7 mm wide at the tip, which fits. Side-on the bit looks pointed, probably the body between the edges. If that point sticks out below the edges, it only marks a fine line along the bottom of each groove. **This is the bit for all beading on all doors for now.** **The VCarve tool database entry is wrong:** "Form Tool 1/2 (12.7 mm)", tool no. 54, is drawn as two 6.35 mm quarter circles meeting at a point. Redraw it from `form-tool-roundover-12.7-R4.7.dxf` (written by the beads test board). Its settings: 2 flutes, pass depth 3.175, stepover 2.54 (20%), 20000 rpm, feed 5000, plunge 800 mm/min.
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
- Beaded shaker: two form-tool lines, **no pocket between them**, the pocket is in the centre. Tested at 6 mm deep, but **5 mm has worked better** before. 2D Profile set to **On**. Tim first thought the corner rails worked clockwise, **but the first try with the engine's clockwise rails failed** (see below).
- Single bead: use the 12.7 mm size. Step 0-2 mm, bead top 0-2 mm below the face; defaults are fine for now.

### Built in the engine (2026-11-18, branch `claude/fervent-ride-vmspcn`, engine VERSION 2). Not yet cut.
- **Rail direction, corrected 2026-11-18:** with the clockwise L rails, VCarve hung the profile **inside** the corner (the red lines pointed into the pocket) and refused with "A toolpath was not created. Check that there is enough space to fit the entire profile across the rail contour without it overlapping itself." So on an **open** rail VCarve hangs the profile on the **right** of travel. The corner rails now run **anticlockwise** round a pocket (e.g. top-left: along the top edge leftwards to the corner, then down). Closed rails (single bead) are unaffected: VCarve always hangs those outside.
- `cornerRails(pts, closed, side, leg)` in engine.js: works on any path, straight or curved, at any angle. It finds corners turning more than 10° where the profile hangs on the outside of the turn, and returns open rails `leg` mm each way (default `CORNER_LEG` = 5), drawn so that VCarve hangs the profile on the requested side (on the right of travel, so anticlockwise round a pocket). On the ring panel it finds 4 corners per arc panel (2 square, 2 where the arc meets the side) and none on the ring.
- **Reworked after Tim's VCarve simulation (2026-11-18).** The pocket didn't line up with the bottom of the round-over (beaded), and the single bead was cut only by the moulding toolpath. Now:
  - **Beaded shaker:** round-over ON the **pocket edge** and on a line 12.7 mm further out, both 4.7 deep (`ROUNDOVER_FORM12_D4_7`): a full R4.7 bead between them, and a quarter round up into the frame. The pocket (default **6 mm**, `POCKET_EM6_D6`) must be at least as deep as the round-over. So from the panel: panel → a step up of 1.3 mm (none if the pocket is "level" at 4.7) → 1.65 mm of groove floor → bead → groove → quarter round → frame. Corner rails on the pocket edge, `MOULD_RAIL_BEAD12_D4_7` + `MOULD_PROFILE_BEAD12_D4_7`.
  - **Single bead shaker:** round-over ON the **pocket edge**, cut **top + 4.7** deep (5.7 by default, `ROUNDOVER_FORM12_D5_7`), so its curve makes the panel side of the R4.7 bead. The Moulding toolpath only does the frame side: a closed rail along the bead's centre line, `MOULD_RAIL_SBEAD_FRAME_T1` + `MOULD_PROFILE_SBEAD_FRAME_T1` (the frame half of the bead, a 1 mm flat, the wall). Corner rails on the pocket edge, `MOULD_RAIL_SBEAD_CORNER_T1` + `MOULD_PROFILE_SBEAD_CORNER_T1` (the whole strip), make the round-over half's corners sharp too. Pocket default **6 mm**, at least as deep as the bead's foot. Bead top 0-2 below the face (default 1; `T1` in layer names). The 6 mm end mill as Larger Area Clearance Tool is still worth using on the frame-side toolpath.
  - New helpers: `roTool(depth)`, `pocketTool(depth)` (makes e.g. `POCKET_EM6_D4_7` when needed), `mouldTools(name, ...)`. Every profile reaches the face, so **Gap Above Toolpath is always 0**.
  - Checked by simulating a cross-section through each door edge: the pocket, round-over and moulding join up, and each corner profile matches the straight-run cut exactly (`test-boards/beads/cross-sections.png`).
- **Profiles** are drawn once per order, below the parts (y = -40 and down, off the board), with notes on LABELS. The first vertex is the start point and sits on the rail. If VCarve hangs it the wrong way: right-click > Reverse Profile, and tell Claude so the engine can be flipped.
- Rails and profiles are not shown in the website preview.
- `node scripts/test-board-dxf.js <folder> beads` writes a beads test board (10 doors): Beaded with legs 3/5/10, pocket level, pocket 8, and round-over 5 deep; Single bead with top 0, top 1, top 1 with the pocket level, top 1 with an 8 mm pocket. It also writes `form-tool-roundover-12.7-R4.7.dxf` (the bit's right half for the tool database). `... <folder>` alone still writes the original all-drafts board.
- Checked: read back with ezdxf (no errors), drawn, and the rail direction confirmed.
- **Files for Tim:** `test-boards/beads/` (one file each, on branch `claude/fervent-ride-vmspcn`) and `test-boards/beads-test-board.zip`. Regenerate them with the script after engine changes.

### Found while building
- First version assumed the bit was 6.35 mm deep (half its width); Tim measured 4.7. Now fixed: the engine models the bit with `ROUNDOVER = { dia: 12.7, radius: 4.7 }`.
- With the real bit, **4.7 mm deep (the radius)** is the natural depth: the round blends tangent into the face, and with lines 12.7 apart the two cuts meet at the face, so the bead between them is a full 4.7 mm half-round, with 3.3 mm flat-bottomed grooves either side. Any deeper and the bit's straight side leaves an upright step at the face (0.3 mm at 5 mm deep; 1.3 mm at 6 mm, which may be why 6 looked worse). **Default depth is now 4.7** (layers `..._D4_7`); the beads board has one door at 5 mm to compare.
- The first line is now 6.35 mm out from the pocket (was 6), so the inner quarter round finishes exactly at the pocket edge.

### Next
1. Tim cuts the beads board. For each corner leg length, check whether the moulding blends into the form-tool cut, and whether there's a witness line at the leg ends. Then set `CORNER_LEG`.
2. Check in VCarve: does the profile hang on the correct side with the first vertex as start? Can the Vector Selector pick rails and profile by layer for a toolpath template? Is "Sharp Internal Corner (3D)" offered with the form tool?
3. Fix the VCarve form tool from the shape file. From the board, pick: 4.7 or 5 deep; the pocket depth (level, 6 or 8) for each design; and the single bead's top.
4. Apply `cornerRails` to Ring and arc panel, Victorian, Moulded frame fluted and Arch-top once their profiles are known.

## Proven settings
(None yet. For each, record: design, toolpath type, bit, depths, passes, stepover, the vectors and layer names the DXF must contain, and a photo of the result.)

## Tools available
- `node scripts/test-board-dxf.js <folder>` writes all draft designs onto one 1220 x 500 mm offcut. Edit `PLAN` at the top to change which designs, sizes or positions.
- The recipes and layer names are in `public/js/engine.js` (`TOOLS` and `DESIGNS`).
