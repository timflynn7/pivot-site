# Pivot Designs – context for Claude

Pivot Designs (Tim) makes decorative made-to-measure MDF cabinet doors and panels on a CNC router in a UK workshop, cut in VCarve Pro. It sells on Etsy as PivotGB, and this repo is the website pivotdesigns.co.uk: holding pages, a door configurator, and order requests that produce one DXF per order for VCarve.

The work is split into workstreams. **Read `docs/workstreams/README.md` first, then the brief for the workstream you've been asked to work on.** Before ending a session, update that brief (status, decisions, next tasks) so the next session can pick up without the chat history. Where everything lives (live site, Render, docs, artifacts) is in `docs/LINKS.md`.

## How the code fits together

- `server.js`: Express server that wires the parts together. It serves the static pages from `public/` and takes `POST /api/orders` from the configurator. Orders are stored by `lib/store.js`: in Render Postgres when `DATABASE_URL` is set, otherwise in `data/orders.json` (wiped on every Render deploy).
- `lib/orders.js`: statuses, `createOrder` (validates every door again with the engine; used by customers and by Tim), and `mail()`, which notes each email in the order's history.
- `lib/admin.js`: the password-protected `/admin` pages (env `ADMIN_PASSWORD`): the order list with Action required flags and a Needs action queue, Confirm price, Mark paid, Mark dispatched, status, Archived view, Delete (paid orders need the reference typed), **email preview and edit before sending**, New order (`/configurator?admin` posts to `/admin/orders`, and nobody is emailed), DXF and JSON downloads, and a built-in "How this page works" guide.
- **Email rule:** only customer actions send customer emails automatically (request received, paid by card). Anything Tim does sets `pendingEmail` on the order and opens a preview; nothing is sent until he presses Send.
- `lib/payments.js`: Stripe Checkout payment links (`/pay/<ref>?t=<token>`, prices valid 30 days) and the Stripe webhook (`checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `charge.refunded` for automatic refund tracking). Env `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL`. Test everything with `npm test` (`scripts/test.js`).
- `lib/email.js`: emails through Resend (env `RESEND_API_KEY`, optional `EMAIL_FROM`, `EMAIL_ADMIN`). The automatic ones are new order (to Tim and the customer) and paid by card (to the customer and Tim). Editable drafts (`KINDS`: paylink, paid, dispatched, refunded, custom) are sent from the admin preview. A failed email never blocks an order.
- `public/js/engine.js`: **the single source of truth for doors.** It works in the browser (`window.PivotEngine`) and in Node. It holds the design recipes, size limits, provisional prices, SVG preview and R12 DXF writer. The configurator, the server and the scripts all use it, so a recipe change shows up everywhere.
- `public/configurator.html` + `public/js/configurator.js` + `public/css/configurator.css`: the customer configurator. `?test` in the URL shows a Download test DXF button.
- `public/index.html`, `story.html`, `contact.html`, `404.html` + `public/css/site.css`: site pages. The header and footer are repeated in each page, so change all of them.
- `scripts/sample-dxf.js`: writes one full-size test DXF per design plus one combined file.
- `scripts/test-board-dxf.js`: writes one 1220 x 500 mm offcut board with the draft designs, hand-placed, with full-size details.
- Hosting: Render web service `pivot-site` (Starter plan) deploys automatically from `main` within about a minute. Domain DNS is at 123-reg: the A record for `@` points to 216.24.57.1, and `www` is a CNAME to `pivot-site.onrender.com`. **Never touch the MX, SPF, DKIM, DMARC or autodiscover records;** they carry Tim's email. Resend's records (`resend._domainkey`, `rsend`, `send`) were added on 20 Nov 2026 for order emails.
- Public business address (terms, privacy): 61 Bridge Street, Kington, HR5 3DJ. **Never publish Tim's home address.**

## Decisions that hold everywhere

- Doors are 18 mm MDF only. Sizes are in mm. Customer limits are 300–1000 mm wide and 300–1200 mm tall (the machine takes 1200 × 1200 sheets; 1000 × 1200 is the largest that can be held down safely).
- Hinge holes (35 mm cups, 22.5 mm from the edge, 100 mm from top and bottom) are offered as a service and drilled by hand. The configurator records side and count, which go on the DXF LABELS layer only, with no back-side machining.
- One DXF per order, in mm, with parts spread apart for VCarve to nest. Each toolpath has its own layer named by tool and depth (e.g. `POCKET_EM6_D8`). Plus `CUTOUT_EM6` (outline), `LABELS`, and grooves overcut 10 mm past the edge where they run off the door.
- **Tooling in `TOOLS` (top of engine.js) is placeholder** until Tim's test cuts confirm bits, depths and layer names.
- Customer rules: complex or statement designs are size only; shaker types can adjust borders and rails; flutes, reeds and grooves can adjust spacing but not groove size (set by the bit).
- Order requests save a door spec (design, version, sizes, options), and the DXF is made from the spec, so it can be made again.
- Prices are provisional, by size band (£30 / £40 / £60, plus Extra large £80 up to 1000 × 1200 mm, a placeholder Tim hasn't set), with delivery £10 for the first door and £5 each extra. The plan is to price by machining time.
- The trade portal (white-label quoting for fitters) is planned for later. See the Trade Portal Plan.

## Working style

- Tim isn't a developer. Explain steps in plain words, give exact clicks for Render, 123-reg and GitHub, and confirm before anything that changes DNS, deletes data, or costs money.
- Test DXF changes by reading the file back (e.g. with the Python `ezdxf` package) and by drawing it, before saying they work.
- Commit to `main` only when asked or when finishing agreed work. Render deploys `main` straight to the live site.
- Don't present AI-generated images as real photos on the site. Label them as illustrations.
