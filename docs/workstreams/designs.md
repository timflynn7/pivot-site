# Workstream 3: Door designs and DXF engine

## Goal
Every launch design produces a DXF that imports into VCarve and cuts the intended effect with Tim's toolpath templates, with only minor edits. Customer options and limits match what Tim wants each design to allow.

## Status (18 Nov 2026)
- 18 launch designs are in `public/js/engine.js` (all with placeholder tooling): Slab, Traditional shaker, Skinny shaker, Bevelled shaker, Beaded shaker, New Country, Fluted shaker, Moulded frame fluted, Victorian, Georgian, Tongue & V groove, Tongue & bead groove, Fluted, Reeded, Diamond lattice, Arched, Arch-top beaded door, Ring and arc panel.
- **Settled by Tim, toolpaths sorted:** Diamond lattice, Arched, Tongue & V groove, Tongue & bead groove, Fluted, Reeded, New Country, Slab, Traditional shaker, Skinny shaker. Most DXFs are "a close enough approximation to be viable"; some minor edits are still to be listed.
- **Needs rework:** designs that use the **moulding toolpath** and/or the **round-over bit**. The current drafts are: moulding rails on `MOULD` (Moulded frame fluted, Victorian, Ring and arc), and round-nose form tool / bead lines on `REED_D4` / `BEAD_D3` (Arch-top beads, Beaded shaker; Reeded and Arched use the same tool). Details of what's wrong are **still to come from Tim's test notes.**
- Test board: `node scripts/test-board-dxf.js <folder>` writes the 8 draft designs onto one 1220 x 500 mm offcut (small doors, full-size details).
- Not built: pairs or runs of doors whose pattern lines up across the gap (e.g. Arched across a pair).

## Changes on 20 Nov 2026 (engine VERSION 2)
- **Archived** (hidden from the configurator, refused for new orders, recipes kept for old orders): Fluted shaker, Moulded frame fluted, Victorian, Arch-top beaded door, Ring and arc panel. To bring one back, remove `archived: true` from its recipe.
- **Bevelled shaker redrawn** from Tim's description: a flat frame, an angled bevel, and a flat centre panel about 5 mm below the face. Geometry: `BEVEL_D5` layer on the frame's inner edge (top of the bevel), and `POCKET_D5` inset by `BEVEL_W` = 12 mm (the panel floor). **The 12 mm bevel width and the bit are placeholders**; Tim to confirm from a test cut.
- **Hinges:** none by default. When chosen: side, count, top and bottom distances (default 100, minimum 50, maximum half the height less 25), and notes up to 200 characters. The LABELS layer reads e.g. `HINGES LEFT x3 TOP 110 BOTTOM 100`, with notes on a separate line. Label text is now sized to its longest line.

## Changes on 24 Nov 2026, fourth round
- **DXF layers renamed** to the cut type and depth: `CUTOUT`, `POCKET_D2..D8`, `FLUTE_D5`, `FLUTE_D4`, `REED_D4`, `BEAD_D3`, `VGROOVE_D4`, `VGROOVE_D5`, `BEVEL_D5`, `BEVEL_D8`, `ROUNDOVER`, `MOULD`, `CHAMFER_D3`. Geometry unchanged, so no engine version bump.
- **Arched options order**: Doors, Number of arches, Gap (pairs only), Arch spacing, Top of the arches, Side margin.
- Tim confirmed: exact boards centred on the door; arches behave as wanted (circular, mirrored).

## Changes on 24 Nov 2026, third round (engine VERSION 5)
- **Bevelled shaker**: pocket back to **8 mm** (`POCKET_D8`), with an 8 mm wide 45 degree bevel on new layer `BEVEL_D8`. Show measurements labels it "45° bevel". Version 4 orders keep 5 mm/5 mm; earlier ones 5 mm with a 12 mm bevel.
- **Diamond lattice archived** (test page only), with Show measurements giving one diamond's width and height. Removed from the home page range, meta description and lede, and from the story text (the lattice photo on the story page stays, as it's a real photo of past work).
- Pocket note no longer says "tight but not perfectly square". **New Country** shows no pocket note (`noNote: true`); its measurements overlay still shows depth and corners.
- The board-count text (e.g. "3 boards...") is no longer shown in the preview summary for New Country and the groove designs.
- **Option order everywhere**: frame width first, then the pattern sliders, then toggles (Board widths, Number of arches, Doors), each with its help text underneath. Arched: spacing, top, side margin, number of arches, doors, then gap.
- **Every slider has a number box** beside it; each updates the other. Typed values outside the limits show the usual error and block Add.

