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
- **Round-over bits:** **CNC style, no bearing** (can plunge into the face). Radius, cutting diameter, tip diameter, shank, any step/flat: _
- **Each effect wanted:** a photo or sketch of the cross-section, with the profile width and depth: _
- **The route for each design:** VCarve's Moulding toolpath (a profile swept along a drive rail and cut with raster passes, usually with a ball nose or tapered ball nose), **or** a 2D Profile toolpath with the round-over defined as a form tool in the tool database (the bit cuts its own shape in one pass). These are two different approaches. Which suits each design is the first thing to settle. _
- **Vectors VCarve needs:** a drive rail only, or a rail plus a profile vector, or two rails, and which side of the line the profile sits on: _
- **What went wrong on the first test board,** for each design: board **partly cut** (2026-11-18); details per design: _

## Order of work
1. **Beaded shaker** (Tim's choice, 2026-11-18). In progress.
2. Then the others in the table.

### Beaded shaker: working notes
- Current draft: 8 mm pocket at the frame border, plus a separate bead line 6 mm out on `BEAD_FORM6_D3` (a 6 mm bead form tool, 3 mm deep). A plain round-over bit run on a separate line on the flat frame would cut a cove-like dip, not a bead, so this probably needs to change.
- Working idea (not yet tested): with a no-bearing round-over, run a **2D Profile, Inside** on the **pocket's own rectangle**, after the pocket, with the round-over set up as a **Form Tool** in the VCarve tool database. The bit rounds over the top edge of the frame where it drops into the pocket. Cutting a little deeper than the radius leaves a small step (quirk) under the round, which reads as a bead. If so, the DXF just needs a copy of the pocket rectangle on its own layer (e.g. `ROUNDOVER_R6_D6`), and no separate bead line.
- Waiting on: bit sizes, the effect wanted (photo or sketch), and what happened on the test board.

## Proven settings
(None yet. For each, record: design, toolpath type, bit, depths, passes, stepover, the vectors and layer names the DXF must contain, and a photo of the result.)

## Tools available
- `node scripts/test-board-dxf.js <folder>` writes all draft designs onto one 1220 x 500 mm offcut. Edit `PLAN` at the top to change which designs, sizes or positions.
- The recipes and layer names are in `public/js/engine.js` (`TOOLS` and `DESIGNS`).
