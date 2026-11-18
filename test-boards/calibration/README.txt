Round-over calibration strip

Depth ladder (top row): one groove per depth, 2D Profile ON the line.

Strip 300 x 200 mm of 18 mm MDF. Origin bottom-left.

Toolpaths (round-over form tool, 2D Profile, ON the line, Start Depth 0):
  ROUNDOVER_FORM12_D4: Cut Depth 4
  ROUNDOVER_FORM12_D4_5: Cut Depth 4.5
  ROUNDOVER_FORM12_D4_7: Cut Depth 4.7
  ROUNDOVER_FORM12_D5: Cut Depth 5
  ROUNDOVER_FORM12_D5_16: Cut Depth 5.16
  ROUNDOVER_FORM12_D5_5: Cut Depth 5.5
  ROUNDOVER_FORM12_D6: Cut Depth 6
  ROUNDOVER_FORM12_D6_5: Cut Depth 6.5
  The spacing ladder is also on ROUNDOVER_FORM12_D5_16.
  CUTOUT_EM6: cut the strip out. SAW_LINE_NOT_CUT and LABELS: do not cut.

Before cutting: zero Z on the strip itself, next to the grooves. Measure the MDF thickness at a few points.

After cutting:
1. Measure each groove's real depth (caliper depth rod) before sawing. Write it next to the programmed depth.
2. Saw the strip across along both red lines, square and clean.
3. Sand the sawn faces lightly (fine paper on a flat block) so the edges of the grooves are crisp.
4. Lay the sawn faces on a flatbed scanner with a steel rule beside them and scan at 600 dpi or more.
   (Or photograph straight down from about 50 cm, phone zoomed in, the rule in the same plane as the cut face.)
5. For each depth ladder groove, measure: width at the face, width of the flat at the bottom, depth.
6. For the spacing ladder, note which pair gives a round bead with no flat on top, and whether the top reaches the face.
7. Measure the bit with calipers: the widest diameter across the cutting edges, the cutting height, the width of the tip.
Send the scans/photos and the numbers to Claude. The engine's bit model and the VCarve form tool are then rebuilt from them.
