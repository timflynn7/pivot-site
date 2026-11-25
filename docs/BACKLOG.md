# Pivot Designs – backlog (25 Nov 2026)

One list of everything still open, in priority order. The detail stays in each workstream brief (linked). Tick items off here and in the brief when done.

## Now: the next two weeks

### 1. Make example doors to photograph (Tim, new 25 Nov 2026)
Eight designs on the Shop have no real photo yet and show a computer render instead:
Slab, Traditional shaker, Skinny shaker, Bevelled shaker, Beaded shaker, Georgian, New Country, Tongue & V groove.
(Fluted, Reeded, Arched and Tongue & bead groove already have photos.)

Suggested batch:
- **One door of each, 400 × 500 mm.** Four fit on a 1220 × 1220 half sheet (30 mm border, 25 mm gap), so all eight come from **one sheet of MR MDF (about £42)**, and every photo is the same shape.
- **Order them through the site** (/admin → New order) so the DXFs come from the real engine. That tests the whole route from configurator to VCarve at the same time.
- **Write down the real depths and bits** that look right as you cut. Those replace the placeholder figures in `TOOLS` (item 5), so this one batch does two jobs.
- **Paint six, keep two bare** (one shaker, one Tongue & V) for close-ups of the machining and the 1.5 mm inside corners.
- Photograph with the checklist in [workstreams/website.md](workstreams/website.md) (side light, plain wall, same angle each time, one straight-on and one angled, one close-up).
- Send the photos here; Claude swaps them in for the renders and makes the thumbnails. Afterwards the doors can be showroom pieces for trade conversations (item 13).

### 2. Quick jobs for Tim (minutes each)
- Stripe → Developers → Webhooks → your endpoint → add the event `charge.refunded` (so refunds mark the order automatically). [orders.md](workstreams/orders.md)
- Save the WhatsApp number on /admin/pricing if you want the button to show.
- Try the address search on the live Shop once; if suggestions don't appear, tell Claude (the field names were written from memory).

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
11. **New test designs** (two-panel, vented, raised profile; full-height fluted like the wardrobe) on the test page first.
12. **Google Business Profile**: on hold until Tim decides on a business phone number. Guide already written. [business.md](workstreams/business.md)
13. **Trade portal** for local fitters: talk to 2 or 3 local trades first. [trade-portal.md](workstreams/trade-portal.md)
14. **Pricing by machining time** once VCarve time estimates exist; trade prices; bulk discounts. [business.md](workstreams/business.md)
15. **Pairs and runs**: one pattern across several doors with a set gap. [designs.md](workstreams/designs.md)
16. **Visualiser** ("See it in your room"). [visualiser.md](workstreams/visualiser.md)
17. **Live courier quotes** (oversize doors make this harder). [orders.md](workstreams/orders.md)
18. **Order backups/export** from /admin (Render keeps daily database backups meanwhile).
19. Consider opting out of Etsy Offsite Ads (private business decision; nothing on the website).
