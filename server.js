// Pivot Designs website and configurator.
// Serves the pages in /public, takes order requests from the configurator,
// and gives you a password-protected orders page with a DXF per order.
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const E = require("./public/js/engine.js");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const SITE_URL = process.env.SITE_URL || "https://pivotdesigns.co.uk";
const store = require("./lib/store.js")({ databaseUrl: process.env.DATABASE_URL, dataDir: DATA_DIR });
const email = require("./lib/email.js")({ E, siteUrl: SITE_URL });
const pay = require("./lib/payments.js")({ store, E, siteUrl: SITE_URL, onPaid: async (o) => {
  await mail(o.ref, "Payment received, to customer", () => email.paidCustomer(o));
  await mail(o.ref, "Paid notice to Tim", () => email.paidAdmin(o));
} });

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

/* ---------- orders ----------
 * Orders are kept by lib/store.js: in Postgres when DATABASE_URL is set (on
 * Render), otherwise in data/orders.json. Each order moves through these
 * statuses. Prices are kept in pence. */
const STATUSES = ["new", "quoted", "paid", "cut", "dispatched", "cancelled"];
const STATUS_TEXT = { new: "New request", quoted: "Price confirmed, awaiting payment", paid: "Paid", cut: "Cut", dispatched: "Dispatched", cancelled: "Cancelled" };
function newRef() {
  const ymd = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return "PD-" + ymd + "-" + crypto.randomBytes(2).toString("hex").toUpperCase();
}
const newToken = () => crypto.randomBytes(18).toString("base64url");
const clean = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
const money = (pence) => "£" + (pence / 100).toFixed(2);
const estimatePence = (o) => Math.round(o.totals.total * 100);
const note = (o, what) => { o.history = (o.history || []).concat({ at: new Date().toISOString(), what }); };
// Wraps async routes so a database error shows the error page instead of hanging.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Sends one email and notes the result in the order's history.
// A failed email never stops an order: it shows up on /admin instead.
async function mail(ref, label, sendFn) {
  let what;
  try {
    const r = await sendFn();
    what = r.skipped ? `Email not sent (emails switched off): ${label}` : `Email sent: ${label}`;
  } catch (e) {
    console.error(`Email failed (${label}) for ${ref}:`, e.message);
    what = `Email FAILED: ${label} (${clean(e.message, 120)})`;
  }
  await store.update(ref, (o) => { note(o, what); return o; }).catch((e) => console.error("Could not note email", e));
  return !what.startsWith("Email FAILED");
}

/* ---------- order requests ---------- */
app.post("/api/orders", express.json({ limit: "200kb" }), wrap(async (req, res) => {
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
  const created = new Date().toISOString();
  const order = {
    ref: newRef(), created, engine: E.VERSION, customer, doors, totals: E.priceOrder(doors),
    status: "new", quote: null, payToken: newToken(), history: [{ at: created, what: "Request received" }]
  };
  try {
    await store.add(order);
  } catch (e) {
    console.error("Could not save order", e);
    return res.status(500).json({ error: "We couldn't save your request. Please email tim@pivotdesigns.co.uk." });
  }
  console.log(`Order request ${order.ref}: ${order.totals.count} doors, £${order.totals.total}`);
  res.status(201).json({ ref: order.ref, total: order.totals.total });
  // After replying, so the customer isn't kept waiting.
  await mail(order.ref, "New order notice to Tim", () => email.newOrderAdmin(order));
  await mail(order.ref, "Order received, to customer", () => email.newOrderCustomer(order));
}));

/* ---------- payments (see lib/payments.js) ---------- */
app.use(pay.router);

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
// Admin buttons only work from the admin page itself, so another website
// can't press them using your saved sign-in.
function sameSite(req, res, next) {
  const from = req.get("origin") || req.get("referer") || "";
  let host = "";
  try { host = new URL(from).host; } catch (e) {}
  if (host && host === req.get("host")) return next();
  res.status(403).type("text").send("That change has to be made from the orders page.");
}
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const payLink = (o) => `${SITE_URL.replace(/\/$/, "")}/pay/${encodeURIComponent(o.ref)}?t=${encodeURIComponent(o.payToken)}`;

