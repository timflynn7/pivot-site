Pivot test board
Board 1220 x 500 mm. Parts use 1080 x 490 mm, 20 mm apart. Origin is the board's bottom-left corner.
Door sizes and frame widths are reduced for testing. Moulding, bead, flute and V-bit sizes are full size.

No | Design | Size (mm) | Position x, y (mm) | Test settings | Layers
1 | Beaded shaker | 200 x 235 | 0, 255 | border 50, leg 3 | CUTOUT_EM6, POCKET_EM6_D5_16, ROUNDOVER_FORM12_D5_16, MOULD_RAIL_BEAD12_D5_16, MOULD_PROFILE_BEAD12_D5_16
2 | Beaded shaker | 200 x 235 | 220, 255 | border 50, leg 5 | CUTOUT_EM6, POCKET_EM6_D5_16, ROUNDOVER_FORM12_D5_16, MOULD_RAIL_BEAD12_D5_16, MOULD_PROFILE_BEAD12_D5_16
3 | Beaded shaker | 200 x 235 | 440, 255 | border 50, leg 10 | CUTOUT_EM6, POCKET_EM6_D5_16, ROUNDOVER_FORM12_D5_16, MOULD_RAIL_BEAD12_D5_16, MOULD_PROFILE_BEAD12_D5_16
4 | Beaded shaker | 200 x 235 | 660, 255 | border 50, leg 5, pocket 6 | CUTOUT_EM6, POCKET_EM6_D6, ROUNDOVER_FORM12_D5_16, MOULD_RAIL_BEAD12_D5_16, MOULD_PROFILE_BEAD12_D5_16
5 | Beaded shaker | 200 x 235 | 880, 255 | border 50, leg 5, pocket 8 | CUTOUT_EM6, POCKET_EM6_D8, ROUNDOVER_FORM12_D5_16, MOULD_RAIL_BEAD12_D5_16, MOULD_PROFILE_BEAD12_D5_16
6 | Single bead shaker | 200 x 235 | 0, 0 | border 50, top 0 | CUTOUT_EM6, POCKET_EM6_D5_16, ROUNDOVER_FORM12_D5_16, MOULD_RAIL_SBEAD_FRAME_T0, MOULD_PROFILE_SBEAD_FRAME_T0, MOULD_RAIL_SBEAD_CORNER_T0, MOULD_PROFILE_SBEAD_CORNER_T0
7 | Single bead shaker | 200 x 235 | 220, 0 | border 50, top 1 | CUTOUT_EM6, POCKET_EM6_D6_16, ROUNDOVER_FORM12_D6_16, MOULD_RAIL_SBEAD_FRAME_T1, MOULD_PROFILE_SBEAD_FRAME_T1, MOULD_RAIL_SBEAD_CORNER_T1, MOULD_PROFILE_SBEAD_CORNER_T1
8 | Single bead shaker | 200 x 235 | 440, 0 | border 50, top 2 | CUTOUT_EM6, POCKET_EM6_D7_16, ROUNDOVER_FORM12_D7_16, MOULD_RAIL_SBEAD_FRAME_T2, MOULD_PROFILE_SBEAD_FRAME_T2, MOULD_RAIL_SBEAD_CORNER_T2, MOULD_PROFILE_SBEAD_CORNER_T2
9 | Single bead shaker | 200 x 235 | 660, 0 | border 50, top 1, pocket 8 | CUTOUT_EM6, POCKET_EM6_D8, ROUNDOVER_FORM12_D6_16, MOULD_RAIL_SBEAD_FRAME_T1, MOULD_PROFILE_SBEAD_FRAME_T1, MOULD_RAIL_SBEAD_CORNER_T1, MOULD_PROFILE_SBEAD_CORNER_T1

