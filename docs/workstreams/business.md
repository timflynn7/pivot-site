# Workstream 5: Business setup

## Goal
The non-code decisions and paperwork needed before taking real orders.

## Open items
- **Pricing by machining time.** Get VCarve's time estimate per design once the toolpath templates exist, and set a rate per design. Redo the size bands: the 300 mm minimum leaves the Small band (up to 300 mm wide) with one width only.
- **Trade prices.** About 25% below retail is suggested (£22 / £30 / £45 on the current bands).
- **Privacy policy.** Needed because the order form collects names, emails and addresses (UK GDPR).
- **Terms of sale.** Made-to-measure goods are generally excluded from the 14-day cancellation right; say so clearly. Also lead times, delivery and damage.
- **VAT.** Check registration with an accountant before setting final prices.
- **Google Business Profile.** Create it with photos, and link it from the site and Etsy.

## Pricing by sheet use (Tim's notes, 24 Nov 2026)
- Goal: price each door by the share of a 1200 × 1200 sheet it uses, including spacing and margins, then add a per-design uplift for machining time and tool changes. Tim edits the uplifts in /admin.
- Rule: an extra door must never cost more than the earlier ones, even when a design leaves no usable offcut. So charge a share of the sheet (area plus spacing), not whole sheets, and possibly a small fixed setup fee per order.
- Questions: sheet cost, machine hourly rate, spacing and margin, setup fee, uplifts per design.
- Delivery: free over a threshold? Max order size or bulk discount? (Tim to decide.)

## Where the background is
The Trade Portal Plan (pricing, legal, VAT) and the Configurator Scope (open questions). Links are in `docs/LINKS.md`.

This workstream suits a Claude.ai Project chat better than a code session, until something needs adding to the site (e.g. the privacy policy page).
