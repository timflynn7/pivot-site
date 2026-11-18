Pivot test board
Board 1220 x 500 mm. Parts use 1080 x 490 mm, 20 mm apart. Origin is the board's bottom-left corner.
Door sizes and frame widths are reduced for testing. Moulding, bead, flute and V-bit sizes are full size.

No | Design | Size (mm) | Position x, y (mm) | Test settings | Layers
1 | Beaded shaker | 200 x 235 | 0, 255 | border 50, leg 3 | CUTOUT_EM6, POCKET_EM6_D6, ROUNDOVER_FORM12_D4_7, MOULD_RAIL_BEAD12_D4_7, MOULD_PROFILE_BEAD12_D4_7
2 | Beaded shaker | 200 x 235 | 220, 255 | border 50, leg 5 | CUTOUT_EM6, POCKET_EM6_D6, ROUNDOVER_FORM12_D4_7, MOULD_RAIL_BEAD12_D4_7, MOULD_PROFILE_BEAD12_D4_7
3 | Beaded shaker | 200 x 235 | 440, 255 | border 50, leg 10 | CUTOUT_EM6, POCKET_EM6_D6, ROUNDOVER_FORM12_D4_7, MOULD_RAIL_BEAD12_D4_7, MOULD_PROFILE_BEAD12_D4_7
4 | Beaded shaker | 200 x 235 | 660, 255 | border 50, leg 5, pocket level | CUTOUT_EM6, POCKET_EM6_D4_7, ROUNDOVER_FORM12_D4_7, MOULD_RAIL_BEAD12_D4_7, MOULD_PROFILE_BEAD12_D4_7
5 | Beaded shaker | 200 x 235 | 880, 255 | border 50, leg 5, pocket 8 | CUTOUT_EM6, POCKET_EM6_D8, ROUNDOVER_FORM12_D4_7, MOULD_RAIL_BEAD12_D4_7, MOULD_PROFILE_BEAD12_D4_7
6 | Single bead shaker | 200 x 235 | 0, 0 | border 50, top 0 | CUTOUT_EM6, POCKET_EM6_D6, ROUNDOVER_FORM12_D4_7, MOULD_RAIL_SBEAD_FRAME_T0, MOULD_PROFILE_SBEAD_FRAME_T0, MOULD_RAIL_SBEAD_CORNER_T0, MOULD_PROFILE_SBEAD_CORNER_T0
7 | Single bead shaker | 200 x 235 | 220, 0 | border 50, top 1 | CUTOUT_EM6, POCKET_EM6_D6, ROUNDOVER_FORM12_D5_7, MOULD_RAIL_SBEAD_FRAME_T1, MOULD_PROFILE_SBEAD_FRAME_T1, MOULD_RAIL_SBEAD_CORNER_T1, MOULD_PROFILE_SBEAD_CORNER_T1
8 | Single bead shaker | 200 x 235 | 440, 0 | border 50, top 1, pocket level | CUTOUT_EM6, POCKET_EM6_D5_7, ROUNDOVER_FORM12_D5_7, MOULD_RAIL_SBEAD_FRAME_T1, MOULD_PROFILE_SBEAD_FRAME_T1, MOULD_RAIL_SBEAD_CORNER_T1, MOULD_PROFILE_SBEAD_CORNER_T1
9 | Single bead shaker | 200 x 235 | 660, 0 | border 50, top 1, pocket 8 | CUTOUT_EM6, POCKET_EM6_D8, ROUNDOVER_FORM12_D5_7, MOULD_RAIL_SBEAD_FRAME_T1, MOULD_PROFILE_SBEAD_FRAME_T1, MOULD_RAIL_SBEAD_CORNER_T1, MOULD_PROFILE_SBEAD_CORNER_T1
10 | Beaded shaker | 200 x 235 | 880, 0 | border 50, leg 5, depth 5 | CUTOUT_EM6, POCKET_EM6_D6, ROUNDOVER_FORM12_D5, MOULD_RAIL_BEAD12_D5, MOULD_PROFILE_BEAD12_D5

