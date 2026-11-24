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
- **Sheet costs (Tim, 24 Nov 2026):** standard MDF £36 a full sheet, worked in half sheets, so £17.50 per 1200 × 1200 unit. The website will use **moisture-resistant (MR) MDF**: £42 a full sheet (Tim wrote 2400 × 2400; probably 2440 × 1220, to confirm), so about £21 per half sheet. The machine takes 1200 × 1200.
- **Tim's answers (24 Nov 2026):** MR MDF sheets are 1220 × 2440 at £42 (£21 per 1220 × 1220 half). He leaves a 30 mm border and 25 mm between parts (screwed down), and can go tighter for one or two parts. He aims for 5–6× material value (10× ideal), with a **£30 minimum per door**. Delivery: **£12 first door, £5 each extra**. He asked for suggested uplifts, worked examples, and a free-delivery threshold.
- **Proposed formula (sent to Tim for feedback):** usable side 1220 − 2 × 30 + 25 = 1185 mm. Footprint (w + 25) × (h + 25); if the leftover strip beside or below a door is too narrow for another door (under 300 mm + gap), that whole strip is charged to the door. Share = footprint ÷ 1185². Price = max(£30, (£12 per door handling + share × £126 [6 × £21]) × design factor). Factors suggested: Slab 1.0, Tongue & V 1.15, Traditional/Skinny 1.25, Tongue & bead/New Country 1.35, Bevelled/Georgian 1.45, Fluted/Reeded/Beaded 1.55, Arched 1.6 per door. Example 450 × 700: share 25%, material £5.15; slab £43, shaker £54, arched £69. Free delivery suggested over about £400, pending Tim's real courier costs.
- **Tim's feedback (24 Nov 2026):** prices look about right. Arched machines quickly, so its factor drops to **1.15** (same as Tongue & V). Charge **half** of any wasted strip. Real courier cost: 6 doors of 600 × 900 cost £35, against £37 charged at £12 + £5 each, so the delivery charge covers cost. Free delivery over £400 holds up (the 6 × 600 × 900 shaker order is about £534, so absorbing £35 is about 6.5%). Common kitchen heights: 720 and 640 mm. Example 500 × 720: slab £47, shaker £59, fluted £73.
- **Next: build it** (engine pricing function, /admin pricing page with the rates and factors, remove the size bands, free-delivery threshold), once Tim says go.
- Delivery: free over a threshold? Max order size or bulk discount? (Tim to decide.)

## Where the background is
The Trade Portal Plan (pricing, legal, VAT) and the Configurator Scope (open questions). Links are in `docs/LINKS.md`.

This workstream suits a Claude.ai Project chat better than a code session, until something needs adding to the site (e.g. the privacy policy page).
