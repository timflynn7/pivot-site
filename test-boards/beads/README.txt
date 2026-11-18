Pivot test board
Board 1220 x 500 mm. Parts use 860 x 490 mm, 20 mm apart. Origin is the board's bottom-left corner.
Door sizes and frame widths are reduced for testing. Moulding, bead, flute and V-bit sizes are full size.

No | Design | Size (mm) | Position x, y (mm) | Test settings | Layers
1 | Beaded shaker | 200 x 235 | 0, 255 | border 50, leg 3 | CUTOUT_EM6, POCKET_EM6_D8, ROUNDOVER_FORM12_D4_7, MOULD_RAIL_BEAD12_D4_7, MOULD_PROFILE_BEAD12_D4_7
2 | Beaded shaker | 200 x 235 | 220, 255 | border 50, leg 5 | CUTOUT_EM6, POCKET_EM6_D8, ROUNDOVER_FORM12_D4_7, MOULD_RAIL_BEAD12_D4_7, MOULD_PROFILE_BEAD12_D4_7
3 | Beaded shaker | 200 x 235 | 440, 255 | border 50, leg 10 | CUTOUT_EM6, POCKET_EM6_D8, ROUNDOVER_FORM12_D4_7, MOULD_RAIL_BEAD12_D4_7, MOULD_PROFILE_BEAD12_D4_7
4 | Beaded shaker | 200 x 235 | 660, 255 | border 50, leg 5, depth 5 | CUTOUT_EM6, POCKET_EM6_D8, ROUNDOVER_FORM12_D5, MOULD_RAIL_BEAD12_D5, MOULD_PROFILE_BEAD12_D5
5 | Single bead shaker | 200 x 235 | 0, 0 | border 50, top 0, floor 6 | CUTOUT_EM6, POCKET_EM6_D6, MOULD_RAIL_SBEAD_R4_7, MOULD_PROFILE_SBEAD_R4_7
6 | Single bead shaker | 200 x 235 | 220, 0 | border 50, top 1, floor 6 | CUTOUT_EM6, POCKET_EM6_D6, MOULD_RAIL_SBEAD_R4_7, MOULD_PROFILE_SBEAD_R4_7
7 | Single bead shaker | 200 x 235 | 440, 0 | border 50, top 1.3, floor 8 | CUTOUT_EM6, POCKET_EM6_D8, MOULD_RAIL_SBEAD_R4_7, MOULD_PROFILE_SBEAD_R4_7

Layers
CUTOUT_EM6: 6 mm end mill, profile outside, with tabs
POCKET_EM6_D8: 6 mm end mill pocket, 8 mm deep
ROUNDOVER_FORM12_D4_7: 12.7 mm round-over form tool (4.7 mm radius), 2D Profile ON the line, 4.7 mm deep
MOULD_RAIL_BEAD12_D4_7: Moulding toolpath corner rails (tapered ball nose, Create Sharp Corners on, Gap Above 0). Profile on MOULD_PROFILE_BEAD12_D4_7
MOULD_PROFILE_BEAD12_D4_7: Beaded shaker profile: round-over lines 6.35 and 19.05 mm out from the pocket, 4.7 mm deep. Start point on the rail (pocket edge).
ROUNDOVER_FORM12_D5: 12.7 mm round-over form tool (4.7 mm radius), 2D Profile ON the line, 5 mm deep
MOULD_RAIL_BEAD12_D5: Moulding toolpath corner rails (tapered ball nose, Create Sharp Corners on, Gap Above 0). Profile on MOULD_PROFILE_BEAD12_D5
MOULD_PROFILE_BEAD12_D5: Beaded shaker profile: round-over lines 6.35 and 19.05 mm out from the pocket, 5 mm deep. Start point on the rail (pocket edge).
POCKET_EM6_D6: 6 mm end mill pocket, 6 mm deep
MOULD_RAIL_SBEAD_R4_7: Moulding toolpath closed rail, full length (tapered ball nose finish, 6 mm end mill as Larger Area Clearance Tool, Create Sharp Corners on, Gap Above 0). Profile on MOULD_PROFILE_SBEAD_R4_7
MOULD_PROFILE_SBEAD_R4_7: Single bead profile: 4.7 mm radius half-round bead, its top and the field depth as noted beside it. Start point on the rail (pocket edge).

form-tool-roundover-12.7-R4.7.dxf: right-hand half of the round-over bit (12.7 mm across, 4.7 mm radius, flat tip 3.3 mm across), to scale. Select it in VCarve, then Tool Database > new tool > type Form Tool.
