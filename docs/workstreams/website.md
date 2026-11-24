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

## Next tasks (24 Nov 2026)
1. Tim to check the new story wording and the test page; merge the branch to `main` to go live.
2. Pictures: real photos and labelled AI renders per design, including inside-corner close-ups.
3. New test designs (two-panel, vented, raised profile) in the designs workstream, added with `lab: true`.
4. Admin security: on hold at Tim's request (options are in orders.md).

## Key files
`public/*.html`, `public/css/site.css`, `public/img/`, `public/configurator.html`.
