# Workstream 1: Website content and layout

## Goal
A site that makes a visitor want to order: clear about what Pivot makes, shows the doors well, builds trust, and leads to the configurator.

## Status (24 Nov 2026: see Changes on 24 Nov below)
- Live at https://pivotdesigns.co.uk on Render, with the domain and HTTPS working.
- Pages: Home (`public/index.html`), Our story (`story.html`), Contact (`contact.html`), Design your door (`configurator.html`, in the menu, test version), 404.
- Visual style: chalk background, Jost headings, Inter body text, sage green buttons, MDF tan accents (`public/css/site.css`).
- Photos: the 5 Etsy product photos in `public/img/` are crops from an Etsy screenshot, so they're soft. They should be replaced with Tim's originals (same file names).
- Story page now uses Tim's own Etsy About text (20 Nov 2026): self-taught CNC, small-space furniture, plans for fold-away desks and beds and parametric art. Workshop: Surrey, garden-based (don't say "garden" publicly unless Tim wants it).
- Home page has an FAQ built from Tim's Etsy listing FAQs (unfinished MDF, what's included, sizes, measuring, 5–7 working days, custom icons and lettering, delivery, returns).

## Decisions
- Main call to action: Design your door (configurator). Etsy stays as a second route.
- AI-rendered images can fill gaps where there are no photos, but **must be labelled as illustrations** and replaced with real photos over time.
- Prices are shown as provisional until pricing is settled (see business.md).

## Open questions for Tim
- Which real photos exist (test cuts, installs, Etsy originals) and where they are.
- Should each design get its own page (photos, description, starting price, "design this door" button)?
- Customer reviews or testimonials to use (Etsy has 5.0 from 4 reviews).

## Content changes (20 Nov 2026, second round)
- **No Etsy anywhere on the site** (Tim's decision: Etsy takes a large cut). Removed the header "Shop on Etsy" button (briefly replaced by "Get a price", then removed as a duplicate of "Design your door"; the header is now just logo + Home, Design your door, Our story, Contact on every page), the hero "Order on Etsy", footer links, the contact page line, the story mention and the terms mention. The home page fact now reads "rated by our customers" (the 5.0 rating is from 4 Etsy reviews; Tim may want to drop it or add reviews collected directly).
- Home "The range" no longer gives a number of designs. It shows a few favourites, linking to the full range in the configurator.
- The configurator no longer says hinge holes are drilled by hand.

## Decisions (20 Nov 2026, resolved from Etsy differences)
- Website size limits are now 300–1000 × 300–1200 mm (engine `LIMITS`). The machine takes 1200 × 1200 sheets, and 1000 × 1200 is the largest Tim can hold down. Etsy's 600 × 1150 figures are just his pricing buckets. A provisional **Extra large £80** band covers anything over 600 × 1150; Tim to set the real price.
- Hinge holes are advertised as a service (FAQ, terms section 2).
- Business address for the legal pages: 61 Bridge Street, Kington, HR5 3DJ. Never the home address.
- Etsy photos are still needed (originals, and which are real photos vs renders).

## Next tasks
1. Content plan per page: purpose, sections, copy, photos, and where AI renders are needed.
2. AI render prompts for the designs with no photos, using the engine's preview drawings as reference images. Tim generates them in an image tool (ChatGPT, Gemini, Firefly, Midjourney).
3. Design pages (one per design, or a gallery) linking into the configurator with that design selected (e.g. `/configurator?design=victorian`, not built yet).
4. Real story copy once Tim provides the facts.
5. **Terms and privacy pages: written 20 Nov 2026** (`public/terms.html`, `public/privacy.html`), with Tim's answers: sole trader; bare MDF; ±1 mm; mainland GB (other areas ask first); check on delivery and report transit damage within 48 hours with photos, with no transport-damage claims once doors are painted, cut, drilled or fitted (statutory rights for hidden faults kept); cancel after payment before cutting = refund less reasonable costs, capped at 50%; prices valid 30 days and can be withdrawn before payment; unpaid requests archived after 30 days, deleted after 2 years. Linked from every footer, the order form, the pay page and the emails. Published address: 61 Bridge Street, Kington, HR5 3DJ (a geographic address is legally required; a PO box isn't enough).
6. Basic SEO: page titles and descriptions, Google Business Profile link, a sitemap. Remove `noindex` from the configurator when it's ready.

