# Workstream 4: Orders and payments

## Goal
Order requests are stored safely, Tim is emailed for each one, and later customers pay online.

## Status (18 Nov 2026)
- `POST /api/orders` validates every door with the engine and saves to `data/orders.json`. **Render wipes this on every deploy, so it's for testing only.**
- `/admin` (basic auth, env `ADMIN_PASSWORD` set in Render) lists orders with a DXF and Spec download.
- There's no email notification and no payment.

## Decisions
- Payments come later. For now there's an order request, then Tim confirms the price and lead time by email.
- Payments will use Stripe Checkout first, then Stripe Connect for trades later (see the Trade Portal Plan).

## Next tasks
1. Add a Render Postgres database for orders (about £6 a month; Tim to approve) and move storage there.
2. Email Tim at tim@pivotdesigns.co.uk on each order request, and send the customer a confirmation. Use an email service such as Resend or Postmark, with a key stored in Render Environment, never in the repo.
3. Order statuses on `/admin`: new, quoted, paid, cut, dispatched.
4. Stripe Checkout once pricing is settled.

## Key files
`server.js`, `render.yaml`.