## Changes on 24 Nov 2026, second round (engine VERSION 4, Tim's configurator comments)
Old orders keep their earlier geometry (each recipe checks `door.version`).
- **Every pocket** shows its depth and the inside-corner radius in the design note and in Show measurements. The radius is labelled **1.5 mm** (`CORNER_R`): Tim will finish corners with a 1/8 in downcut or 2 mm straight bit. Pocket layer names are unchanged (`POCKET_D*`); their labels now mention the corner bit.
- **Bevelled shaker**: 90 degree V-bit, so the bevel is as wide as the pocket is deep (5 mm). Version 3 and earlier: 12 mm.
- **Beaded shaker**: a 12.7 mm round-over bit with a moulding toolpath (squares the corners). New layer `ROUNDOVER`, a drive rail on the pocket edge, plus the 8 mm pocket. The 6 mm bead groove is only for old orders.
- **Georgian** is adjustable: frame width 40–120 mm (same minimum as Traditional shaker), shoulder width 10–40 mm, shoulder depth 2–6 mm (default 4 = half the 8 mm pocket). New layers `POCKET_D2` and `POCKET_D3`.
- **New Country, Tongue & V groove, Tongue & bead groove**: Board widths "Fit evenly" (as before) or "Exact width". Exact boards are centred on the door, and the edge boards (at least half a board) take up the difference, so the pattern matches across doors of different widths. Tim may prefer aligning from one edge instead: ask.
- **Fluted**: side margins and top/bottom margins set separately (default 40 mm each). Old orders' single `margin` still works.
- **Reeded**: fixed at 12.5 mm centre to centre (`REED_PITCH`), not editable. Old orders keep their own spacing.
- **Arched**: "Move sideways" is replaced by **Side margin** (outside edge of the door to the outer arch). The arches stay mirrored about the centre line of the door, or of the gap for a pair, so each door of a pair carries exactly a quarter turn (90 degrees). The top stays where it's set when the width changes (the legs start lower or higher). Measurements: top, spacing, side margin, and innermost arch to the door's inner edge (opening width on a single door). To confirm with Tim: the arches are still circular, not elliptical.
- Live on 24 Nov 2026 (merged to `main` at Tim's request).

## Changes on 24 Nov 2026 (engine VERSION 3)
- **Skinny shaker**: frame 18–35 mm (Traditional is 40–120, so they no longer overlap), and the panel is pocketed **5 mm** (`POCKET_D5`) so hinge cups on the back don't weaken the face. Traditional shaker stays 8 mm. Orders saved before version 3 keep 8 mm (`door.version` is passed to `build`).
- **Arched** is adjustable. Layout: single door, left of a pair, right of a pair, or both doors (one order line making two doors, priced as two, with hinges on the outer edges). Options: gap between the doors (default 3 mm, 0–10), number of arches 1–5, spacing (centre to centre, 16–60 mm), top of the arches from the top edge, and sideways shift. The arch radius is 38% of the pair's width (or the door's), limited by the height. Grooves are clipped to each door with the 10 mm overcut. In the DXF a pair is labelled `1L`/`1R` "(LEFT/RIGHT OF PAIR)". Old (version 2) arched orders keep the fixed design.
- Tools have a `depth`, and pocketed designs show customers the depth and the 3 mm inside-corner radius.
- Each design can return `dims` (measurements for the preview overlay).
- New flag `lab: true`: shown only on `/test-designs` and refused for orders. Use it for new drafts (two-panel, vented, raised profile).

