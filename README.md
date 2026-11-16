# Pivot Designs website

The website for pivotdesigns.co.uk. It has three pages so far: Home, Our story and Contact. The door configurator, order requests and DXF downloads will be added to this same app.

## What's in here

| Path | What it is |
| --- | --- |
| `server.js` | The small web server. The configurator and order routes go here later. |
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
