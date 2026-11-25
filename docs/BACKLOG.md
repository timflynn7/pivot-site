# Pivot Designs – backlog (25 Nov 2026)

One list of everything still open, in priority order. The detail stays in each workstream brief (linked). Tick items off here and in the brief when done.

## Now: the next two weeks

### 1a. Test panels in standard MDF first (Tim, 25 Nov 2026, proposed)
Before using MR MDF, cut one test sheet in standard MDF to prove the bits and depths.
- **DXF made 25 Nov 2026** (`node scripts/test-sheet-dxf.js <folder>`): nine **360 × 360** panels on 1200 × 1200, origin bottom-left. Columns at x 35 / 420 / 805 (35 mm side borders, 25 mm gaps); rows at y 820 / 420 / 20 (20 mm top and bottom borders, 40 mm gaps). Panels shrank from 370 to 360 so the three designs whose grooves overcut 10 mm past the top and bottom (Tongue & V, Tongue & bead, Reeded) sit in the middle row with room to spare. Standard settings for each design.
- Chosen so every cut layer is tested once: Skinny shaker (`POCKET_D5`), Bevelled (`POCKET_D8`, `BEVEL_D8`), Beaded (`ROUNDOVER`), New Country (`VGROOVE_D4`), Georgian (`POCKET_D4`), Tongue & V, Tongue & bead (`BEAD_D3`), Fluted (`FLUTE_D5`), Reeded (`REED_D4`).
- Left off: Slab (self-explanatory), Traditional shaker (its 8 mm pocket is tested by Bevelled, Beaded, New Country and Georgian), Arched (same reed bit as Reeded; already has a photo).
- Write down the depths and bits that look right; they replace the placeholders in `TOOLS` (item 5).

### 1b. Example doors in MR MDF to photograph
Seven designs need real photos (they show a computer render now): Traditional shaker, Skinny shaker, Bevelled shaker, Beaded shaker, Georgian, New Country, Tongue & V groove. Slab isn't needed (Tim, 25 Nov). Fluted, Reeded, Arched and Tongue & bead groove already have photos.

- **One door of each, 400 × 500 mm.** Four fit on a 1220 × 1220 half sheet (30 mm border, 25 mm gap), so all seven come from **one sheet of MR MDF (about £42)**, and every photo is the same shape.
- **Order them through the site** (/admin → New order) so the DXFs come from the real engine. That tests the whole route from configurator to VCarve at the same time.
- **Paint five, keep two bare** (one shaker, one Tongue & V) for close-ups of the machining and the 1.5 mm inside corners.
- Photograph with the checklist in [workstreams/website.md](workstreams/website.md) (side light, plain wall, same angle each time, one straight-on and one angled, one close-up).
- Send the photos here; Claude swaps them in for the renders and makes the thumbnails. Afterwards the doors can be showroom pieces for trade conversations (item 13).

### 2. Quick jobs for Tim (minutes each)
- ~~Stripe webhook `charge.refunded`~~ **Done 25 Nov 2026** (Pivot Hk-Live now listens to 3 events).
- Save the WhatsApp number on /admin/pricing if you want the button to show.
- ~~Address search~~ Paid search left off; **free postcode check built and live 25 Nov 2026** (confirms the postcode is real, tidies it, warns if not found).

## Next: once photos are in

3. **Swap renders for photos** on the Shop and home tiles; replace the soft home-page crops. [website.md](workstreams/website.md)
4. **Decide when to switch to Pay online.** Do one real purchase and refund first. [orders.md](workstreams/orders.md)
5. **Real depths and bits in `TOOLS`** from the sample batch; bump `VERSION` if geometry changes. [designs.md](workstreams/designs.md)
6. **A page per design** (photos, description, starting price, "Design this door" button). Good for Google once real photos exist. [website.md](workstreams/website.md)
7. **Reviews**: a simple way to ask customers for a review after delivery, and show them on the site.
8. **VAT check** with an accountant before prices are final. [business.md](workstreams/business.md)
9. **Watch the numbers**: Cloudflare Web Analytics and Google Search Console, monthly.

## Later

10. **Moulding and round-over designs**: work out the VCarve toolpaths in the toolpath lab. [toolpath-lab.md](workstreams/toolpath-lab.md)
10a. **"I can fit your handles" service** (Tim, 25 Nov 2026): customers choose handle or knob positions in the configurator and Tim drills the holes. To work out: handle types (one hole for knobs, two holes with a centre distance for bar handles), positions (edge distance, height, centred or offset), whether customers send their own handles or Tim supplies them, price per door, and how it goes on the DXF (like hinge holes: `LABELS` layer, or a drill layer). Needs wording in both payment modes and the terms.
10b. **Beaded shaker configurator** (Tim, 25 Nov 2026): choose the moulding style (other profiles from the toolpath-lab images), not just the frame width. First Tim tests the toolpath lab's beads test board (branch `claude/fervent-ride-vmspcn`) and feeds back which vectors the website must write; until then the beaded shaker DXF is unchanged.
11. **New test designs** (two-panel, vented, raised profile; full-height fluted like the wardrobe) on the test page first.
12. **Google Business Profile**: on hold until Tim decides on a business phone number. Guide already written. [business.md](workstreams/business.md)
13. **Trade portal** for local fitters: talk to 2 or 3 local trades first. [trade-portal.md](workstreams/trade-portal.md)
14. **Pricing by machining time** once VCarve time estimates exist; trade prices; bulk discounts. [business.md](workstreams/business.md)
15. **Pairs and runs**: one pattern across several doors with a set gap. [designs.md](workstreams/designs.md)
16. **Visualiser** ("See it in your room"). [visualiser.md](workstreams/visualiser.md)
17. **Live courier quotes** (oversize doors make this harder). [orders.md](workstreams/orders.md)
18. **Order backups/export** from /admin (Render keeps daily database backups meanwhile).
19. Consider opting out of Etsy Offsite Ads (private business decision; nothing on the website).