function orderRow(o) {
  const status = o.status || "new";
  const ref = encodeURIComponent(o.ref);
  const act = `/admin/orders/${ref}`;
  const price = o.quote != null ? o.quote : estimatePence(o);
  const priceBox = status === "new" || status === "quoted"
    ? `<form method="post" action="${act}" class="f"><input type="hidden" name="action" value="quote">
        <label>Price £ <input name="price" inputmode="decimal" value="${(price / 100).toFixed(2)}" size="7" aria-label="Price for ${esc(o.ref)} in pounds"></label>
        <button>${status === "new" ? "Confirm price" : "Change price"}</button>
        <label class="m tick"><input type="checkbox" name="email" value="1" checked> Email the payment link to the customer</label></form>`
    : "";
  const link = status === "quoted"
    ? `<div class="link"><span class="m">Payment link to email:</span><input readonly value="${esc(payLink(o))}" aria-label="Payment link for ${esc(o.ref)}"><button type="button" class="copy">Copy</button></div>
       <form method="post" action="${act}" class="f"><input type="hidden" name="action" value="resend"><button class="ghost">Resend payment link</button></form>`
    : "";
  const paid = o.payment ? `<p class="m">Paid ${money(o.payment.amount)} by ${esc(o.payment.method)}, ${esc(new Date(o.payment.at).toLocaleString("en-GB", { timeZone: "Europe/London" }))}</p>` : "";
  const markPaid = status === "new" || status === "quoted"
    ? `<form method="post" action="${act}" class="f" onsubmit="return confirm('Mark ${esc(o.ref)} as paid by bank transfer or cash?')"><input type="hidden" name="action" value="paid"><button class="ghost">Mark paid (not Stripe)</button></form>`
    : "";
  const statusForm = `<form method="post" action="${act}" class="f"><input type="hidden" name="action" value="status">
      <select name="status" aria-label="Status of ${esc(o.ref)}">${STATUSES.filter((s) => s !== "paid" || status === "paid").map((s) => `<option value="${s}"${s === status ? " selected" : ""}>${STATUS_TEXT[s]}</option>`).join("")}</select>
      <button class="ghost">Save</button></form>`;
  const history = (o.history || []).length
    ? `<details class="m"><summary>History (${o.history.length})</summary><ul>${o.history.slice().reverse().map((h) => `<li${/FAILED/.test(h.what) ? ' class="bad"' : ""}>${esc(new Date(h.at).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "short", timeStyle: "short" }))}: ${esc(h.what)}</li>`).join("")}</ul></details>`
    : "";
  return `<tr id="${esc(o.ref)}" class="s-${status}">
    <td><b>${esc(o.ref)}</b><br><span class="m">${esc(new Date(o.created).toLocaleString("en-GB", { timeZone: "Europe/London" }))}</span><br><span class="tag">${STATUS_TEXT[status]}</span></td>
    <td>${esc(o.customer.name)}<br><span class="m">${esc(o.customer.email)}${o.customer.phone ? " · " + esc(o.customer.phone) : ""}<br>${esc(o.customer.address)}<br>${esc(o.customer.postcode)}</span></td>
    <td>${o.doors.map((d, i) => `${i + 1}. ${d.qty} × ${esc(E.designById(d.design).name)} ${d.width} × ${d.height}${d.name ? " (" + esc(d.name) + ")" : ""}<br><span class="m">${esc(E.describe(d))}</span>`).join("<br>")}${o.customer.notes ? `<p class="m">Notes: ${esc(o.customer.notes)}</p>` : ""}
      <p><a class="b" href="/admin/orders/${ref}.dxf">DXF</a> <a href="/admin/orders/${ref}.json">Spec</a></p></td>
    <td class="n">Estimate ${money(estimatePence(o))}${o.quote != null ? `<br><b>Price ${money(o.quote)}</b>` : ""}</td>
    <td class="acts">${priceBox}${link}${paid}${markPaid}${statusForm}${history}</td></tr>`;
}

