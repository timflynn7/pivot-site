# Workstream 3: Door designs and DXF engine

## Goal
Every launch design produces a DXF that imports into VCarve and cuts the intended effect with Tim's toolpath templates, with only minor edits. Customer options and limits match what Tim wants each design to allow.

## Status (18 Nov 2026)
- 18 launch designs are in `public/js/engine.js` (all with placeholder tooling): Slab, Traditional shaker, Skinny shaker, Bevelled shaker, Beaded shaker, New Country, Fluted shaker, Moulded frame fluted, Victorian, Georgian, Tongue & V groove, Tongue & bead groove, Fluted, Reeded, Diamond lattice, Arched, Arch-top beaded door, Ring and arc panel.
- **Settled by Tim, toolpaths sorted:** Diamond lattice, Arched, Tongue & V groove, Tongue & bead groove, Fluted, Reeded, New Country, Slab, Traditional shaker, Skinny shaker. Most DXFs are "a close enough approximation to be viable"; some minor edits are still to be listed.
- **Needs rework:** designs that use the **moulding toolpath** and/or the **round-over bit**. The current drafts are: moulding rails on `MOULD_TBN_RAIL` (Moulded frame fluted, Victorian, Ring and arc), and round-nose form tool / bead lines on `REED_FORM13_D4` / `BEAD_FORM6_D3` (Arch-top beads, Beaded shaker; Reeded and Arched use the same tool). Details of what's wrong are **still to come from Tim's test notes.**
- Test board: `node scripts/test-board-dxf.js <folder>` writes the 8 draft designs onto one 1220 x 500 mm offcut (small doors, full-size details).
- Not built: pairs or runs of doors whose pattern lines up across the gap (e.g. Arched across a pair).

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