Layers
CUTOUT_EM6: 6 mm end mill, profile outside, with tabs
POCKET_EM6_D5_16: 6 mm end mill pocket, 5.16 mm deep
ROUNDOVER_FORM12_D5_16: 12.7 mm round-over form tool (R6.35 arc, 5.16 mm tall, pointed tip), 2D Profile ON the line, 5.16 mm deep
MOULD_RAIL_BEAD12_D5_16: Moulding toolpath corner rails (tapered ball nose, Create Sharp Corners on, Gap Above 0). Profile on MOULD_PROFILE_BEAD12_D5_16
MOULD_PROFILE_BEAD12_D5_16: Beaded shaker profile: round-over on the pocket edge and 12.7 mm out, 5.16 mm deep. Start point on the rail (pocket edge).
POCKET_EM6_D6: 6 mm end mill pocket, 6 mm deep
POCKET_EM6_D8: 6 mm end mill pocket, 8 mm deep
MOULD_RAIL_SBEAD_FRAME_T0: Moulding toolpath closed rail along the bead's centre, full length (tapered ball nose, Create Sharp Corners on, Gap Above 0). Profile on MOULD_PROFILE_SBEAD_FRAME_T0
MOULD_PROFILE_SBEAD_FRAME_T0: Single bead, frame side: bead top 0 below the face, round-over shape mirrored, 1 mm flat, wall. Start point on the rail (bead centre).
MOULD_RAIL_SBEAD_CORNER_T0: Moulding toolpath corner rails on the pocket edge (tapered ball nose, Create Sharp Corners on, Gap Above 0). Profile on MOULD_PROFILE_SBEAD_CORNER_T0
MOULD_PROFILE_SBEAD_CORNER_T0: Single bead, whole strip for the corners: round-over half 5.16 deep, then the frame side. Start point on the rail (pocket edge).
POCKET_EM6_D6_16: 6 mm end mill pocket, 6.16 mm deep
ROUNDOVER_FORM12_D6_16: 12.7 mm round-over form tool (R6.35 arc, 5.16 mm tall, pointed tip), 2D Profile ON the line, 6.16 mm deep
MOULD_RAIL_SBEAD_FRAME_T1: Moulding toolpath closed rail along the bead's centre, full length (tapered ball nose, Create Sharp Corners on, Gap Above 0). Profile on MOULD_PROFILE_SBEAD_FRAME_T1
MOULD_PROFILE_SBEAD_FRAME_T1: Single bead, frame side: bead top 1 below the face, round-over shape mirrored, 1 mm flat, wall. Start point on the rail (bead centre).
MOULD_RAIL_SBEAD_CORNER_T1: Moulding toolpath corner rails on the pocket edge (tapered ball nose, Create Sharp Corners on, Gap Above 0). Profile on MOULD_PROFILE_SBEAD_CORNER_T1
MOULD_PROFILE_SBEAD_CORNER_T1: Single bead, whole strip for the corners: round-over half 6.16 deep, then the frame side. Start point on the rail (pocket edge).
POCKET_EM6_D7_16: 6 mm end mill pocket, 7.16 mm deep
ROUNDOVER_FORM12_D7_16: 12.7 mm round-over form tool (R6.35 arc, 5.16 mm tall, pointed tip), 2D Profile ON the line, 7.16 mm deep
MOULD_RAIL_SBEAD_FRAME_T2: Moulding toolpath closed rail along the bead's centre, full length (tapered ball nose, Create Sharp Corners on, Gap Above 0). Profile on MOULD_PROFILE_SBEAD_FRAME_T2
MOULD_PROFILE_SBEAD_FRAME_T2: Single bead, frame side: bead top 2 below the face, round-over shape mirrored, 1 mm flat, wall. Start point on the rail (bead centre).
MOULD_RAIL_SBEAD_CORNER_T2: Moulding toolpath corner rails on the pocket edge (tapered ball nose, Create Sharp Corners on, Gap Above 0). Profile on MOULD_PROFILE_SBEAD_CORNER_T2
MOULD_PROFILE_SBEAD_CORNER_T2: Single bead, whole strip for the corners: round-over half 7.16 deep, then the frame side. Start point on the rail (pocket edge).

form-tool-roundover-12.7.dxf: right-hand half of the round-over bit (12.7 mm across, R6.35 arc 5.16 mm tall from a pointed tip, head 9 mm), to scale. Select it in VCarve, then Tool Database > new tool > type Form Tool.
