# Pivot Designs website

The website for pivotdesigns.co.uk: Home, Our story and Contact, plus a test version of the door configurator at `/configurator` that takes order requests and makes one DXF per order.

Planning and session briefs: start with [`docs/workstreams/README.md`](docs/workstreams/README.md). Links to everything are in [`docs/LINKS.md`](docs/LINKS.md).

## What's in here

| Path | What it is |
| --- | --- |
| `server.js` | The web server: pages, order requests (`/api/orders`) and the orders page (`/admin`). |
| `public/js/engine.js` | The door engine. Every design's recipe, size limits, prices, preview drawing and DXF output. |
| `public/configurator.html` | The configurator page. Not linked from the menu while it's being tested. |
| `scripts/test-board-dxf.js` | Makes one 1220 x 500 mm test board with every design still being worked out, small doors with full-size details, plus a file per design: `node scripts/test-board-dxf.js`. |
| `scripts/sample-dxf.js` | Makes a test DXF for each design, one with all designs, and a README: `npm run sample-dxf`. |
| `public/` | The pages, styles and photos people see. |
| `public/img/` | Product photos, taken from the Etsy listings. Replace them with your original photos for sharper images (same file names). |
| `render.yaml` | Tells Render how to build and run the site. |

## Put it on Render

1. Sign up at render.com with **Sign in with GitHub**, and allow Render to see the `pivot-site` repository.
2. Choose **New** → **Blueprint**, pick `timflynn7/pivot-site`, and confirm. Render reads `render.yaml` and creates a web service called `pivot-site`.
3. Wait for the first deploy to finish, then open the address ending in `.onrender.com` and check the pages.

`render.yaml` uses the **Starter** plan, which stays on all the time. The **Free** plan works too, but it goes to sleep when nobody visits, so the first visitor after a quiet spell waits nearly a minute. Change `plan: starter` to `plan: free` if you want to try it free first.

Every change pushed to the `main` branch on GitHub goes live by itself within a few minutes.

## Connect pivotdesigns.co.uk (123-reg)

1. In Render, open the `pivot-site` service → **Settings** → **Custom Domains**. Add `pivotdesigns.co.uk`, then `www.pivotdesigns.co.uk`. Render shows the DNS record each one needs.
2. Sign in to 123-reg → **Domain names** → `pivotdesigns.co.uk` → **Manage DNS** (Advanced DNS).
3. For `pivotdesigns.co.uk` (shown as `@`), set the **A record** to the IP address Render gives. Remove any other A records for `@`.
4. For `www`, add the **CNAME record** Render gives (it ends in `.onrender.com`).
5. **Do not change the MX records.** They deliver email to tim@pivotdesigns.co.uk.
6. Back in Render, press **Verify** next to each domain. DNS changes can take from a few minutes to 48 hours. Render adds HTTPS by itself once the domain is verified.

The server sends visitors from www.pivotdesigns.co.uk to pivotdesigns.co.uk, so the site has one address.

## Editing the pages

Each page is a plain HTML file in `public/`. The header and footer appear on every page, so change all three files when you change them.

## The configurator (test version)

- **Customers:** https://pivotdesigns.co.uk/configurator. It isn't in the menu or search results yet.
- **Test DXF without ordering:** https://pivotdesigns.co.uk/configurator?test shows a **Download test DXF** button under the door list.
- **Your orders page:** https://pivotdesigns.co.uk/admin lists order requests with a **DXF** and **Spec** button for each.

### Turn on the orders page

In Render, open the `pivot-site` service → **Environment** → **Add Environment Variable**. Name it `ADMIN_PASSWORD` and give it a long password of your own. Save, and Render restarts the site. Sign in to `/admin` with any username and that password.

### Limits of this test version

- Order requests are saved on Render's temporary disk, so they **disappear on every deploy**. Use it for testing only, until orders move into a database.
- There's no email yet. Check `/admin` for new requests.
- All tooling is placeholder. Each design's bits, depths and DXF layer names are in the `TOOLS` table at the top of `public/js/engine.js`.

### What's in each DXF

- One part per door copy, spread apart in rows up to 2440 mm wide, ready for VCarve to nest.
- `CUTOUT_EM6`: the door outline, to profile outside with tabs.
- One layer per toolpath, named by tool and depth, e.g. `POCKET_EM6_D8`, `FLUTE_CORE16_D5`, `REED_FORM13_D4`, `GROOVE_V90_D4`, `BEAD_FORM6_D3`, `BEVEL_V90_D8`.
- `MOULD_TBN_RAIL`: drive rails for VCarve's moulding toolpath (Moulded frame, Victorian, Ring and arc). Draw the moulding profile in VCarve.
- Grooves that run the full height go 10 mm past the door edge.
- `LABELS`: door number and name, size and design, hinge side and count (for hand drilling), and the order reference.
- Units are millimetres. Set the VCarve job to mm before importing.