Layers
CUTOUT_EM6: 6 mm end mill, profile outside, with tabs
POCKET_EM6_D6: 6 mm end mill pocket, 6 mm deep
ROUNDOVER_FORM12_D4_7: 12.7 mm round-over form tool (4.7 mm radius), 2D Profile ON the line, 4.7 mm deep
MOULD_RAIL_BEAD12_D4_7: Moulding toolpath corner rails (tapered ball nose, Create Sharp Corners on, Gap Above 0). Profile on MOULD_PROFILE_BEAD12_D4_7
MOULD_PROFILE_BEAD12_D4_7: Beaded shaker profile: round-over on the pocket edge and 12.7 mm out, 4.7 mm deep. Start point on the rail (pocket edge).
POCKET_EM6_D4_7: 6 mm end mill pocket, 4.7 mm deep
POCKET_EM6_D8: 6 mm end mill pocket, 8 mm deep
MOULD_RAIL_SBEAD_FRAME_T0: Moulding toolpath closed rail along the bead's centre, full length (tapered ball nose, Create Sharp Corners on, Gap Above 0). Profile on MOULD_PROFILE_SBEAD_FRAME_T0
MOULD_PROFILE_SBEAD_FRAME_T0: Single bead, frame side: bead top 0 below the face, 4.7 radius, 1 mm flat, wall. Start point on the rail (bead centre).
MOULD_RAIL_SBEAD_CORNER_T0: Moulding toolpath corner rails on the pocket edge (tapered ball nose, Create Sharp Corners on, Gap Above 0). Profile on MOULD_PROFILE_SBEAD_CORNER_T0
MOULD_PROFILE_SBEAD_CORNER_T0: Single bead, whole strip for the corners: round-over half 4.7 deep, then the frame side. Start point on the rail (pocket edge).
ROUNDOVER_FORM12_D5_7: 12.7 mm round-over form tool (4.7 mm radius), 2D Profile ON the line, 5.7 mm deep
MOULD_RAIL_SBEAD_FRAME_T1: Moulding toolpath closed rail along the bead's centre, full length (tapered ball nose, Create Sharp Corners on, Gap Above 0). Profile on MOULD_PROFILE_SBEAD_FRAME_T1
MOULD_PROFILE_SBEAD_FRAME_T1: Single bead, frame side: bead top 1 below the face, 4.7 radius, 1 mm flat, wall. Start point on the rail (bead centre).
MOULD_RAIL_SBEAD_CORNER_T1: Moulding toolpath corner rails on the pocket edge (tapered ball nose, Create Sharp Corners on, Gap Above 0). Profile on MOULD_PROFILE_SBEAD_CORNER_T1
MOULD_PROFILE_SBEAD_CORNER_T1: Single bead, whole strip for the corners: round-over half 5.7 deep, then the frame side. Start point on the rail (pocket edge).
POCKET_EM6_D5_7: 6 mm end mill pocket, 5.7 mm deep
ROUNDOVER_FORM12_D5: 12.7 mm round-over form tool (4.7 mm radius), 2D Profile ON the line, 5 mm deep
MOULD_RAIL_BEAD12_D5: Moulding toolpath corner rails (tapered ball nose, Create Sharp Corners on, Gap Above 0). Profile on MOULD_PROFILE_BEAD12_D5
MOULD_PROFILE_BEAD12_D5: Beaded shaker profile: round-over on the pocket edge and 12.7 mm out, 5 mm deep. Start point on the rail (pocket edge).

form-tool-roundover-12.7-R4.7.dxf: right-hand half of the round-over bit (12.7 mm across, 4.7 mm radius, flat tip 3.3 mm across), to scale. Select it in VCarve, then Tool Database > new tool > type Form Tool.