## Decisions
- One layer per cut, named by the type of cut and its depth only (24 Nov 2026, Tim's choice), e.g. `POCKET_D8`, `VGROOVE_D4`, `REED_D4`, `BEVEL_D8`, `ROUNDOVER`, `MOULD`, `CUTOUT`. Tim works out the tooling and toolpath settings in VCarve. Renaming applies to old orders' DXFs too (geometry unchanged).
- Customer rules: statement designs are size only; shaker types adjust borders and rails; patterns adjust spacing only.
- Fixed design dimensions (e.g. the Victorian frame of 70 mm) can be narrowed by test scripts through extra keys in `opts`. Customers can't change them, because `normalizeDoor` strips them.

## Open questions for Tim
For each moulding or round-over design:
- Which toolpath and bit (VCarve moulding toolpath with which profile, or a 2D profile with a round-over form tool)? Depth and diameter?
- Which vectors VCarve needs: a drive rail only, a rail plus a profile, two rails, an offset line? On which side of the line?
- What the rail should follow (the pocket edge, an offset from it, the door edge).
- Photos of the test cuts and of the VCarve toolpath settings that worked.
Also: real layer names and depths for the settled designs, to replace the placeholders in `TOOLS`.

## Next tasks
1. Moulding and round-over designs: being worked out in [toolpath-lab.md](toolpath-lab.md). Bring the proven settings back here and into the recipes.
2. Replace the placeholder `TOOLS` with Tim's real bits, depths and layer names.
3. Apply the "minor edits" Tim lists for the settled designs.
4. Pairs and runs: lay a pattern across several doors with a set gap (the Panel Pattern Engine already does this).
5. Bump `VERSION` when geometry changes in a way that affects old orders.

## Key files
`public/js/engine.js` (`TOOLS`, `DESIGNS`, `orderDXF`), `scripts/test-board-dxf.js`, `scripts/sample-dxf.js`.

## First full test cut (25 Nov 2026): Tim's findings, awaiting decisions
Tim cut the sample doors on 25 Nov 2026. **No engine changes until Tim approves** (his instruction, 26 Nov 2026). Organised notes and Claude's analysis were given in the chat; the summary:

**Set-up first (affects every design):** Z flatness (reeds had flat spots where the board sat lower: surface the spoilboard, check the board's thickness and hold-down, consider a light facing pass on reeded doors before machining); calibrate the tool library (1/8 in downcut gave elongated corners, the 2 mm straight bit was better: measure the true cut width of each bit from a test slot); set pass depths in VCarve (bevel and V-grooves were too much in one pass).

**Vector changes proposed (need Tim's approval, then bump `VERSION`):**
1. Tongue & bead groove: bead line 12.5 mm from the V-groove line (now 9 mm), and its layer renamed to match the real bit and depth (now `BEAD_D3`, cut at 5 mm with the reed bit). Tim to confirm the 12.5 mm is V-line to bead centre line.
2. Reeded: extend the 12.5 mm reed lines past both side edges so the edge reeds are fully formed (no flat border). Tim to send a past delivered reeded job to copy.
3. V-groove depth: the 4 mm (8 mm wide) groove was too much on Tongue & V and New Country. New depth to come from a depth ladder test; the layer name changes with it (e.g. `VGROOVE_D2`).
4. New Country: the V-groove lines run right up to the pocket wall, so the V-bit's cone cuts a notch into the frame wall at each groove end. Options: stop the lines short by the bit's radius, or use a smaller-diameter V-bit. Decide after the test.
5. If the 2 mm bit replaces the 1/8 in bit for corners, the customer wording changes from a 1.5 mm to a 1 mm inside-corner radius (`CORNER_R`; wording only, the vectors have sharp corners).

**VCarve-only (no vector change):** Georgian corners (vectors confirmed fine; shoulder 20 mm at 4 mm deep, 8 mm panel), bevelled shaker passes and corner overshoot (check V-bit angle and tip in the tool library and Z zero), beaded shaker lip (moulding profile should overlap the pocket line slightly, or a 2 mm tidy-up pass), tongue & bead two-stage depth.

**Open questions:** Fluted spacing (DXF lines 22 mm apart, 16 mm flute assumed: what bit and spacing does Tim use now?); hinge cups on Skinny shaker (cup reaches 40 mm in from the edge, past the 18–35 mm frame, over the 5 mm pocket, leaving about 13 mm of board: a 13 mm deep cup would break through); back-side drilling would need a flip jig and a separate DXF layer or file.

**Experiment board (26 Nov 2026):** `node scripts/test-cut-360.js <folder>` writes 14 tests for the 360 x 360 mm uncut fluted blank (bottom right of the 1200 x 1200 test sheet): corner bits (T01–T03), bit calibration slots (T04), bevel at 4 and 8 mm (T05–T06), beaded lip (T07), V-groove depth ladder on the face (T08), New Country at 8/6/5 mm pocket depth with groove depths and end stops (T09–T11), reed depth ladder (T12), tongue & bead at 12.5 mm (T13), reeded edge with lines past the edges and a facing pass (T14). Two cells spare. Output and preview in `test-cuts/2026-11-26-360-board/`. Separate from engine.js. Record Tim's results here, then decide the engine changes.

**Experiment results so far (Tim, late Nov 2026), T01–T03 as 55 mm inside profiles / pocket, measured with calipers:** 1/8 in downcut (library 3.14 mm) cut 55.4 mm, so it cuts like a 3.54 mm bit (0.2 mm oversize each side); 2 mm straight 55.1 (cuts like 2.1 mm); 6 mm 54.9 (like 5.9 mm). 2 mm and 6 mm are within tolerance. 1/8 in: next, cut the T04 single-pass slot to tell runout (slot about 3.5 mm wide: set the library to the slot width) from deflection (slot about 3.2 mm: use a light finishing pass instead).
**1/8 in result:** T04 slot 3.25 mm (a true 1/8 in is 3.175), so only slight runout; the 0.4 mm oversize was mostly the bit bending. Pass depth cut from 4 mm to 3 mm in the tool library: 55 mm pocket now 54.9 mm, in line with the 2 mm and 6 mm bits. Library diameter left at 3.14 mm. Still to check: the corners at the new pass depth.
**Caveat (Tim's point):** in real pockets a 24.4 mm surfacing bit clears first and the 1/8 in only finishes the edges and corners, so pass depth may matter less there. The 55.4 mm result was an inside profile (the bit cutting full width), the 54.9 mm a pocket, so the two tests differ in more than pass depth. Corners now clean. To settle: two identical pockets (24.4 mm clearing + 1/8 in finishing), one at 4 mm passes and one at 3 mm, on spare cells T15/T16.
