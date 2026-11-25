# Workstream 3a: Toolpath lab (moulding toolpath and round-over bits)

A focused side-project of the designs workstream (designs.md). It works out, in VCarve, which toolpath, bit and settings give the effects Tim wants, and which vectors the DXF must contain for them. **When a combination is proven on a test cut, move it into designs.md and the engine recipe, and mark it done here.**

## The question
How to get the moulding toolpath to work correctly with Tim's round-over bits, and what the DXF must give VCarve so the toolpath works with minimal editing.

## Designs affected
| Design | What's in the DXF now (draft) | Effect wanted |
| --- | --- | --- |
| Moulded frame, fluted | `MOULD` rectangle 75 mm in from the edge; pocket 22 mm further in; 8 mm flutes | A moulded frame round a fluted centre (Tim's white door photo) |
| Victorian | 8 mm pocket at a 70 mm border, plus a `MOULD` rectangle 20 mm inside the panel | A decorative moulding inside the panel |
| Ring and arc panel | Two shaped pockets, with `MOULD` on their edges and a centre ring | Moulded edges on the arcs and the centre ring (Tim's photo) |
| Beaded shaker | 8 mm pocket, plus a bead line 6 mm out on `BEAD_D3` | A bead round the inside of the frame |
| Arch-top beaded door | Three beads on `REED_D4`, at 30, 55 and 80 mm in | Three rounded beads following the arched outline |

## Things to establish (fill in as they're found)
- **Tim's VCarve version** (affects which moulding options exist): _
- **Round-over bits:** radius, cutting diameter, bearing or not, shank, any tip flat: _
- **Each effect wanted:** a photo or sketch of the cross-section, with the profile width and depth: _
- **The route for each design:** VCarve's Moulding toolpath (a profile swept along a drive rail and cut with raster passes, usually with a ball nose or tapered ball nose), **or** a 2D Profile toolpath with the round-over defined as a form tool in the tool database (the bit cuts its own shape in one pass). These are two different approaches. Which suits each design is the first thing to settle. _
- **Vectors VCarve needs:** a drive rail only, or a rail plus a profile vector, or two rails, and which side of the line the profile sits on: _
- **What went wrong on the first test board,** for each design: _

## Proven settings
(None yet. For each, record: design, toolpath type, bit, depths, passes, stepover, the vectors and layer names the DXF must contain, and a photo of the result.)

## Tools available
- `node scripts/test-board-dxf.js <folder>` writes all draft designs onto one 1220 x 500 mm offcut. Edit `PLAN` at the top to change which designs, sizes or positions.
- The recipes and layer names are in `public/js/engine.js` (`TOOLS` and `DESIGNS`).

## 25 Nov 2026 (main-line session): Beaded shaker on hold here
A rail + profile guess was tried on the main-line branch and withdrawn the same day: Tim said it still isn't right. The beaded shaker stays as the version-5 round-over line in `public/js/engine.js` on `main` until Tim has cut the beads test board from this lab (`test-boards/beads-test-board.zip` on branch `claude/fervent-ride-vmspcn`) and says which vectors and layers the website must write. Note: that branch's engine uses older layer names with tool names in them (e.g. `ROUNDOVER_FORM12_D5_16`); since 24 Nov layers are named by cut type and depth only, so rename when bringing the recipe across.
