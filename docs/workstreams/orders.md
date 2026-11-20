# Workstream 4: Orders and payments

## Goal
Order requests are stored safely, Tim is emailed for each one, and customers pay online.

## Status (20 Nov 2026)
**Live on 20 Nov 2026 in Stripe test mode (sandbox "Pivot Designs"), and fully tested by Tim:** payments, webhook (200 OK, order marked paid with the tab closed), and orders surviving a manual redeploy. The first test payments failed to reach the webhook because `STRIPE_SECRET_KEY` came from a different Stripe test area than the webhook; the key and the webhook must come from the same sandbox (and later, both from live). The Blueprint created the database and set `DATABASE_URL`, but the first deploy started before the variable existed; a redeploy fixed it.

- **Storage** (`lib/store.js`): orders go in Render Postgres when `DATABASE_URL` is set, otherwise in `data/orders.json` as before. Each order is one row, kept whole as JSON (`orders` table: `ref`, `created`, `data`), so new order fields need no database change.
- **Statuses**: new → quoted → paid → cut → dispatched (or cancelled). Prices are kept in pence: `quote` is the confirmed price, `totals` is the configurator's estimate.
- **Payments** (`lib/payments.js`): Stripe Checkout (stripe-node 23). Which payment methods appear (card, Apple Pay, Google Pay, PayPal…) is set in the Stripe dashboard, not in code, as Stripe recommends.
  1. The customer sends a request. It's saved as *new* with a secret `payToken`.
  2. On `/admin`, Tim checks it, edits the price if needed and clicks **Confirm price**. The order becomes *quoted* and the page shows the payment link `/pay/<ref>?t=<token>` with a Copy button.
  3. Tim emails the link himself (there's no automatic email yet). The customer sees the order and the price and clicks Pay. Each click makes a fresh 2-hour Checkout Session, so the link never expires.
  4. The webhook `POST /api/stripe/webhook` (signature checked) marks the order *paid*. The thank-you page `/pay/<ref>/done` also checks with Stripe, in case the webhook is slow. A payment is recorded only once.
  5. **Mark paid (not Stripe)** on `/admin` records a bank transfer or cash payment.
- **Admin safety**: the buttons only work from the admin page itself (an Origin check), and the Spec download leaves out the pay token.
- **Tests**: `node scripts/test-payments.js` covers the whole flow with a stand-in for Stripe's servers and Stripe's real signature check. `TEST_DATABASE_URL=postgres://… node scripts/test-payments.js` runs the same tests against Postgres. Both pass.
- **`render.yaml`** now declares the `pivot-orders` database (basic-256mb, about £6 a month, Frankfurt, no outside access), plus `DATABASE_URL`, `SITE_URL`, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. The Stripe values are entered in Render, never in the repo.

## Decisions
- Tim chose **pay link after quote**: no payment at checkout while prices are provisional. Tim confirms every order before the customer can pay.
- Tim approved the Render Postgres database (about £6 a month).
- Payment methods: cards, Apple Pay and Google Pay for now. Tim switches them on and off in Stripe → Settings → Payment methods; the code doesn't list them (no `payment_method_types`).
- **Not VAT-registered (20 Nov 2026), so no VAT is charged and Stripe Tax is off.** If Tim registers later: prices must be shown VAT-inclusive, add `automatic_tax` to the Checkout Session with inclusive prices and a shipping tax code, and add the VAT registration in Stripe Tax first (read the Stripe plugin's tax reference before switching it on). Whether to absorb VAT or raise prices is a business-workstream decision.
- For live payments, use a **restricted key** (`rk_live_…`) with only Checkout Sessions: Write, instead of the full secret key.
- Render bills in US dollars: the database is $6 a month (about £4.70), charged to the card on Tim's Render account and worked out by the second.
- Stripe Connect for trade customers later (see the Trade Portal Plan).

## Going live (Tim's steps; not done yet)
1. **Create a Stripe account** at stripe.com: Start now, use tim@pivotdesigns.co.uk, then fill in the business details (sole trader or limited company, bank account for payouts). Test mode works before the account is fully verified.
2. In Stripe (test mode on): **Developers → API keys**, and copy the **Secret key** (`sk_test_…`).
3. **(Done 20 Nov.) Merge the branch into `main`.** Render then deploys, and the Blueprint sync creates the database (the £6 starts here). If Render asks for `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, paste the test secret key and leave the webhook secret for step 4. Note: the first deploy after the sync can start before `DATABASE_URL` is set. If the log says "Orders kept in file", use Manual Deploy → Deploy latest commit.
4. In Stripe: **Developers → Webhooks → Add endpoint**, URL `https://pivotdesigns.co.uk/api/stripe/webhook`, events `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Copy its **Signing secret** (`whsec_…`) into Render → pivot-site → Environment → `STRIPE_WEBHOOK_SECRET`, then save (it redeploys).
5. Test: send an order from the configurator, confirm the price on `/admin`, open the link, and pay with Stripe's test card `4242 4242 4242 4242` (any future date, any CVC). Check the order turns *Paid*.
6. Go live: in Stripe, switch off test mode. Create a **restricted key** (Developers → API keys → Create restricted key, Checkout Sessions: Write, everything else None) and a **live** webhook (step 4 again), and replace both values in Render. The admin page says whether payments are in test mode or live.
7. In Stripe **Settings → Payment methods**, leave Cards, Apple Pay and Google Pay on and switch off anything you don't want (Link, Klarna, etc.). Under **Settings → Emails**, turn on receipts for successful payments.

## Next tasks
1. Tim: going-live steps 6 and 7 above, after the terms and refund page (task 4) and Stripe's activation form (Verify your business: business details, bank, two-step sign-in; skip Stripe Tax).
2. **Emails (built 20 Nov 2026, `lib/email.js`), switched on once Tim sets up Resend.** Tim chose Resend (free up to 3,000 a month). Emails come from `Pivot Designs <orders@pivotdesigns.co.uk>`, and replies go to tim@pivotdesigns.co.uk. Sent: new order → Tim; new order → customer; payment link → customer (tick box on Confirm price, ticked by default, plus a Resend payment link button); paid via Stripe → Tim, once only. Mark paid sends nothing; Stripe sends the customer's receipt. Every send, skip or failure is noted in the order's History on /admin, and a failed payment-link email shows a warning there. Tested in `npm test` with Resend's address intercepted.
   Tim's setup: sign up at resend.com → **Domains → Add domain** `pivotdesigns.co.uk`, region **Ireland (eu-west-1)** → add the records Resend shows at 123-reg (a DKIM TXT on `resend._domainkey`, plus an MX and an SPF TXT on the `send` subdomain). These are **new names**: don't edit or remove the existing MX, SPF, DKIM, DMARC or autodiscover records. Once Resend says Verified → **API Keys → Create**, with Sending access for pivotdesigns.co.uk only → Render → pivot-site → Environment → `RESEND_API_KEY`. Then place a test order: both emails should arrive and History should say "Email sent".
3. Refunds: for now these are done in the Stripe dashboard. The order status isn't updated automatically.
4. Terms of sale and a refunds/cancellation policy page, needed before taking live payments for made-to-measure goods (see business workstream).
5. Optional: database backups or export from `/admin` (Render basic plans keep daily backups).

## Key files
`server.js`, `lib/store.js`, `lib/payments.js`, `scripts/test-payments.js`, `render.yaml`.
