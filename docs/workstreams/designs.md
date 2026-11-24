# Workstream 3: Door designs and DXF engine

## Goal
Every launch design produces a DXF that imports into VCarve and cuts the intended effect with Tim's toolpath templates, with only minor edits. Customer options and limits match what Tim wants each design to allow.

## Status (18 Nov 2026)
- 18 launch designs are in `public/js/engine.js` (all with placeholder tooling): Slab, Traditional shaker, Skinny shaker, Bevelled shaker, Beaded shaker, New Country, Fluted shaker, Moulded frame fluted, Victorian, Georgian, Tongue & V groove, Tongue & bead groove, Fluted, Reeded, Diamond lattice, Arched, Arch-top beaded door, Ring and arc panel.
- **Settled by Tim, toolpaths sorted:** Diamond lattice, Arched, Tongue & V groove, Tongue & bead groove, Fluted, Reeded, New Country, Slab, Traditional shaker, Skinny shaker. Most DXFs are "a close enough approximation to be viable"; some minor edits are still to be listed.
- **Needs rework:** designs that use the **moulding toolpath** and/or the **round-over bit**. The current drafts are: moulding rails on `MOULD_TBN_RAIL` (Moulded frame fluted, Victorian, Ring and arc), and round-nose form tool / bead lines on `REED_FORM13_D4` / `BEAD_FORM6_D3` (Arch-top beads, Beaded shaker; Reeded and Arched use the same tool). Details of what's wrong are **still to come from Tim's test notes.**
- Test board: `node scripts/test-board-dxf.js <folder>` writes the 8 draft designs onto one 1220 x 500 mm offcut (small doors, full-size details).
- Not built: pairs or runs of doors whose pattern lines up across the gap (e.g. Arched across a pair).

## Changes on 20 Nov 2026 (engine VERSION 2)
- **Archived** (hidden from the configurator, refused for new orders, recipes kept for old orders): Fluted shaker, Moulded frame fluted, Victorian, Arch-top beaded door, Ring and arc panel. To bring one back, remove `archived: true` from its recipe.
- **Bevelled shaker redrawn** from Tim's description: a flat frame, an angled bevel, and a flat centre panel about 5 mm below the face. Geometry: `BEVEL_D5` layer on the frame's inner edge (top of the bevel), and `POCKET_EM6_D5` inset by `BEVEL_W` = 12 mm (the panel floor). **The 12 mm bevel width and the bit are placeholders**; Tim to confirm from a test cut.
- **Hinges:** none by default. When chosen: side, count, top and bottom distances (default 100, minimum 50, maximum half the height less 25), and notes up to 200 characters. The LABELS layer reads e.g. `HINGES LEFT x3 TOP 110 BOTTOM 100`, with notes on a separate line. Label text is now sized to its longest line.

## Changes on 24 Nov 2026 (engine VERSION 3)
- **Skinny shaker**: frame 18–35 mm (Traditional is 40–120, so they no longer overlap), and the panel is pocketed **5 mm** (`POCKET_EM6_D5`) so hinge cups on the back don't weaken the face. Traditional shaker stays 8 mm. Orders saved before version 3 keep 8 mm (`door.version` is passed to `build`).
- **Arched** is adjustable. Layout: single door, left of a pair, right of a pair, or both doors (one order line making two doors, priced as two, with hinges on the outer edges). Options: gap between the doors (default 3 mm, 0–10), number of arches 1–5, spacing (centre to centre, 16–60 mm), top of the arches from the top edge, and sideways shift. The arch radius is 38% of the pair's width (or the door's), limited by the height. Grooves are clipped to each door with the 10 mm overcut. In the DXF a pair is labelled `1L`/`1R` "(LEFT/RIGHT OF PAIR)". Old (version 2) arched orders keep the fixed design.
- Tools have a `depth`, and pocketed designs show customers the depth and the 3 mm inside-corner radius.
- Each design can return `dims` (measurements for the preview overlay).
- New flag `lab: true`: shown only on `/test-designs` and refused for orders. Use it for new drafts (two-panel, vented, raised profile).

## Decisions
- One layer per toolpath, named by tool and depth. The layer name is the contract with Tim's VCarve toolpath templates.
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
