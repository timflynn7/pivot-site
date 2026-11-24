# Workstream 1: Website content and layout

## Goal
A site that makes a visitor want to order: clear about what Pivot makes, shows the doors well, builds trust, and leads to the configurator.

## Status (18 Nov 2026)
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

## Tim's notes (24 Nov 2026), not yet built
Agreed plan and answers to the questions go in this section once Tim replies.
- **Terms**: "which you can pay for 30 days" → "the quote remains valid for 30 days" (also section 3). "Who we are": the Kington business address is too prominent, because the story is a workshop in Surrey. The law (E-Commerce Regulations 2002) needs a geographic address on the site, so it can't be removed. Move it to a small "Business details" note at the bottom of the terms page.
- **Configurator (Design your door)**:
  - Remove the door name field for now.
  - Customers should add several doors of different sizes before they're asked for name and address. The list already allows this, but the contact form shows underneath from the start. Hide it until the list has a door, behind a "Continue to your details" step.
  - "Dashed circles show hinge holes on the back": only show it when hinge holes are chosen.
  - Optional image carousel per design (photos, labelled AI renders, close-ups of internal corners). None exist yet, so it must hide when empty, and adding or editing images must be easy (probably from /admin).
  - Toggle on the preview to overlay measurements (width, height, frame width, rails, groove spacing and other options).
  - Shaker: frame ranges overlap (Traditional 40–120 mm, Skinny 18–40 mm). Show the pocket depth (8 mm now, placeholder) and the internal corner radius (3 mm with the 6 mm end mill) so customers expect tight but rounded corners. Same for other pocketed designs.
  - Arched: designed to flow across a pair of doors, but a single door is allowed. Choose left door, right door or a pair. Adjustable number of grooves (1–5), spacing, and horizontal and vertical position.
- **New Test page**: an unlisted page (noindex) holding the archived designs plus new drafts (two-panel doors, vented doors, the raised-profile designs) to fine-tune the configurator before they go live.
- **Our story**: tone down the DIY and self-taught background, which may hurt confidence in Pivot as a manufacturer.
- **Home**: remove "Engraved icon" (not in the configurator). Rename the "Design your door" menu link to "Shop" (all page headers).

## Key files
`public/*.html`, `public/css/site.css`, `public/img/`, `public/configurator.html`.
