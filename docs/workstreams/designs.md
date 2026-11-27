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
**Pocket finish comparison (Tim's photos):** (1) 24.4 mm surfacing bit + 1/8 in: corners tight, but torn fibres and fuzz on parts of the walls (right wall, top edge). (2) 24.4 mm + 1/8 in + 2 mm finishing pass: walls cleaner and crisper, especially the right wall. Recommendation: 24.4 mm clears, 1/8 in (3 mm passes) does the corners, 2 mm does a light final profile on the line at full depth. Group toolpaths by bit, so it's one extra tool change per sheet, not per door. The 2 mm bit being last makes the inside corners about 1 mm radius: the site's 1.5 mm wording is an approval item.
**VCarve set-up (Tim's version):** there's no "Use larger clearance tool" tick box; the Pocket toolpath has a **Tools list** instead (24.4 mm surfacing, 1/8 in downcut, 2 mm straight, largest first), and each smaller bit only cuts what the bigger ones couldn't reach. To be checked in the toolpath preview: whether the 2 mm bit skims the straight walls or only the corners. If only the corners, use the pocket (24.4 + 1/8 in) with a 0.2 mm Pocket Allowance, then a separate 2 mm inside Profile on the same vector at full depth with no allowance.
**Confirmed:** in Tim's VCarve the 2 mm bit in the Pocket Tools list runs all the way round the pocket, so one Pocket toolpath (24.4 mm surfacing, 1/8 in downcut at 3 mm passes, 2 mm straight, allowance 0, climb) is the standard for every pocket. No separate profile needed. Save it as a toolpath template.
**Corner wording stays at 1.5 mm (Tim's decision):** he has only one 2 mm bit, so the site keeps promising what the 1/8 in bit alone can deliver. Revisit once he has a spare 2 mm bit. Removed from the list of engine changes awaiting approval.
**Bevel toolpath (T05/T06, and the Bevelled shaker):** Pocket on the inner `POCKET_D*` line first, then VCarve's **Chamfer** toolpath with the 90 degree V-bit on the outer `BEVEL_D*` line: start depth 0, side Inside, depth (or width) = the pocket depth, Sharp corners on, 2–3 mm passes. The bottom of the chamfer should land exactly on the pocket line at the floor.
**Bevel overcut:** the first Bevelled shaker cut used a Chamfer Overcut of 0.2 mm. That probably carries the bevel past its bottom edge (about 0.2 mm deeper and further in), so the corner mitre runs about 0.3 mm on into the pocket corner and leaves a fine nick in the floor. It may explain overshoot at the bottom of the corners, not at the face. T06 is set with Overcut 0 to compare; Overcut also takes the 16 mm V-bit past its 8 mm limit.
**T07 / Beaded shaker vectors:** the DXF gives only the drive rail (`ROUNDOVER`, on the pocket line), not the cross-section profile vector a Moulding toolpath also needs. The same is true for the live engine. Tim can test depth and the lip with a 2D Profile toolpath (inside, on the rail, tool diameter = the round-over's tip diameter), but its corners come out rounded, not mitred. To add a profile vector Claude needs the bit's radius, tip diameter, overall diameter and cutting height.
**T07 profile set-up (Tim):** the round-over bit (12.7 mm) goes no deeper than 5 mm before its shoulder cuts in. Tim's testing suggests the bit's centre should sit 5.5 mm inside the pocket line. VCarve's Inside profile puts the centre half the diameter (6.35 mm) in; a negative allowance moves it towards the line, so allowance −0.85 mm. Or copy the tool with an 11 mm diameter and use allowance 0.
**T04 V-bit slot:** 3 mm deep, measured 5.5–5.7 mm wide (6.0 expected). Either the cut is about 0.2 mm shallow (Z zero or board height) or the bit is nearer 86° than 90°. Both make a bevel fall short of its lines rather than overshoot, so this doesn't explain the bevel's corner overshoot (more likely the 0.2 mm Chamfer Overcut). To tell them apart: grooves at 2, 4 and 6 mm deep; a too-steep bit widens the gap as the grooves get deeper (86°: 3.73 / 7.46 / 11.19 mm), a shallow cut keeps it the same (0.2 mm shallow: 3.6 / 7.6 / 11.6 mm). Then fix the library angle or the Z zero.
**Bevel corner "ears" (Tim's photo of the first Bevelled shaker):** the mitre reaches the outer corner but pokes slightly past the straight top edges. A V-bit steeper than its library angle does exactly this: the tip still finishes in the corner while the sloping faces fall short of the line along the sides (an 86° bit at 8 mm: about 0.5 mm short each side). A shallow Z cut would leave the corner short too, so no ear. Check: measure the bevel's width on a straight side (should be 8.0). The T06 README note was corrected: errors that double from 4 to 8 mm point to the angle, not Z. Tim is re-testing T05/T06 with Overcut 0.
**T06 result (Overcut 0, Tim's photo):** the corners are crisp, with the mitres running straight from the outer corners to the inner corners and no visible ears. So the 0.2 mm Overcut was the main cause of the first door's corner overshoot. Still to check: bevel width on a straight side (should be 8.0 mm) and T05, to rule out the V-bit angle; and whether there's a small step at the foot of the right-hand bevel (a lighter band shows in the photo). Bevelled shaker toolpath: Chamfer, Overcut 0. No engine change needed.
**T06 face opening: 54.3 mm** (55.0 drawn), so the bevel stops about 0.35 mm short of the line on each side. Either the V-bit cuts about 0.35 mm shallow (likely a Z zero after the tool change; it would leave a tiny step at the foot of the bevel) or it's about 87° rather than 90° (no step). Tell-apart: T05's face opening (angle: about 54.65; Z: 54.3 again) and feel for a step at the foot. Small either way: the corners are now clean.

**New Country: Tim's settled approach (late Nov 2026)**, replacing the 8 mm pocket and 4 mm grooves: pocket **3 mm** deep; V-grooves **2 mm below the floor** (start depth 3, so 5 mm from the face, 4 mm wide); the pocket line **duplicated for a Chamfer toolpath, Outside, Slope Upwards, 5 mm deep**: a 45° chamfer from the pocket line at 5 mm depth up to the face 5 mm outside it. This also solves the groove-end notch: the chamfer runs along the wall at the same depth and angle as the grooves, so each groove end falls inside it. (Tim also tried a different tool angle on the bevel toolpath, which made the face opening worse, pointing to the V-bit's Z zero rather than its angle.)
Proposed engine change (needs Tim's OK, bump `VERSION`): New Country = `POCKET_D3` + grooves on `VGROOVE_D5` + a new `CHAMFER_D5` layer on the pocket line. Question: should the customer's frame width run to the top edge of the chamfer (what you see; pocket line 5 mm further in) or to the pocket line?

## Changes on 27 Nov 2026 (engine VERSION 6): New Country from the test cuts (Tim approved)
- New Country: `POCKET_D3`, board grooves on `VGROOVE_D5` (V-bit 5 mm from the face, 2 mm below the floor, 4 mm wide), and `CHAMFER_D5` on the pocket line (Chamfer toolpath: Outside, Slope Upwards, 5 mm deep, Sharp corners). **Frame width now runs to the top of the chamfer** (Tim's choice); the pocket line is 5 mm further in. Help text under the slider says so.
- New option **Frame joints: None / Five-piece look** (default None): four `VGROOVE_D2` grooves from the chamfer's top corners to the top and bottom edges, set out 5 + 2 mm from the pocket line (the chamfer depth plus the groove depth), so each groove's inner edge lines up with the chamfer's top edge. Overcut 10 mm past the door edge as usual.
- Preview draws the chamfer as a shaded band; the New Country render (`public/img/designs/newcountry-render.jpg` + thumb) is redrawn from the new geometry (render script now draws `pchamfer5`, `v90d5p` and `v90d2`).
- Orders saved before version 6 keep the 8 mm pocket with 4 mm grooves (tested in `npm test`).
- Checked: DXF read back with ezdxf and drawn; configurator option tested in a browser.
- **Live on 27 Nov 2026** (merged to `main` at Tim's request, together with the discount-code and hinge-charge work already on `main`). Checked on pivotdesigns.co.uk: engine version 6 served, new render in place.
- **Preview fix (27 Nov 2026, Tim's comment):** the configurator drew the five-piece joint grooves as a band centred on the cutting line, so they looked as if they sat outside the chamfer line. The preview now draws them as a fine line on the chamfer's top edge (paths marked `joint`). The DXF is unchanged: the grooves' inner edges meet the chamfer's top edge, as specified.

## Changes on 27 Nov 2026 (engine VERSION 7): Bevelled shaker options (Tim's request)
- **Bevel:** *Down to the panel* (default, unchanged: `BEVEL_D8` on the top edge, Chamfer inside, slope downwards, the pocket depth; Tim's testing confirms this works) or *With a 2 mm step* (`CHAMFER_D6` on the pocket line, Chamfer outside, slope upwards, the pocket depth less 2 mm, as in Tim's test). The frame width runs to the top of the bevel in both, so with a step the pocket line is 6 mm in (the panel is 4 mm wider overall than with the full bevel).
- **Frame joints: Five-piece look**, as on New Country. Shared helper `jointGrooves()`: grooves set out by their own 2 mm depth from the frame's inner edge (the top of the bevel or chamfer), ends 2 mm short of that edge, overcut 10 mm past the door edge. New Country moved onto the same helper (geometry unchanged, tested).
- Layer rule: `BEVEL_Dn` = on the top edge, inside, slope downwards; `CHAMFER_Dn` = on the pocket line, outside, slope upwards.
- Bevelled orders before version 7 ignore the new options.
- Checked: DXF read back and drawn, preview and renders drawn, configurator tested in a browser, `npm test` passes.

**Open questions for Tim:**
1. **Five-piece joint groove ends** (New Country and Bevelled): in Tim's own experiments the groove ends lined up vertically with the top and bottom of the chamfer toolpath. The website's grooves stop 2 mm short of the frame's inner edge (the V-bit's tip), so the groove's tapered end just reaches that edge. Tim will test a website DXF and confirm whether the ends should move.
2. **With a 2 mm step:** the step's corners keep the pocket's 1.5 mm radius under the bevel's sharp mitre; check it looks right on a test cut.

**T12 result (Tim, 27 Nov 2026): the reed bit's correct depth is 5 mm** (the deepest it goes before the shoulder cuts in, confirmed on the 4 / 4.5 / 5 mm ladder). The DXF layers still say `REED_D4` (Reeded, Arched) and `BEAD_D3` (Tongue & bead groove's bead line, still 9 mm from the V-groove). Proposed and **awaiting Tim's OK**: rename to `REED_D5` and move the Tongue & bead line to 12.5 mm (item 1 of the test-cut list); reeded lines past the side edges (item 2) still need a past delivered reeded job to copy.
- Bevelled shaker version 7 **live on 27 Nov 2026** (Tim's go-ahead).

## Changes on 27 Nov 2026 (engine VERSION 8): Tongue & bead groove (Tim approved)
- Bead line **12.5 mm** to the right of each V-groove line (was 9 mm), on new layer **`REED_D5`** (the 12.7 mm reed bit at 5 mm). V-grooves unchanged on `VGROOVE_D4` (their depth waits for the T08 ladder result). Orders before version 8 keep the 6 mm bead (`BEAD_D3`) 9 mm away. Checked: DXF read back and drawn, preview drawn, `npm test` passes. Live on 27 Nov 2026.
- Still on `REED_D4`: Reeded and Arched. Ask Tim whether they should move to 5 mm too (T12 was about the bead), and send a past delivered reeded job for the edge-overflow change.

## Changes on 27 Nov 2026 (engine VERSION 9): reed and arch layers (Tim's instruction)
- **Reeded** on `REED_D5` (the reed bit at 5 mm). **Arched** on `FLUTE_D5`. Geometry unchanged for both; orders before version 9 keep `REED_D4`. Checked: DXF read back and drawn, `npm test` passes. Live on 27 Nov 2026.
- **Open question for Tim:** the arches are still spaced for a 12.7 mm wide groove (side margin and top are measured to the groove's edge), and the Arched help text tells customers "The grooves are cut with a 12.7 mm form tool". If the flute bit used for arches is a different width, give its width and Claude will update the spacing and the text. The Fluted design also still assumes a 16 mm flute (placeholder).

## Changes on 27 Nov 2026 (engine VERSION 10): the fluting bit (Tim: Arched uses the same 15.9 mm ball nose as Fluted)
- New tool `flute5b` on `FLUTE_D5`: 15.9 mm ball nose at 5 mm. It doesn't reach its full radius, so the groove at the face is 2 × √(r² − (r − 5)²) = **14.76 mm** (`FLUTE_W`, worked out in the engine from `FLUTE_BIT`).
- **Fluted:** flutes stop half that width inside the margins (ends move 0.6 mm out compared with the 16 mm placeholder); help text "The flutes are 14.8 mm wide". Older orders keep 16 mm.
- **Arched:** side margin and top are measured to the edge of a 14.8 mm groove (was 12.7 mm), so arches sit about 1 mm further in and lower for the same settings; help text "The grooves are 14.8 mm wide" (was "cut with a 12.7 mm form tool"). Version 9 orders keep 12.7 mm; earlier ones `REED_D4`.
- Checked: DXF read back and drawn, `npm test` passes. Live on 27 Nov 2026.
- **Still open (from the test cut):** Fluted spacing. The default is 22 mm centre to centre, which leaves a 7.2 mm flat between 14.8 mm flutes (range 18–32 mm). Tim to confirm the spacing used on his delivered fluted doors.
