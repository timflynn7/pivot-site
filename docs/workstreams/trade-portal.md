# Workstream 6: Trade portal

## Goal
Local fitters, joiners and carpenters get a portal with their own branding. They quote Pivot doors to their customers at their own prices, and Pivot makes and ships plain-label.

## Status
Planned for later, after the core site and orders work. The full plan, payment options, pricing example and roadmap are in the Trade Portal Plan, and the screens are in the Trade Portal Mock-up (links in `docs/LINKS.md`).

## Decisions so far
- Start with Option 1, wholesale: the trade pays Pivot a trade price by card, and bills their own customer.
- Move to Stripe Connect (automatic split payments) only once about 5 trades are quoting each month.
- Next step from the plan: show the mock-up to 2 or 3 local trades before building anything.

## Depends on
Orders and payments (database, logins, Stripe), and settled designs and pricing.