app.get("/admin", adminAuth, wrap(async (req, res) => {
  const orders = await store.list();
  const counts = STATUSES.map((s) => [s, orders.filter((o) => (o.status || "new") === s).length]).filter(([, n]) => n);
  const payState = pay.enabled ? (pay.testMode ? "Stripe payments are on in <b>test mode</b>: no real money is taken." : "Stripe payments are <b>live</b>.") : "Stripe payments are off. Add STRIPE_SECRET_KEY in Render's Environment settings to turn them on.";
  const storeState = store.kind === "postgres" ? "" : `<p class="w">Testing only: orders are kept on Render's temporary disk and disappear when the site is redeployed. Connect the database to keep them.</p>`;
  res.set("Cache-Control", "no-store").send(`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Orders | Pivot Designs</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;padding:24px max(16px,env(safe-area-inset-left));background:#F4F2EC;color:#1C1F1D}h1{font-weight:500;margin:0 0 4px}p.w{background:#F3E6C8;padding:8px 12px;border-radius:3px;max-width:80ch}.wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;background:#fff}th,td{text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid #DAD6CC}th{font-weight:500;color:#5D625C}.m{color:#5D625C;font-size:13px}.n{font-variant-numeric:tabular-nums;white-space:nowrap}a.b{background:#4B5F51;color:#fff;padding:5px 10px;border-radius:3px;text-decoration:none;font-weight:600}
.tag{display:inline-block;margin-top:4px;font-size:12px;font-weight:600;padding:2px 8px;border-radius:10px;background:#E3E8E2;color:#33443A}.s-new .tag{background:#F3E6C8;color:#6B4E1E}.s-paid .tag{background:#4B5F51;color:#fff}.s-cancelled{opacity:.6}
.acts{min-width:260px}.f{margin:0 0 8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center}.f input,.f select{font:inherit;padding:4px 6px;border:1px solid #BDB8AC;border-radius:3px}
button{font:inherit;font-weight:600;padding:5px 10px;border-radius:3px;border:1.5px solid #4B5F51;background:#4B5F51;color:#fff;cursor:pointer}button.ghost,.copy{background:#fff;color:#4B5F51}
.tick{display:flex;gap:4px;align-items:center;flex-basis:100%}details ul{margin:4px 0;padding-left:18px}li.bad,p.bad{color:#9B2C1F;font-weight:600}.link{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 8px}.link input{flex:1 1 200px;font:13px ui-monospace,monospace;padding:4px 6px;border:1px solid #BDB8AC;border-radius:3px}</style></head>
<body><h1>Orders</h1><p class="m">${orders.length} order${orders.length === 1 ? "" : "s"}, newest first.${counts.length ? " " + counts.map(([s, n]) => `${n} ${STATUS_TEXT[s].toLowerCase()}`).join(" · ") : ""}</p>
<p class="m">${payState} ${email.enabled() ? "Order emails are on." : "Order emails are off. Add RESEND_API_KEY in Render's Environment settings to turn them on."}</p>${storeState}
${typeof req.query.emailfailed === "string" ? `<p class="w bad">The payment link email to ${esc(req.query.emailfailed)} didn't send. See the order's History for why, then use Resend payment link or Copy it into your own email.</p>` : ""}
<p class="m">To take payment: check the order and click Confirm price. With the box ticked, the customer is emailed the payment link (or untick it and Copy the link into your own email). It changes to Paid by itself when they pay, and you get an email.</p>
<div class="wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Doors</th><th>Price</th><th>Actions</th></tr></thead><tbody>${orders.map(orderRow).join("") || '<tr><td colspan="5">No orders yet.</td></tr>'}</tbody></table></div>
<script>document.addEventListener("click",function(e){if(!e.target.classList.contains("copy"))return;var i=e.target.previousElementSibling;i.select();(navigator.clipboard?navigator.clipboard.writeText(i.value):Promise.reject()).catch(function(){document.execCommand("copy")}).finally(function(){e.target.textContent="Copied";setTimeout(function(){e.target.textContent="Copy"},1500)})});</script>
</body></html>`);
}));