## Changes on 24 Nov 2026 (from Tim's notes, on branch `claude/pensive-planck-hlap0l`)
- **Menu**: "Design your door" is now **Shop** in every page header. The configurator page heading stays "Design your door".
- **Terms**: "confirmed quote, which remains valid for 30 days". Section 1 now says Surrey workshop + email; the sole-trader name and Kington address moved to a small "Business details" line at the end (it can't be removed: the E-Commerce Regulations 2002 need a geographic address). The privacy page still names the address in its first paragraph; Tim hasn't asked to change that.
- **Home**: Engraved icon tile, the engraving FAQ sentence and the "own icon or lettering" FAQ removed. `public/img/icon.jpg` is no longer used.
- **Our story**: rewritten without the DIY and self-taught background (precision CNC, technology and automation background, test boards, every order checked, Surrey workshop). Tim to check the wording.
- **Configurator**:
  - Door name field removed (the engine still accepts names, so old orders keep theirs).
  - The name and address form is hidden until the list has a door and the customer presses **Continue to your details**.
  - The hinge-hole note only shows when hinges are chosen.
  - **Show measurements** tick box overlays frame widths, rails, margins, spacing, arch position and hinge distances (each design's `dims` in engine.js).
  - Pocketed designs show the recess depth and the 3 mm inside-corner radius (`designNote` in engine.js, from the tool's `depth` and width).
  - **Picture carousel** per design, hidden while a design has no pictures. See "Adding pictures" below.
- **Test page** `/test-designs` (not linked, noindex): the configurator showing every design, tagged Archived, Draft or Test only, with Download test DXF and no ordering. Designs marked `lab: true` in engine.js appear only there and are refused for orders.

### Adding pictures to a design (for now)
1. Put the image in `public/img/designs/` (GitHub: open the folder → Add file → Upload files). JPEG, about 1200 px wide, 4:3 looks best.
2. Edit `public/data/design-images.json` (GitHub: pencil icon). Example:
```json
{
  "shaker": [
    { "src": "/img/designs/shaker-kitchen.jpg", "caption": "Painted shaker doors in a kitchen" },
    { "src": "/img/designs/shaker-render.jpg", "caption": "Shaker in sage green", "illustration": true },
    { "src": "/img/designs/shaker-corner.jpg", "caption": "Close-up of an inside corner" }
  ]
}
```
The key is the design id (slab, shaker, skinny, bevelled, beaded, newcountry, georgian, tvgroove, tbgroove, fluted, reeded, lattice, arched). `"illustration": true` adds the Illustration label, which **must** be set on every AI render. Committing to `main` publishes it.
A later option: upload and edit pictures from /admin. That needs file storage that survives deploys (e.g. in the database or a storage bucket).

## Test wording removed (24 Nov 2026)
The yellow "Test version, prices provisional" bar is gone from the Shop (it only shows on /test-designs, which the server now marks noindex with an X-Robots-Tag header). "Estimated total" is now "Total", the quote-mode hint says "We check every order and confirm the price, including delivery, before you pay", the terms no longer call design-time prices estimates, and the customer email says "Total". The Shop page no longer has `noindex`, so search engines can list it. Admin-only notices (test mode, temporary storage) are unchanged; they only appear when they're true.

## Basket wording (24 Nov 2026)
The Shop calls the door list the **basket** in both payment modes: "Add to basket", "Your basket", "Your basket is empty…", and the home, contact and privacy pages match. Admin pages still say "door list" (internal).

## Photos added (24 Nov 2026)
Tim's own photos (real, so no Illustration label), resized to at most 1600 px, compressed, no camera data, in `public/img/designs/` and listed in `public/data/design-images.json`:
- Fluted: painted fitted wardrobe (full-height flutes) and a bare MDF door with stopped flutes.
- Arched: a painted pair.
- Reeded: a panel on the machine bed.
- Tongue & bead groove: two tall unpainted panels (cropped to leave out a wave-pattern panel that isn't offered).
The arched photo was cropped to leave out a lattice panel (archived). The carousel now shows whole photos (no cropping of tall ones), and the drawing shrinks a little when a design has photos so the preview fits a laptop screen.
**Update, same day (Tim's feedback):** the painted wardrobe (full-height flutes, a style the Shop doesn't offer yet) is on the home page only, not in the Shop. New photo `fluted-doors-selection.jpg` (three fluted doors, Tim's most popular design) is the home page's main image and the first Fluted photo in the Shop. Home range tiles: wardrobe (Fluted), reeded on the machine, arched pair, tongue & bead; story page: bare fluted door and the reeded panel. The old soft Etsy crops (`public/img/arched|fluted|reeded|lattice|icon.jpg`) are deleted. Web-sized copies for the home and story pages are in `public/img/`; full-size ones in `public/img/designs/`, each with a 160 px `-thumb.jpg`.
**Shop photo layout:** thumbnails under the drawing; clicking one opens a pop-up (native `<dialog>`) with the full photo, caption, arrows (and keyboard arrows), closed by ×, Esc or a click outside. A photo without a `-thumb.jpg` falls back to the full image.
**Renders (24 Nov 2026):** Tim asked for AI renders of the designs without photos. No AI image tool is available here, so Claude made computer renders from the exact cutting geometry instead (`scripts/render-geometry.js` + `scripts/render_designs.py`): Slab (warm white), Traditional shaker (sage) plus an inside-corner close-up showing the 1.5 mm radius, Skinny shaker (navy), Bevelled (stone), Beaded (deep green), New Country (cream, exact 80 mm boards), Georgian (putty grey), Tongue & V groove (blue grey). Badged "Render" in the Shop. Tim can still add AI lifestyle images later with `"illustration": true`.
Superseded list. Still wanted: shaker family, Georgian, New Country, Tongue & V groove, slab, inside-corner close-ups, and better originals for the home page (`public/img/*.jpg` are soft Etsy crops).

## Home page photo layout (24 Nov 2026)
Tim said the home photos were too large and uneven. Now: the main photo is square, capped at 480 px tall so it sits level with the text (4:3 on phones); the range uses four matching square tiles, each a hand-picked 640 × 640 crop of the design itself (`public/img/tile-fluted|reeded|arched|tongue-and-bead.jpg`, made from Tim's originals). New range photos should get the same treatment: a square crop of the pattern, 640 px.

## Polish and accessibility review (24 Nov 2026)
Checked every public page plus the sign-in page with axe-core (WCAG 2.1 AA and best practice), on desktop and an iPhone-sized screen, plus keyboard use and tap-target sizes by hand.
Fixed:
- Gold text (eyebrow labels, step numbers) was 2.8:1 contrast; now `--tan-ink` #805C2A (4.7:1 or better on every background). The lighter `--tan` stays for lines.
- "Skip to content" link on every page (first Tab stop); `<main id="main">`.
- Contact: "For a quick price, send us" is an h2 (was h3 straight after h1).
- WhatsApp button inside an `<aside aria-label="Chat with us">`.
- Shop page has a meta description.
- Width and height fields are linked to their error messages (`aria-describedby`).
- Bigger touch targets: footer links, Remove buttons, slider handles, the measurements tick box.
Result: no axe violations left. Remaining "small" targets are links inside sentences (allowed) and the hidden anti-spam field.
Already fine: one h1 per page, alt text on every image, labelled form fields, visible focus outlines, no sideways scrolling on phones, the photo pop-up moves focus in and back out, reduced-motion respected.
Tim removed the "5.0 ★ rated by our customers" fact (no way to collect reviews on this site yet); it's replaced by "5–7 days" dispatch. Possible later task: a way for customers to leave reviews. Done at Tim's request: the Contact card says "Workshop: Surrey, delivering UK-wide", and the home page button says "Shop", matching the menu.

## Shop on phones (24 Nov 2026)
Tim found the phone layout meant scrolling up and down: the preview took 621 px, the design grid 831 px, and the options started 2291 px down (screen 664 px). Built his chosen fixes 1–5 for screens up to 900 px: pinned compact preview (drawing about a quarter of the screen tall, with price and a "Photos (n)" button), one-row swipeable design picker that centres the chosen design, a fixed bottom bar (price, Add to basket with "Added ✓", "Basket (n) · £total" link) that hides when the basket section is visible, width and height side by side, one-line intro. Options now start at 965 px and the page is 37% shorter. Desktop unchanged.
Tim's follow-up: fields were hidden under the pinned preview when editing, and the bar hiding itself near the basket was confusing. Now the bar never hides (footer padded to clear it); while typing in any box the drawing shrinks to a strip and the box is scrolled into the space between the preview and the bar, checked with a simulated keyboard (viewport 374 px tall).

## Style directions (24 Nov 2026; Tim chose C on 25 Nov, now live)
Tim felt the site looks "AI generic" (small caps eyebrow + big heading + grey paragraph + green button + cards; Jost/Inter). Three home-page mock-ups on a private design canvas, using his real photos: https://claude.ai/artifact/XAqw4JbiDtuQ93iN57bUri
- A · Workshop precision: Archivo + IBM Plex Mono, paper/ink with a rust accent, a fluted door that draws itself line by line, spec table, groove-line divider, the range as a numbered index (D-01…), dark "how it's made" band.
- B · Editorial gallery: Instrument Serif + Hanken Grotesk, full-bleed hero photo with a large serif headline, statement line, asymmetric gallery, deep green panel, few boxes.
- C · Blend (recommended): serif headings + clean body + mono spec details, photo with dimension lines drawn over it, square range tiles with mono specs, deep green arched-pair band, mono-numbered steps.
**Rolled out 25 Nov 2026:** new fonts, colours, pill buttons, mono spec labels and light footer across every page through `site.css` (Shop, terms, privacy, story, contact, 404 and the payment pages included); "Pivot" serif wordmark everywhere (emails too). Home rebuilt to match C: serif headline "Made to measure, to the millimetre.", mono spec line (prices filled from /api/pricing), photo with measurement lines that draw in, groove-line divider, square range tiles with mono specs linking to the Shop, deep green arched-pair band, mono-numbered steps. Home button kept as "Shop" (Tim's earlier request). FAQ delivery answer corrected (it said delivery was included). Shop step headings larger in the serif, step numbers in mono. axe: no violations on any page, desktop or phone.
Shop restyled to match (25 Nov): heading "Design your *door.*", mono uppercase field labels, mono numbers in size boxes, pill toggles (deep green when chosen), design tiles with serif names and an ink outline when chosen, softer 4 px corners, serif door names and total in the basket, mono prices, a groove-line divider above the basket. Works the same; phone layout unchanged. Footer logo spacing fixed (25 Nov): the footer link rule had turned the logo back into a plain inline link, so "Pivot" and "DESIGNS" ran together.
Photo checklist for painted doors (sent to Tim 25 Nov): natural side light, no direct sun or flash; plain wall or real fitted setting; same paint colours as the site's renders where possible (sage, navy, warm white, deep green); shots per design: straight-on whole door, 45° angle showing groove depth, close-up of an inside corner or groove edge, fitted in a room, and a pair/run for arched and reeded; landscape and portrait of each; phone at door-middle height, 1x lens, step back and zoom slightly to avoid distortion; clean, sanded edges, handles off or matching; nothing else in shot that isn't offered (other designs, clutter); send originals (not screenshots). Possible next: better styled photos (painted doors, natural light) would lift the gallery feel most.

## Next tasks (24 Nov 2026)
1. Tim to check the new story wording and the test page; merge the branch to `main` to go live.
2. Pictures: real photos and labelled AI renders per design, including inside-corner close-ups.
3. New test designs (two-panel, vented, raised profile) in the designs workstream, added with `lab: true`.
4. Admin security: on hold at Tim's request (options are in orders.md).

## Key files
`public/*.html`, `public/css/site.css`, `public/img/`, `public/configurator.html`.
