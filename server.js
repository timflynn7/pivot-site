// Pivot Designs website and configurator.
// Serves the pages in /public, takes order requests from the configurator,
// and gives you a password-protected orders page with a DXF per order.
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const E = require("./public/js/engine.js");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

app.disable("x-powered-by");
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

/* ---------- order storage ----------
 * Orders are kept in data/orders.json. On Render this disk is wiped on every
 * deploy, so this is for testing only. The next step moves orders into a
 * Postgres database. */
function readOrders() {
  try { return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8")); } catch (e) { return []; }
}
function writeOrders(orders) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = ORDERS_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(orders, null, 2));
  fs.renameSync(tmp, ORDERS_FILE);
}
function newRef() {
  const ymd = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return "PD-" + ymd + "-" + crypto.randomBytes(2).toString("hex").toUpperCase();
}
const clean = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);

/* ---------- order requests ---------- */
app.post("/api/orders", express.json({ limit: "200kb" }), (req, res) => {
  const body = req.body || {};
  const c = body.customer || {};
  if (c.website) return res.json({ ref: "PD-OK" }); // spam trap: pretend success
  const customer = {
    name: clean(c.name, 80), email: clean(c.email, 120), phone: clean(c.phone, 40),
    postcode: clean(c.postcode, 12).toUpperCase(), address: clean(c.address, 300), notes: clean(c.notes, 1000)
  };
  if (customer.name.length < 2) return res.status(400).json({ error: "Please add your name." });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email)) return res.status(400).json({ error: "Please add a valid email address." });
  if (!customer.postcode || !customer.address) return res.status(400).json({ error: "Please add your delivery address and postcode." });
  if (!Array.isArray(body.doors) || !body.doors.length) return res.status(400).json({ error: "Add at least one door to your list." });
  if (body.doors.length > 50) return res.status(400).json({ error: "Please send no more than 50 door lines in one request." });

  // Every door is checked again here with the same engine, so the DXF is always makeable.
  const doors = [];
  for (let i = 0; i < body.doors.length; i++) {
    const { door, errors } = E.normalizeDoor(body.doors[i]);
    const msgs = Object.values(errors);
    if (msgs.length) return res.status(400).json({ error: `Door ${i + 1}: ${msgs.join(" ")}` });
    doors.push(door);
  }
  const order = { ref: newRef(), created: new Date().toISOString(), engine: E.VERSION, customer, doors, totals: E.priceOrder(doors) };
  try {
    const orders = readOrders();
    orders.push(order);
    writeOrders(orders);
  } catch (e) {
    console.error("Could not save order", e);
    return res.status(500).json({ error: "We couldn't save your request. Please email tim@pivotdesigns.co.uk." });
  }
  console.log(`Order request ${order.ref}: ${order.totals.count} doors, £${order.totals.total}`);
  res.status(201).json({ ref: order.ref, total: order.totals.total });
});

/* ---------- admin (password protected) ----------
 * Set ADMIN_PASSWORD in Render: the service's Environment tab. Sign in with
 * any username and that password. */
function adminAuth(req, res, next) {
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return res.status(503).type("text").send("The orders page is turned off. Add ADMIN_PASSWORD in Render's Environment settings to turn it on.");
  const hdr = req.get("authorization") || "";
  const given = hdr.startsWith("Basic ") ? Buffer.from(hdr.slice(6), "base64").toString().split(":").slice(1).join(":") : "";
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(pass).digest();
  if (crypto.timingSafeEqual(a, b)) return next();
  res.set("WWW-Authenticate", 'Basic realm="Pivot orders", charset="UTF-8"').status(401).type("text").send("Sign in to see orders.");
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const findOrder = (ref) => readOrders().find((o) => o.ref === ref);

app.get("/admin", adminAuth, (req, res) => {
  const orders = readOrders().slice().reverse();
  const rows = orders.map((o) => `<tr>
    <td><b>${esc(o.ref)}</b><br><span class="m">${esc(new Date(o.created).toLocaleString("en-GB", { timeZone: "Europe/London" }))}</span></td>
    <td>${esc(o.customer.name)}<br><span class="m">${esc(o.customer.email)}${o.customer.phone ? " · " + esc(o.customer.phone) : ""}<br>${esc(o.customer.postcode)}</span></td>
    <td>${o.doors.map((d, i) => `${i + 1}. ${d.qty} × ${esc(E.designById(d.design).name)} ${d.width} × ${d.height}${d.name ? " (" + esc(d.name) + ")" : ""}<br><span class="m">${esc(E.describe(d))}</span>`).join("<br>")}${o.customer.notes ? `<p class="m">Notes: ${esc(o.customer.notes)}</p>` : ""}</td>
    <td class="n">£${o.totals.total.toFixed(2)}</td>
    <td><a class="b" href="/admin/orders/${encodeURIComponent(o.ref)}.dxf">DXF</a> <a href="/admin/orders/${encodeURIComponent(o.ref)}.json">Spec</a></td></tr>`).join("");
  res.set("Cache-Control", "no-store").send(`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Orders | Pivot Designs</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;padding:24px max(16px,env(safe-area-inset-left));background:#F4F2EC;color:#1C1F1D}h1{font-weight:500;margin:0 0 4px}p.w{background:#F3E6C8;padding:8px 12px;border-radius:3px;max-width:80ch}.wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;background:#fff}th,td{text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid #DAD6CC}th{font-weight:500;color:#5D625C}.m{color:#5D625C;font-size:13px}.n{font-variant-numeric:tabular-nums;white-space:nowrap}a.b{background:#4B5F51;color:#fff;padding:5px 10px;border-radius:3px;text-decoration:none;font-weight:600}</style></head>
<body><h1>Order requests</h1><p class="m">${orders.length} request${orders.length === 1 ? "" : "s"}. Newest first.</p>
<p class="w">Testing only: orders are kept on Render's temporary disk and disappear when the site is redeployed.</p>
<div class="wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Doors</th><th>Estimate</th><th>Files</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No order requests yet.</td></tr>'}</tbody></table></div></body></html>`);
});

app.get("/admin/orders/:ref.dxf", adminAuth, (req, res) => {
  const o = findOrder(req.params.ref);
  if (!o) return res.status(404).type("text").send("No order with that reference.");
  res.set("Content-Type", "application/dxf").set("Content-Disposition", `attachment; filename="${o.ref}.dxf"`).set("Cache-Control", "no-store");
  res.send(E.orderDXF(o));
});
app.get("/admin/orders/:ref.json", adminAuth, (req, res) => {
  const o = findOrder(req.params.ref);
  if (!o) return res.status(404).type("text").send("No order with that reference.");
  res.set("Cache-Control", "no-store").json(o);
});

// Clean addresses: /story serves story.html, and so on.
app.use(express.static(PUBLIC, { extensions: ["html"], maxAge: "1h" }));

app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC, "404.html")));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Pivot Designs running on port ${PORT}`);
});
