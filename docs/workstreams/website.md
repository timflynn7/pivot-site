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

## Key files
`public/*.html`, `public/css/site.css`, `public/img/`, `public/configurator.html`.
