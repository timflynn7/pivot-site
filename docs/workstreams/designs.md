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
- **Test sheet (25 Nov 2026):** `scripts/test-sheet-dxf.js` writes nine 360 × 360 test panels on a 1200 × 1200 sheet (one per cut layer) plus one file per panel and a README; see docs/BACKLOG.md item 1a. Sent to Tim; results go into `TOOLS`.
