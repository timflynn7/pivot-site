// Pivot Designs website and configurator.
// Serves the pages in /public, takes order requests from the configurator,
// and gives you a password-protected orders page with a DXF per order.
const express = require("express");
const path = require("path");
const fs = require("fs");
const E = require("./public/js/engine.js");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const SITE_URL = process.env.SITE_URL || "https://pivotdesigns.co.uk";
const store = require("./lib/store.js")({ databaseUrl: process.env.DATABASE_URL, dataDir: DATA_DIR });
const site = require("./lib/site.js")({ store });
const email = require("./lib/email.js")({ E, siteUrl: SITE_URL });
const orders = require("./lib/orders.js")({ store, E, email });
// When a customer pays by card, they get a receipt and Tim gets a notice.
const pay = require("./lib/payments.js")({ store, E, siteUrl: SITE_URL, onPaid: async (o) => {
  await orders.mail(o.ref, "Payment received, to customer", () => email.paidCustomer(o));
  await orders.mail(o.ref, "Paid notice to Tim", () => email.paidAdmin(o));
} });
const admin = require("./lib/admin.js")({ store, E, email, pay, orders, site, siteUrl: SITE_URL });
// Wraps async routes so a database error shows the error page instead of hanging.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.disable("x-powered-by");
// Render sits in front of the site, so take the visitor's address from its header (used for lookup limits).
app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Send www.pivotdesigns.co.uk to pivotdesigns.co.uk so there is one address.
app.use((req, res, next) => {
  if (req.hostname === "www.pivotdesigns.co.uk") {
    return res.redirect(301, "https://pivotdesigns.co.uk" + req.originalUrl);
  }
  next();
});

app.get("/health", (req, res) => res.json({ ok: true }));
// Current prices for the configurator and home page (set on /admin/pricing).
app.get("/api/pricing", (req, res) => res.set("Cache-Control", "no-cache").json({ ...E.getPricing(), mode: site.mode() }));

/* ---------- order requests from the configurator ---------- */
app.post("/api/orders", express.json({ limit: "200kb" }), wrap(async (req, res) => {
  const body = req.body || {};
  if (body.customer && body.customer.website) return res.json({ ref: "PD-OK" }); // spam trap: pretend success
  // Pay online: only in that mode, and only for addresses inside the delivery area.
  // Anyone else (or anyone who asks) sends a quote request as before.
  const payNow = site.mode() === "checkout" && body.intent === "pay";
  if (payNow) {
    const area = E.deliveryArea(body.customer && body.customer.postcode);
    if (area) return res.status(400).json({ error: `We can't take payment online for delivery to ${area}. Please send a quote request instead and we'll work out the delivery.`, area });
  }
  let r;
  try {
    r = await orders.createOrder(body, { source: "website", checkout: payNow });
  } catch (e) {
    console.error("Could not save order", e);
    return res.status(500).json({ error: "We couldn't save your request. Please email tim@pivotdesigns.co.uk." });
  }
  if (r.error) return res.status(400).json({ error: r.error });
  const order = r.order;
  if (payNow) {
    // Straight on to Stripe. Emails go when the payment comes through.
    return res.status(201).json({ ref: order.ref, total: order.totals.total, payUrl: `/pay/${encodeURIComponent(order.ref)}/checkout?t=${encodeURIComponent(order.payToken)}` });
  }
  res.status(201).json({ ref: order.ref, total: order.totals.total });
  // After replying, so the customer isn't kept waiting. The customer sent
  // this request themselves, so these emails go automatically.
  await orders.mail(order.ref, "New order notice to Tim", () => email.newOrderAdmin(order));
  await orders.mail(order.ref, "Order received, to customer", () => email.newOrderCustomer(order));
}));

/* ---------- payments (lib/payments.js) and the orders pages (lib/admin.js) ---------- */
app.use(pay.router);
app.use(admin.router);
app.use(require("./lib/address.js")().router);

// The test page: the configurator showing archived and draft designs (not linked, not orderable).
// Pages: the HTML is shown with the wording for the current payment mode (lib/site.js).
const sendPage = (res, name) => res.set("Cache-Control", "no-cache").type("html").send(site.renderPage(path.join(PUBLIC, name + ".html")));
app.get(["/test-designs", "/test-designs/"], (req, res) => sendPage(res.set("X-Robots-Tag", "noindex"), "configurator")); // unlisted test page: keep it out of search engines
app.get(/^\/([a-z0-9-]*?)(?:\.html)?$/, (req, res, next) => {
  const name = req.params[0] || "index";
  if (!fs.existsSync(path.join(PUBLIC, name + ".html"))) return next();
  sendPage(res, name);
});

// Clean addresses: /story serves story.html, and so on.
app.use(express.static(PUBLIC, { extensions: ["html"], maxAge: "1h" }));

app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC, "404.html")));

// Anything that goes wrong in a page: log it and show a plain message.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).type("text").send("Something went wrong. Please try again, or email tim@pivotdesigns.co.uk.");
});

store.init().then(async () => {
  // Prices saved on /admin/pricing; the engine's defaults until Tim saves any.
  E.setPricing(await store.getSetting("pricing"));
  await site.load();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Pivot Designs running on port ${PORT}. Orders kept in ${store.kind}. Mode: ${site.mode()}. Payments ${pay.enabled ? (pay.testMode ? "on (test mode)" : "on (LIVE)") : "off"}.`);
  });
}).catch((e) => {
  console.error("Could not connect to the orders database", e);
  process.exit(1);
});