// The buttons on the orders page.
app.post("/admin/orders/:ref", adminAuth, sameSite, express.urlencoded({ extended: false, limit: "10kb" }), wrap(async (req, res) => {
  const { action } = req.body;
  let problem = "", sendLink = false, markedPaid = false;
  const o = await store.update(req.params.ref, (o) => {
    const status = o.status || "new";
    if (action === "quote") {
      const pounds = Number(String(req.body.price || "").replace(/[£,\s]/g, ""));
      if (!(pounds >= 1 && pounds <= 20000)) { problem = "Enter a price between £1 and £20,000."; return null; }
      if (status !== "new" && status !== "quoted") { problem = "This order is already paid, so its price can't change."; return null; }
      o.quote = Math.round(pounds * 100);
      o.status = "quoted";
      o.payToken = o.payToken || newToken();
      note(o, `Price confirmed: ${money(o.quote)}`);
      sendLink = req.body.email === "1";
      return o;
    }
    if (action === "resend") {
      if (status !== "quoted") { problem = "Only orders awaiting payment have a payment link."; return null; }
      sendLink = true;
      return null;
    }
    if (action === "paid") {
      markedPaid = status !== "paid";
      return pay.applyPayment(o, { id: "manual-" + Date.now(), method: "bank transfer or cash", amount: o.quote != null ? o.quote : estimatePence(o), at: new Date().toISOString() });
    }
    if (action === "status") {
      const to = req.body.status;
      if (!STATUSES.includes(to) || to === status) return null;
      if (to === "paid") { problem = "Use Mark paid to record a payment."; return null; }
      if (to === "quoted" && o.quote == null) { problem = "Confirm a price first."; return null; }
      o.status = to;
      note(o, `Status: ${STATUS_TEXT[to]}`);
      return o;
    }
    problem = "Unknown action.";
    return null;
  });
  if (!o) return res.status(404).type("text").send("No order with that reference.");
  if (problem) return res.status(400).type("html").send(`<p style="font:16px system-ui;padding:24px">${esc(problem)} <a href="/admin">Back to orders</a></p>`);
  if (markedPaid) await mail(o.ref, "Payment received, to customer", () => email.paidCustomer(o));
  if (sendLink) {
    const ok = await mail(o.ref, `Payment link (${money(o.quote)}) to ${o.customer.email}`, () => email.payLink(o, payLink(o)));
    if (!ok) return res.redirect(303, "/admin?emailfailed=" + encodeURIComponent(o.ref) + "#" + encodeURIComponent(o.ref));
  }
  res.redirect(303, "/admin#" + encodeURIComponent(o.ref));
}));

app.get("/admin/orders/:ref.dxf", adminAuth, wrap(async (req, res) => {
  const o = await store.get(req.params.ref);
  if (!o) return res.status(404).type("text").send("No order with that reference.");
  res.set("Content-Type", "application/dxf").set("Content-Disposition", `attachment; filename="${o.ref}.dxf"`).set("Cache-Control", "no-store");
  res.send(E.orderDXF(o));
}));
app.get("/admin/orders/:ref.json", adminAuth, wrap(async (req, res) => {
  const o = await store.get(req.params.ref);
  if (!o) return res.status(404).type("text").send("No order with that reference.");
  const { payToken, ...rest } = o;
  res.set("Cache-Control", "no-store").json(rest);
}));

// Clean addresses: /story serves story.html, and so on.
app.use(express.static(PUBLIC, { extensions: ["html"], maxAge: "1h" }));

app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC, "404.html")));

// Anything that goes wrong in a page: log it and show a plain message.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).type("text").send("Something went wrong. Please try again, or email tim@pivotdesigns.co.uk.");
});

store.init().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Pivot Designs running on port ${PORT}. Orders kept in ${store.kind}. Payments ${pay.enabled ? (pay.testMode ? "on (test mode)" : "on (LIVE)") : "off"}.`);
  });
}).catch((e) => {
  console.error("Could not connect to the orders database", e);
  process.exit(1);
});
