# Workstream 6: Trade portal

## Goal
Local fitters, joiners and carpenters get a portal with their own branding. They quote Pivot doors to their customers at their own prices, and Pivot makes and ships plain-label.

## Status
Planned for later, after the core site and orders work. The full plan, payment options, pricing example and roadmap are in the Trade Portal Plan, and the screens are in the Trade Portal Mock-up (links in `docs/LINKS.md`).

## Decisions so far
- Start with Option 1, wholesale: the trade pays Pivot a trade price by card, and bills their own customer.
- Move to Stripe Connect (automatic split payments) only once about 5 trades are quoting each month.
- Next step from the plan: show the mock-up to 2 or 3 local trades before building anything.

## Backlog idea from Tim (24 Nov 2026): local tradespeople
Look at how working with local tradesmen could work. Tim's starting idea: a **password-protected trade page** where tradespeople with an account log in, design and order doors, and **pay online at a discounted trade price**. Points to work out when this is picked up:
- Accounts: how a trade signs up (Tim approves each one?), logins, password resets, and whether this shares the admin security work.
- Trade price: a percentage off the website price, or its own price bands (/admin/pricing could hold a trade discount). Keep it above cost and check it against the Etsy-band rule (website customers pay less than Etsy; trade pays less again).
- Paying: the Pay online checkout already exists and could take the trade price; invoices and VAT receipts for trades.
- Delivery: to the trade's address or straight to their customer, plain-label (no Pivot branding), as in the wholesale plan above.
- Talk to 2 or 3 local trades first (see Decisions).

## Depends on
Orders and payments (database, logins, Stripe), and settled designs and pricing.
