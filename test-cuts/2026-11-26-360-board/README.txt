Pivot experiment board, 360 x 360 mm, 18 mm MDF (standard, not MR)
Origin (X0 Y0): the board's bottom-left corner. Z zero: the top of the board.
If the board is still part of the 1200 x 1200 sheet, either zero on its bottom-left corner,
or in VCarve select everything and move it so BOARD_EDGE_NOCUT sits over the uncut square.
Layer names: T01.. = test number. D2_5 = 2.5 mm deep. FLOOR = below that test's pocket floor
(VCarve: start depth = the pocket depth, cut depth = the figure). Pass depths are up to you.
Cut pockets before the V-grooves that sit in them. Do not cut LABELS or BOARD_EDGE_NOCUT.

T01 corner 1/8in (cell x 10-87, y 271-348): 55 x 55 mm pocket, 8 mm deep. Cut it all with the 1/8 in downcut, as on the Georgian. Measure the corners.
T02 corner 2mm (cell x 97-174, y 271-348): The same pocket. Cut it all with the 2 mm straight bit.
T03 corner 6+2mm (cell x 184-261, y 271-348): The same pocket. VCarve Pocket toolpath with 'Use larger clearance tool': 6 mm bit clears, 2 mm bit does the edges and corners.
T04 slots (cell x 271-348, y 271-348): Four 55 mm slots, 3 mm deep, one pass each. A = 1/8 in downcut, B = 2 mm straight, C = 6 mm, D = 90 degree V-bit. Measure each slot's width with calipers and put it in the tool library. The V slot should be exactly 6.0 mm wide at 3 mm deep; if not, the angle, tip or Z zero is off.
T05 bevel 4mm (cell x 10-87, y 184-261): Bevelled shaker at half depth: bevel line (top of the bevel) and a pocket 4 mm inside it, 4 mm deep. V-bit along the bevel line, profile inside, 2 mm passes.
T06 bevel 8mm (cell x 97-174, y 184-261): Bevelled shaker as the website draws it: pocket 8 mm inside the bevel line, 8 mm deep. V-bit in 2-3 mm passes. Compare with T05, measuring each bevel's width on a straight side (should equal its depth) and the corner overshoot: if both errors double from T05 to T06, the V-bit's angle in the library is off; if they stay the same, it's Z depth.
T07 beaded lip (cell x 184-261, y 184-261): Beaded shaker: 45 x 45 mm pocket 8 mm deep with the round-over rail on the same line. Try the moulding profile overlapping the line by 0.2-0.3 mm and 0.1 mm below the floor, OR a 2 mm tidy-up profile on the line at 8 mm with a -0.2 mm allowance. Note which.
T08 v ladder face (cell x 271-348, y 184-261): Tongue & V depth ladder on the face: 90 degree V-grooves 1.5, 2, 2.5 and 3 mm deep (3, 4, 5, 6 mm wide), left to right.
T09 nc 8mm ladder (cell x 10-87, y 97-174): New Country, 8 mm pocket (59 x 59). Four V-grooves running right up to the wall, 1.5, 2, 2.5, 3 mm below the floor (start depth 8 in VCarve). Shows the notch in the frame wall at each depth.
T10 nc 6mm stops (cell x 97-174, y 97-174): New Country, 6 mm pocket. Three V-grooves 2 mm below the floor (start depth 6). Left: run to the wall. Middle: stop 3.2 mm short (the radius of a 1/4 in bit). Right: stop 6.4 mm short (1/2 in bit). Cut with the V-bit you'd use for real and see which ends look right.
T11 nc 5mm (cell x 184-261, y 97-174): New Country, 5 mm pocket. Three V-grooves 2 mm below the floor (start depth 5), running to the wall. Compare the look with T09 (8 mm) and T10 (6 mm).
T12 reed depth (cell x 271-348, y 97-174): Reed bit depth ladder: three grooves 4, 4.5 and 5 mm deep, left to right. Find where the shoulder starts to touch. Try 2-stage passes on the 5 mm one.
T13 t&b 12.5 (cell x 10-87, y 10-87): Tongue & bead as proposed: V-groove (2 mm, change to the depth T08 picks) with the bead line 12.5 mm to its right, cut with the reed bit at 5 mm (or the depth T12 picks). Two pairs.
T14 reeded edge (cell x 97-174, y 10-87): Reeded with the lines carried past both side edges (12.5 mm apart, centred, plus one more each side while the 12.7 mm bit still touches the panel). Order: 1 facing pass 0.5 mm over the FACING box, 2 reeds at 4 mm (or T12's depth), 3 cut out the 55 x 55 panel on CUTOUT with tabs, or saw it out, to see the edge reeds.
T15 spare (cell x 184-261, y 10-87): Spare for a re-test.
T16 spare (cell x 271-348, y 10-87): Spare for a re-test (e.g. fluted, once the bit and spacing are confirmed).

Write down for each test: bit, depth, passes, and what you measured or saw.
