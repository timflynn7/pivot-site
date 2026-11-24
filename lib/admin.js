// The password-protected orders pages at /admin.
//
// Rule: no button on these pages emails a customer by itself. Actions that
// call for an email (confirming a price, marking paid or dispatched, a Stripe
// refund) set an "Action required" flag on the order and open a preview,
// where Tim can edit the email and then choose to send it, or leave it for later.
// Emails the customer triggers themselves (order received, paid by Stripe)
// are still sent automatically.
//
// Set ADMIN_PASSWORD in Render's Environment tab. Signing in also needs a code
// from Tim's phone (lib/auth.js).
const express = require("express");
const crypto = require("crypto");

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const when = (d, opts = { dateStyle: "short", timeStyle: "short" }) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", ...opts });

module.exports = function makeAdmin({ store, E, email, pay, orders, site, auth, siteUrl }) {
  const { STATUSES, STATUS_TEXT, money, estimatePence, note, clean, cleanLines, newToken, mail } = orders;
  const router = express.Router();
  const base = () => (process.env.SITE_URL || siteUrl).replace(/\/$/, "");
  const payLink = (o) => `${base()}/pay/${encodeURIComponent(o.ref)}?t=${encodeURIComponent(o.payToken)}`;
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  // Admin buttons only work from the admin pages themselves, so another
  // website can't press them using your saved sign-in.
  function sameSite(req, res, next) {
    const from = req.get("origin") || req.get("referer") || "";
    let host = "";
    try { host = new URL(from).host; } catch (e) {}
    if (host && host === req.get("host")) return next();
    res.status(403).type("text").send("That change has to be made from the orders page.");
  }
  // Signing in (password + phone code, 30-day browser sessions) is in lib/auth.js.
  router.use("/admin", auth.requireAdmin);

  /* ---------- what needs doing ---------- */
  const expired = (o) => pay.quoteExpired(o);
  // Red flags: Tim has to do something. Amber: work in the queue.
  function actions(o) {
    const out = [];
    const k = o.pendingEmail;
    if (k && !(k === "paylink" && (expired(o) || o.status !== "quoted"))) {
      out.push({ level: "act", text: `Send the customer the "${email.KINDS[k]}" email`, kind: k });
    }
    if ((o.status || "new") === "new") out.push({ level: "act", text: "Check the order and confirm the price" });
    if (o.status === "paid") out.push({ level: "todo", text: "Cut the doors" });
    if (o.status === "cut") out.push({ level: "todo", text: "Dispatch the doors" });
    return out;
  }
  const needsAction = (o) => actions(o).some((a) => a.level === "act");
  // An online checkout that wasn't paid within a week is put away quietly.
  const CHECKOUT_DAYS = 7;
  const staleCheckout = (o) => !!o.checkout && o.status === "quoted" && Date.now() - new Date(o.created).getTime() > CHECKOUT_DAYS * 864e5;
  const isArchived = (o) => !needsAction(o) && !!(o.status === "cancelled" || o.status === "refunded" || expired(o) || staleCheckout(o));

  /* ---------- page shell ---------- */
  const CSS = `body{font:15px/1.5 system-ui,sans-serif;margin:0;padding:24px max(16px,env(safe-area-inset-left));background:#F4F2EC;color:#1C1F1D}
h1{font-weight:500;margin:0 0 4px}h2{font-weight:500;font-size:20px;margin:24px 0 8px}a{color:#33443A}
p.w{background:#F3E6C8;padding:8px 12px;border-radius:3px;max-width:80ch}p.ok{background:#E3E8E2;padding:8px 12px;border-radius:3px;max-width:80ch}p.bad,li.bad{color:#9B2C1F;font-weight:600}
.wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;background:#fff}th,td{text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid #DAD6CC}th{font-weight:500;color:#5D625C}
.m{color:#5D625C;font-size:13px}.n{font-variant-numeric:tabular-nums;white-space:nowrap}a.b,a.btn{background:#4B5F51;color:#fff;padding:5px 10px;border-radius:3px;text-decoration:none;font-weight:600;display:inline-block}a.btn.ghost{background:#fff;color:#4B5F51;border:1.5px solid #4B5F51;padding:4px 9px}
.tag{display:inline-block;margin-top:4px;font-size:12px;font-weight:600;padding:2px 8px;border-radius:10px;background:#E3E8E2;color:#33443A}.s-new .tag{background:#F3E6C8;color:#6B4E1E}.s-paid .tag{background:#4B5F51;color:#fff}.s-cancelled,.s-refunded{opacity:.75}.tag.exp{background:#F3D9D3;color:#7A2A1C}
.acts{min-width:280px}.f{margin:0 0 10px;display:flex;gap:6px;flex-wrap:wrap;align-items:center}.f input,.f select,.f textarea{font:inherit;padding:4px 6px;border:1px solid #BDB8AC;border-radius:3px}
button{font:inherit;font-weight:600;padding:5px 10px;border-radius:3px;border:1.5px solid #4B5F51;background:#4B5F51;color:#fff;cursor:pointer}button.ghost,.copy{background:#fff;color:#4B5F51}button.danger{background:#9B2C1F;border-color:#9B2C1F}
.col{display:flex;flex-direction:column;gap:2px;flex-basis:100%}.col textarea{font-size:14px;resize:vertical}.next{flex-basis:100%;margin:0}
.flag{border-radius:3px;padding:8px 10px;margin:0 0 10px;font-weight:600;font-size:14px}.flag.act{background:#F3D9D3;color:#7A2A1C}.flag.todo{background:#F3E6C8;color:#6B4E1E}.flag a.btn{margin-top:6px}
.queue{background:#fff;border:1px solid #DAD6CC;border-radius:3px;padding:10px 14px;max-width:900px}.queue li{margin:4px 0}
details ul{margin:4px 0;padding-left:18px}.link{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 10px}.link input{flex:1 1 200px;font:13px ui-monospace,monospace;padding:4px 6px;border:1px solid #BDB8AC;border-radius:3px}
.bar{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;margin:8px 0}.foot{display:flex;gap:12px;align-items:center;flex-wrap:wrap;border-top:1px solid #EEE;padding-top:8px}
.form{background:#fff;border:1px solid #DAD6CC;border-radius:3px;padding:16px;max-width:760px;display:grid;gap:12px}.form label{display:grid;gap:4px;font-weight:600}.form input[type=text],.form textarea{font:inherit;font-weight:400;padding:6px 8px;border:1px solid #BDB8AC;border-radius:3px}.form textarea{font-size:15px;line-height:1.5}
iframe{width:100%;max-width:760px;height:640px;border:1px solid #DAD6CC;background:#fff;border-radius:3px}`;
  const shell = (title, body) => `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} | Pivot Designs</title><style>${CSS}</style></head><body>${body}</body></html>`;
  const page = (res, title, body, code = 200) => res.status(code).set("Cache-Control", "no-store").send(shell(title, body));

  const GUIDE = `<details class="queue" style="margin:8px 0"><summary><b>How this page works</b></summary>
<p><b>Payment mode</b> (on the Pricing page): <b>Quote first</b> works as below. In <b>Pay online</b>, customers in mainland Great Britain pay straight away at the website price: the order arrives here already <b>Paid</b>, and you both get an email. Orders they didn't finish paying show <i>Awaiting payment (online checkout)</i> and move to Archived after ${CHECKOUT_DAYS} days. Addresses outside the delivery area (Northern Ireland, the islands, the Scottish Highlands, the Isle of Wight) and anyone who asks for a quote still come in as quote requests, as below.</p>
<p><b>A customer's order (Quote first, or a quote request)</b></p><ol>
<li>The customer sends a request from the website. You and they each get an email automatically, and the order shows <i>Action required: confirm the price</i>.</li>
<li>Check the doors (download the DXF if you like), set the price, add an optional note (e.g. lead time), and press <b>Confirm price</b>.</li>
<li>You're shown the payment email. Edit it if you want, press <b>Update preview</b> to check it, then <b>Send email</b>. Or press <b>Not now</b>, and the order stays flagged until you do.</li>
<li>When they pay by card, the order turns <b>Paid</b> and you both get an email automatically.</li>
<li>Cut the doors (set the status to <b>Cut</b> if you like), then <b>Mark dispatched</b> with the courier and tracking number, and send the "on its way" email from the preview.</li></ol>
<p><b>Creating an order for someone</b> (phone, email or Etsy enquiry)</p><ol>
<li>Press <b>+ New order</b>. The door designer opens in admin mode, with a yellow bar at the top.</li>
<li>Add their doors, fill in their name, email, address and postcode, and press <b>Create order</b>. Nobody is emailed.</li>
<li>You're brought back here. Continue from step 2 above: Confirm price, then send the payment email.</li></ol>
<p><b>Paid by bank transfer or cash:</b> press <b>Mark paid (not Stripe)</b>, then send or skip the "Payment received" email.</p>
<p><b>Refunds:</b> refund in Stripe (Transactions → the payment → Refund). The order updates by itself to <b>Refunded</b> (or shows a part refund) and is flagged so you can send the customer a refund email.</p>
<p><b>Any other message:</b> press <b>Email customer…</b> on the order. It's logged in the order's History.</p>
<p><b>Deleting:</b> <b>Delete…</b> removes an order for good. Use it for test orders and duplicates. Paid orders are sales records you should keep for six years, so they ask you to type the order reference first.</p>
<p><b>Archived</b> holds cancelled and refunded orders, prices not paid within ${pay.QUOTE_DAYS} days, and online checkouts not paid within ${CHECKOUT_DAYS} days.</p></details>`;

  /* ---------- the orders list ---------- */
  function orderRow(o) {
    const status = o.status || "new";
    const ref = encodeURIComponent(o.ref);
    const act = `/admin/orders/${ref}`;
    const flags = actions(o).map((a) => `<div class="flag ${a.level}">${a.level === "act" ? "Action required: " : "To do: "}${esc(a.text)}${a.kind ? `<br><a class="btn" href="${act}/email?kind=${a.kind}">Preview and send email…</a>` : ""}</div>`).join("");
    const price = o.quote != null ? o.quote : estimatePence(o);
    const priceBox = status === "new" || status === "quoted"
      ? `<form method="post" action="${act}" class="f"><input type="hidden" name="action" value="quote">
          <label>Price £ <input name="price" inputmode="decimal" value="${(price / 100).toFixed(2)}" size="7" aria-label="Price for ${esc(o.ref)} in pounds"></label>
          <button>${status === "new" ? "Confirm price" : "Change price"}</button>
          <label class="col m">Note to customer (optional, included in the payment email and page)<textarea name="note" rows="2" maxlength="600" placeholder="e.g. Ready to dispatch within 2 weeks of payment.">${esc(o.quoteNote || "")}</textarea></label>
          <p class="next m">Next, you'll see the payment email. Nothing is sent until you press Send.</p></form>`
      : "";
    const link = status === "quoted" && !expired(o)
      ? `<div class="link"><span class="m">Payment link:</span><input readonly value="${esc(payLink(o))}" aria-label="Payment link for ${esc(o.ref)}"><button type="button" class="copy">Copy</button></div>`
      : "";
    const paid = o.payment ? `<p class="m">Paid ${money(o.payment.amount)} by ${esc(o.payment.method)}, ${esc(when(o.payment.at))}${o.refund ? `<br><b>Refunded ${money(o.refund.amount)}</b>, ${esc(when(o.refund.at))}` : ""}</p>` : "";
    const markPaid = status === "new" || status === "quoted"
      ? `<form method="post" action="${act}" class="f" onsubmit="return confirm('Record ${esc(o.ref)} as paid by bank transfer or cash? No email is sent yet.')"><input type="hidden" name="action" value="paid"><button class="ghost">Mark paid (not Stripe)</button></form>`
      : "";
    const dispatchForm = status === "paid" || status === "cut"
      ? `<form method="post" action="${act}" class="f"><input type="hidden" name="action" value="dispatch">
          <label class="col m">Delivery note (optional, e.g. courier and tracking number)<textarea name="note" rows="2" maxlength="600" placeholder="e.g. Sent with DPD, tracking 15501234567890."></textarea></label>
          <button>Mark dispatched</button><p class="next m">Next, you'll see the "on its way" email. Nothing is sent until you press Send.</p></form>`
      : "";
    const dispatched = o.dispatchedAt ? `<p class="m">Dispatched ${esc(when(o.dispatchedAt))}${o.dispatchNote ? ": " + esc(o.dispatchNote) : ""}</p>` : "";
    const statusForm = `<form method="post" action="${act}" class="f"><input type="hidden" name="action" value="status">
        <select name="status" aria-label="Status of ${esc(o.ref)}">${STATUSES.filter((s) => (s !== "paid" && s !== "refunded") || s === status).map((s) => `<option value="${s}"${s === status ? " selected" : ""}>${STATUS_TEXT[s]}</option>`).join("")}</select>
        <button class="ghost">Save status</button></form>`;
    const foot = `<div class="foot"><a class="btn ghost" href="${act}/email?kind=custom">Email customer…</a><a href="${act}/delete" class="m">Delete…</a></div>`;
    const history = (o.history || []).length
      ? `<details class="m"><summary>History (${o.history.length})</summary><ul>${o.history.slice().reverse().map((h) => `<li${/FAILED/.test(h.what) ? ' class="bad"' : ""}>${esc(when(h.at))}: ${esc(h.what)}</li>`).join("")}</ul></details>`
      : "";
    const validity = expired(o) ? `<br><span class="tag exp">Price expired</span>` : status === "quoted" && o.quotedAt ? `<br><span class="m">Price valid until ${esc(when(pay.quoteExpires(o), { dateStyle: "short" }))}</span>` : "";
    return `<tr id="${esc(o.ref)}" class="s-${status}">
      <td><b>${esc(o.ref)}</b><br><span class="m">${esc(when(o.created))}${o.source === "admin" ? " · created by you" : ""}</span><br><span class="tag">${o.checkout && status === "quoted" ? "Awaiting payment (online checkout)" : STATUS_TEXT[status]}</span>${o.checkout ? `<br><span class="m">Online checkout${status === "quoted" ? ", not paid yet" : ""}</span>` : ""}${validity}</td>
      <td>${esc(o.customer.name)}<br><span class="m">${esc(o.customer.email)}${o.customer.phone ? " · " + esc(o.customer.phone) : ""}<br>${esc(o.customer.address)}<br>${esc(o.customer.postcode)}</span></td>
      <td>${o.doors.map((d, i) => `${i + 1}. ${d.qty} × ${esc(E.designById(d.design).name)} ${d.width} × ${d.height}${d.name ? " (" + esc(d.name) + ")" : ""}<br><span class="m">${esc(E.describe(d))}</span>`).join("<br>")}${o.customer.notes ? `<p class="m">Notes: ${esc(o.customer.notes)}</p>` : ""}
        <p><a class="b" href="${act}.dxf">DXF</a> <a href="${act}.json">Spec</a></p></td>
      <td class="n">Estimate ${money(estimatePence(o))}${o.quote != null ? `<br><b>Price ${money(o.quote)}</b>` : ""}</td>
      <td class="acts">${flags}${priceBox}${link}${paid}${markPaid}${dispatchForm}${dispatched}${statusForm}${foot}${history}</td></tr>`;
  }

  router.get("/admin", wrap(async (req, res) => {
    const all = await store.list();
    const showArchived = req.query.archived === "1";
    const list = all.filter((o) => isArchived(o) === showArchived);
    const archivedCount = all.filter(isArchived).length;
    const queue = all.filter(needsAction);
    const payState = pay.enabled ? (pay.testMode ? "Stripe payments are on in <b>test mode</b>: no real money is taken." : "Stripe payments are <b>live</b>.") : "Stripe payments are off. Add STRIPE_SECRET_KEY in Render's Environment settings to turn them on.";
    const storeState = store.kind === "postgres" ? "" : `<p class="w">Testing only: orders are kept on Render's temporary disk and disappear when the site is redeployed. Connect the database to keep them.</p>`;
    const q = req.query;
    const flash = typeof q.sent === "string" ? `<p class="ok">Email sent for ${esc(q.sent)}.</p>`
      : typeof q.deleted === "string" ? `<p class="ok">Order ${esc(q.deleted)} deleted.</p>`
      : typeof q.later === "string" ? `<p class="w">No email sent for ${esc(q.later)}. It's still flagged as needing action.</p>`
      : typeof q.dismissed === "string" ? `<p class="ok">Flag cleared for ${esc(q.dismissed)}. No email was sent.</p>`
      : typeof q.created === "string" ? `<p class="ok">Order ${esc(q.created)} created. The customer hasn't been emailed. Confirm the price when you're ready.</p>` : "";
    const queueBox = !showArchived && queue.length
      ? `<h2>Needs action (${queue.length})</h2><ul class="queue">${queue.map((o) => `<li><a href="#${esc(o.ref)}"><b>${esc(o.ref)}</b></a> ${esc(o.customer.name)}: ${actions(o).filter((a) => a.level === "act").map((a) => esc(a.text)).join("; ")}</li>`).join("")}</ul>` : "";
    page(res, showArchived ? "Archived orders" : "Orders", `<h1>${showArchived ? "Archived orders" : "Orders"}</h1>
<div class="bar"><a class="btn" href="/configurator?admin">+ New order</a><a href="/admin/pricing">Pricing</a><a href="/admin/security">Security</a><form method="post" action="/admin/logout" style="display:inline;margin:0"><button class="ghost">Sign out</button></form><span class="m">Payment mode: <b>${site.mode() === "checkout" ? "Pay online" : "Quote first"}</b></span>${showArchived ? `<a href="/admin">Back to current orders</a>` : `<a href="/admin?archived=1">Archived (${archivedCount})</a>`}<span class="m">${payState} ${email.enabled() ? "Emails are on." : "Emails are off (no RESEND_API_KEY)."}</span></div>
${storeState}${flash}
${showArchived ? `<p class="m">Cancelled and refunded orders, and prices not paid within ${pay.QUOTE_DAYS} days. To revive an expired price, use Change price; this restarts the ${pay.QUOTE_DAYS} days.</p>` : `<p class="m">Customers are only emailed automatically when <i>they</i> do something: send a request, or pay by card. Anything you do shows an <b>Action required</b> flag and a preview, and nothing is sent until you press Send.</p>`}
${showArchived ? "" : GUIDE}${queueBox}
<h2>${list.length} order${list.length === 1 ? "" : "s"}, newest first</h2>
<div class="wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Doors</th><th>Price</th><th>Actions</th></tr></thead><tbody>${list.map(orderRow).join("") || '<tr><td colspan="5">No orders here.</td></tr>'}</tbody></table></div>
<script>document.addEventListener("click",function(e){if(!e.target.classList.contains("copy"))return;var i=e.target.previousElementSibling;i.select();(navigator.clipboard?navigator.clipboard.writeText(i.value):Promise.reject()).catch(function(){document.execCommand("copy")}).finally(function(){e.target.textContent="Copied";setTimeout(function(){e.target.textContent="Copy"},1500)})});</script>`);
  }));

  /* ---------- creating an order for a customer ----------
   * The configurator at /configurator?admin posts here instead of /api/orders.
   * Same checks as a customer's request, but no emails are sent. */
  router.post("/admin/orders", sameSite, express.json({ limit: "200kb" }), wrap(async (req, res) => {
    const r = await orders.createOrder(req.body || {}, { source: "admin" });
    if (r.error) return res.status(400).json({ error: r.error });
    res.status(201).json({ ref: r.order.ref });
  }));

  /* ---------- the buttons on each order ---------- */
  router.post("/admin/orders/:ref", sameSite, express.urlencoded({ extended: false, limit: "20kb" }), wrap(async (req, res) => {
    const { action } = req.body;
    let problem = "", next = "";
    const noteText = cleanLines(req.body.note, 600);
    const o = await store.update(req.params.ref, (o) => {
      const status = o.status || "new";
      if (action === "quote") {
        const pounds = Number(String(req.body.price || "").replace(/[£,\s]/g, ""));
        if (!(pounds >= 1 && pounds <= 20000)) { problem = "Enter a price between £1 and £20,000."; return null; }
        if (status !== "new" && status !== "quoted") { problem = "This order is already paid, so its price can't change."; return null; }
        o.quote = Math.round(pounds * 100);
        o.quotedAt = new Date().toISOString();
        o.status = "quoted";
        o.payToken = o.payToken || newToken();
        o.quoteNote = noteText;
        o.pendingEmail = "paylink";
        note(o, `Price confirmed: ${money(o.quote)}${noteText ? " (with note)" : ""}`);
        next = "paylink";
        return o;
      }
      if (action === "paid") {
        const r = pay.applyPayment(o, { id: "manual-" + Date.now(), method: "bank transfer or cash", amount: o.quote != null ? o.quote : estimatePence(o), at: new Date().toISOString() });
        if (!r) return null;
        r.pendingEmail = "paid";
        next = "paid";
        return r;
      }
      if (action === "dispatch") {
        if (status !== "paid" && status !== "cut") { problem = "Only paid orders can be dispatched."; return null; }
        o.status = "dispatched";
        o.dispatchedAt = new Date().toISOString();
        o.dispatchNote = noteText;
        o.pendingEmail = "dispatched";
        note(o, `Dispatched${noteText ? ": " + noteText : ""}`);
        next = "dispatched";
        return o;
      }
      if (action === "status") {
        const to = req.body.status;
        if (!STATUSES.includes(to) || to === status) return null;
        if (to === "paid") { problem = "Use Mark paid to record a payment."; return null; }
        if (to === "refunded") { problem = "Refunds are recorded automatically when you refund in Stripe."; return null; }
        if (to === "quoted" && o.quote == null) { problem = "Confirm a price first."; return null; }
        o.status = to;
        if (to === "cancelled" && o.pendingEmail === "paylink") o.pendingEmail = null;
        note(o, `Status: ${STATUS_TEXT[to]}`);
        return o;
      }
      problem = "Unknown action.";
      return null;
    });
    if (!o) return res.status(404).type("text").send("No order with that reference.");
    if (problem) return page(res, "Can't do that", `<p class="bad">${esc(problem)}</p><p><a href="/admin#${esc(o.ref)}">Back to orders</a></p>`, 400);
    if (next) return res.redirect(303, `/admin/orders/${encodeURIComponent(o.ref)}/email?kind=${next}`);
    res.redirect(303, "/admin#" + encodeURIComponent(o.ref));
  }));

  /* ---------- preview, edit and send a customer email ---------- */
  function emailProblem(kind, o) {
    if (!email.KINDS[kind]) return "Unknown email type.";
    if (kind === "paylink" && (o.status !== "quoted" || !o.quote)) return "This order has no confirmed price waiting for payment, so there's no payment link to send.";
    if (kind === "paylink" && expired(o)) return `This price has expired. Use Change price on the orders page to restart the ${pay.QUOTE_DAYS} days first.`;
    if (kind === "refunded" && !o.refund) return "No refund has been recorded for this order.";
    if (!o.customer.email) return "This order has no customer email address.";
    return "";
  }
  const ctxFor = (kind, o) => ({ link: kind === "paylink" ? payLink(o) : undefined, expires: o.quotedAt ? pay.quoteExpires(o) : undefined });

  function emailPage(res, o, kind, d, { nonce, error, code } = {}) {
    const ref = encodeURIComponent(o.ref);
    const r = email.render(kind, o, d, ctxFor(kind, o));
    const pending = o.pendingEmail === kind;
    page(res, `Email ${o.ref}`, `<p><a href="/admin#${esc(o.ref)}">← Back to orders</a></p>
<h1>Email the customer: ${esc(email.KINDS[kind])}</h1>
<p class="m">Order <b>${esc(o.ref)}</b>. To: <b>${esc(o.customer.name)} &lt;${esc(o.customer.email)}&gt;</b>. Replies come to you at your normal email address.</p>
${pending ? `<p class="w">This email is flagged as <b>Action required</b> on the order. It stays flagged until you send it or mark it as not needed.</p>` : ""}
${error ? `<p class="bad">${esc(error)}</p>` : ""}
${email.enabled() ? "" : `<p class="w">Emails are switched off (no RESEND_API_KEY in Render), so Send won't deliver anything.</p>`}
<form method="post" action="/admin/orders/${ref}/email?kind=${kind}" class="form">
  <input type="hidden" name="nonce" value="${esc(nonce || crypto.randomBytes(8).toString("hex"))}">
  <label>Subject<input type="text" name="subject" value="${esc(r.subject)}" maxlength="200"></label>
  <label>Message<textarea name="message" rows="14" maxlength="6000">${esc(d.message)}</textarea></label>
  <label style="display:flex;gap:6px;align-items:center;font-weight:400"><input type="checkbox" name="doors" value="1"${d.doors ? " checked" : ""}> Include the list of doors</label>
  <p class="m" style="margin:0">${kind === "paylink" ? "The Pay button and link are added below your message automatically. " : ""}${kind === "dispatched" ? "The delivery address is added automatically. " : ""}Leave a blank line between paragraphs.</p>
  <div class="bar"><button name="do" value="preview" class="ghost">Update preview</button><button name="do" value="send">Send email</button>
  <a href="/admin?later=${ref}#${ref}">Not now</a>${pending ? `<button name="do" value="dismiss" class="ghost" onclick="return confirm('Clear the flag without sending anything?')">No email needed</button>` : ""}</div>
</form>
<h2>Preview</h2><p class="m">Exactly what the customer will receive. Press Update preview after editing.</p>
<iframe sandbox title="Email preview" srcdoc="${esc(r.html)}"></iframe>`, code || 200);
  }

  router.get("/admin/orders/:ref/email", wrap(async (req, res) => {
    const o = await store.get(req.params.ref);
    if (!o) return res.status(404).type("text").send("No order with that reference.");
    const kind = String(req.query.kind || "custom");
    const problem = emailProblem(kind, o);
    if (problem) return page(res, "Can't send that email", `<p class="bad">${esc(problem)}</p><p><a href="/admin#${esc(o.ref)}">Back to orders</a></p>`, 400);
    emailPage(res, o, kind, email.draft(kind, o, ctxFor(kind, o)));
  }));

  router.post("/admin/orders/:ref/email", sameSite, express.urlencoded({ extended: false, limit: "40kb" }), wrap(async (req, res) => {
    const o = await store.get(req.params.ref);
    if (!o) return res.status(404).type("text").send("No order with that reference.");
    const kind = String(req.query.kind || "custom");
    const problem = emailProblem(kind, o);
    if (problem) return page(res, "Can't send that email", `<p class="bad">${esc(problem)}</p><p><a href="/admin#${esc(o.ref)}">Back to orders</a></p>`, 400);
    const d = { subject: clean(req.body.subject, 200), message: cleanLines(req.body.message, 6000), doors: req.body.doors === "1" };
    const nonce = /^[a-f0-9]{16}$/.test(req.body.nonce || "") ? req.body.nonce : undefined;
    const ref = encodeURIComponent(o.ref);
    if (req.body.do === "dismiss") {
      await store.update(o.ref, (x) => { if (x.pendingEmail !== kind) return null; x.pendingEmail = null; note(x, `No email sent: "${email.KINDS[kind]}" marked as not needed`); return x; });
      return res.redirect(303, `/admin?dismissed=${ref}#${ref}`);
    }
    if (req.body.do !== "send") return emailPage(res, o, kind, d, { nonce });
    if (!d.subject || !d.message) return emailPage(res, o, kind, d, { nonce, error: "Add a subject and a message before sending.", code: 400 });
    const r = await mail(o.ref, `"${email.KINDS[kind]}" to ${o.customer.email}: ${d.subject}`, () => email.sendCustomer(kind, o, d, { ...ctxFor(kind, o), nonce }));
    if (!r.ok || /not sent/.test(r.what)) return emailPage(res, o, kind, d, { nonce: crypto.randomBytes(8).toString("hex"), error: `Not sent. ${r.what}`, code: 502 });
    await store.update(o.ref, (x) => { if (x.pendingEmail !== kind) return null; x.pendingEmail = null; return x; });
    res.redirect(303, `/admin?sent=${ref}#${ref}`);
  }));

  /* ---------- delete ---------- */
  router.get("/admin/orders/:ref/delete", wrap(async (req, res) => {
    const o = await store.get(req.params.ref);
    if (!o) return res.status(404).type("text").send("No order with that reference.");
    const ref = encodeURIComponent(o.ref);
    const paid = !!o.payment;
    page(res, `Delete ${o.ref}`, `<p><a href="/admin#${esc(o.ref)}">← Back to orders</a></p>
<h1>Delete order ${esc(o.ref)}?</h1>
<p>${esc(o.customer.name)} · ${o.totals.count} door${o.totals.count === 1 ? "" : "s"} · ${esc(STATUS_TEXT[o.status || "new"])}${o.quote != null ? ` · ${money(o.quote)}` : ""}</p>
<p class="w">This removes the order, its door list and its history for good. The customer isn't told, and their payment link stops working. It can't be undone.${paid ? `<br><br><b>This order was paid (${money(o.payment.amount)} by ${esc(o.payment.method)}).</b> Paid orders are sales records you must keep for six years for tax, so only delete test orders or duplicates. Deleting here doesn't refund or remove the payment in Stripe.` : ""}</p>
<form method="post" action="/admin/orders/${ref}/delete" class="form">
${paid ? `<label>Type the order reference <b>${esc(o.ref)}</b> to confirm<input type="text" name="confirm" autocomplete="off"></label>` : `<input type="hidden" name="confirm" value="${esc(o.ref)}">`}
<div class="bar"><button class="danger">Delete for good</button><a href="/admin#${esc(o.ref)}">Cancel</a></div></form>`);
  }));
  router.post("/admin/orders/:ref/delete", sameSite, express.urlencoded({ extended: false, limit: "5kb" }), wrap(async (req, res) => {
    const o = await store.get(req.params.ref);
    if (!o) return res.status(404).type("text").send("No order with that reference.");
    if (String(req.body.confirm || "").trim().toUpperCase() !== o.ref) {
      return page(res, "Not deleted", `<p class="bad">The reference didn't match, so nothing was deleted.</p><p><a href="/admin/orders/${encodeURIComponent(o.ref)}/delete">Try again</a> · <a href="/admin">Back to orders</a></p>`, 400);
    }
    await store.remove(o.ref);
    console.log(`Order ${o.ref} deleted on /admin`);
    res.redirect(303, `/admin?deleted=${encodeURIComponent(o.ref)}`);
  }));

  /* ---------- files ---------- */
  router.get("/admin/orders/:ref.dxf", wrap(async (req, res) => {
    const o = await store.get(req.params.ref);
    if (!o) return res.status(404).type("text").send("No order with that reference.");
    res.set("Content-Type", "application/dxf").set("Content-Disposition", `attachment; filename="${o.ref}.dxf"`).set("Cache-Control", "no-store");
    res.send(E.orderDXF(o));
  }));
  router.get("/admin/orders/:ref.json", wrap(async (req, res) => {
    const o = await store.get(req.params.ref);
    if (!o) return res.status(404).type("text").send("No order with that reference.");
    const { payToken, ...rest } = o;
    res.set("Cache-Control", "no-store").json(rest);
  }));

  /* ---------- pricing (/admin/pricing) ---------- */
  // Website prices are Tim's Etsy band prices less a discount (10%), rounded down to
  // the pound, so a website customer always pays less than on Etsy. Sizes beyond
  // the bands are priced by sheet use, scaled from the largest band. The Etsy
  // figures stay on this private page: /api/pricing only carries the website prices.
  // Stored settings: "pricingRef" (Etsy prices and the discount, private) and
  // "pricing" (what the engine and the website use).
  const REF_DEFAULTS = { etsy: [30, 40, 60, 75], discount: 10 };
  const bandsFrom = (ref) => E.PRICING_DEFAULTS.bands.map((b, i) => ({ ...b, price: Math.floor(ref.etsy[i] * (1 - ref.discount / 100)) }));
  const loadRef = async () => {
    const r = await store.getSetting("pricingRef");
    return r && Array.isArray(r.etsy) && r.etsy.length === REF_DEFAULTS.etsy.length ? r : REF_DEFAULTS;
  };
  const SIZES = [[300, 600], [450, 600], [600, 600], [450, 640], [500, 720], [600, 720], [600, 900], [600, 1150], [700, 720], [800, 1150], [900, 1150], [1000, 1200]];
  async function pricingPage(res, msg, code) {
    const P = E.getPricing(), ref = await loadRef();
    const n = (name, v, step) => `<input type="number" name="${name}" value="${v}" step="${step || "any"}" min="0" required>`;
    const bandRows = P.bands.map((b, i) => `<tr><td>${esc(b.name)}</td><td class="n">up to ${b.maxW} × ${b.maxH} mm</td><td>${n("etsy" + i, ref.etsy[i], 1)}</td><td class="n"><b>£${b.price}</b></td></tr>`).join("");
    const etsyOf = (w, h) => { const i = P.bands.findIndex((b) => w <= b.maxW && h <= b.maxH); return i < 0 ? null : ref.etsy[i]; };
    const examples = `<div class="wrap"><table><tr><th>Door size</th><th>Band</th><th class="n">Etsy</th><th class="n">Website</th></tr>` +
      SIZES.map(([w, h]) => { const band = E.bandFor(w, h), e = etsyOf(w, h); return `<tr><td class="n">${w} × ${h} mm</td><td>${band ? esc(band.name) : "Bigger than the bands (priced by sheet use)"}</td><td class="n">${e != null ? "£" + e : "not sold"}</td><td class="n"><b>£${E.priceDoor({ design: "slab", width: w, height: h, opts: {}, qty: 1 })}</b></td></tr>`; }).join("") + `</table></div>`;
    const m = site.mode();
    const modeForm = `<form method="post" class="form" action="/admin/mode" style="max-width:900px"><h2 style="margin-top:0">Payment mode</h2>
<label style="font-weight:400"><span><input type="radio" name="mode" value="quote"${m === "quote" ? " checked" : ""}> <b>Quote first</b>: customers send a request, you confirm the price and send a payment link.</span></label>
<label style="font-weight:400"><span><input type="radio" name="mode" value="checkout"${m === "checkout" ? " checked" : ""}> <b>Pay online</b>: customers pay straight away at the website price. Addresses outside mainland Great Britain (and the Isle of Wight and Scottish Highlands), and anyone who asks, send a quote request instead.</span></label>
<p class="m">The wording on the home page, Shop, terms and emails changes to match. Orders already in progress carry on as they are.</p>
<div class="f"><button>Save payment mode</button></div></form>`;
    page(res, "Pricing", `<h1>Pricing</h1><p><a href="/admin">Back to orders</a></p>${msg || ""}${modeForm}
<p class="m" style="max-width:80ch">Every door in a band costs the same, whatever the design: your Etsy price for that band, less the discount, rounded down to the pound, so website customers always pay less than on Etsy. Doors bigger than the largest band are priced by how much of a half sheet they use, scaled from the Extra large price. Delivery is charged the same as on Etsy, but it's free on the website for bigger orders. Changes apply straight away. Orders already received keep their prices. Etsy is never shown on the public website.</p>
<form method="post" class="form" action="/admin/pricing" style="max-width:900px">
<h2>Bands</h2><div class="wrap"><table><tr><th>Band</th><th>Sizes</th><th>Etsy price (£)</th><th>Website price</th></tr>${bandRows}</table></div>
<label>Website discount off Etsy (%) ${n("discount", ref.discount, 1)}</label>
<h2>Delivery (£)</h2>
<label>First door ${n("delivery.first", P.delivery.first)}</label><label>Each extra door ${n("delivery.extra", P.delivery.extra)}</label>
<label>Free delivery when the doors come to at least (0 = never) ${n("delivery.freeOver", P.delivery.freeOver)}</label>
<h2>Doors bigger than the bands</h2><p class="m">Used to work out how much of a half sheet a door takes.</p>
<label>Half sheet size (mm, square) ${n("sheet", P.sheet, 1)}</label><label>Border round the sheet (mm) ${n("border", P.border, 1)}</label><label>Gap between parts (mm) ${n("gap", P.gap, 1)}</label>
<label>Share of a wasted strip charged (0 to 1) ${n("wasteShare", P.wasteShare, 0.05)}<span class="m">If a door leaves a strip too narrow for another door: 0.5 charges half of it.</span></label>
<div class="f"><button>Save prices</button> <button class="ghost" name="reset" value="1" onclick="return confirm('Put every price setting back to the starting values?')">Reset to starting values</button></div></form>
<h2>Example prices</h2>${examples}`, code);
  }
  /* ---------- /admin/security: sign-in log, sign out everywhere, backup codes ---------- */
  const securityPage = (res, msg = "") => page(res, "Security", `<h1>Security</h1><p><a href="/admin">Back to orders</a></p>${msg}${auth.securityHtml()}`);
  router.get("/admin/security", (req, res) => securityPage(res));
  router.post("/admin/security", sameSite, express.urlencoded({ extended: false, limit: "2kb" }), wrap(async (req, res) => {
    const r = await auth.securityPost(req);
    if (r.out) return res.redirect(303, "/admin/login");
    securityPage(res, r.msg);
  }));

  router.get("/admin/pricing", wrap(async (req, res) => pricingPage(res)));
  router.post("/admin/mode", sameSite, express.urlencoded({ extended: false, limit: "2kb" }), wrap(async (req, res) => {
    if (!["quote", "checkout"].includes(req.body.mode)) return pricingPage(res, `<p class="bad">Choose a payment mode.</p>`, 400);
    const m = await site.setMode(req.body.mode);
    pricingPage(res, `<p class="ok">Payment mode is now <b>${m === "checkout" ? "Pay online" : "Quote first"}</b>. The website has switched.</p>`);
  }));
  router.post("/admin/pricing", sameSite, express.urlencoded({ extended: false, limit: "10kb" }), wrap(async (req, res) => {
    let ref, cfg;
    if (req.body.reset) { ref = REF_DEFAULTS; cfg = {}; }
    else {
      const b = req.body, num = (v) => (v === undefined || v === "" ? NaN : Number(v));
      ref = { etsy: REF_DEFAULTS.etsy.map((_, i) => num(b["etsy" + i])), discount: num(b.discount) };
      cfg = { sheet: num(b.sheet), border: num(b.border), gap: num(b.gap), wasteShare: num(b.wasteShare), delivery: { first: num(b["delivery.first"]), extra: num(b["delivery.extra"]), freeOver: num(b["delivery.freeOver"]) } };
      const ok = (v) => Number.isFinite(v) && v >= 0;
      const bad = [];
      if (!ref.etsy.every(ok)) bad.push("Etsy prices");
      if (!ok(ref.discount) || ref.discount >= 100) bad.push("Discount (0 to 99)");
      if (![cfg.sheet, cfg.border, cfg.gap, cfg.wasteShare, cfg.delivery.first, cfg.delivery.extra, cfg.delivery.freeOver].every(ok)) bad.push("Delivery and sheet settings");
      if (cfg.wasteShare > 1) bad.push("Share of a wasted strip (1 or less)");
      if (cfg.sheet - 2 * cfg.border < 1000) bad.push("Half sheet size and border (the usable area must fit a 1000 mm door)");
      if (bad.length) return pricingPage(res, `<p class="bad">Not saved. Please check: ${bad.map(esc).join("; ")}.</p>`, 400);
      cfg.bands = bandsFrom(ref);
    }
    const saved = E.setPricing(cfg);
    await store.setSetting("pricingRef", ref);
    await store.setSetting("pricing", saved);
    await pricingPage(res, `<p class="ok">${req.body.reset ? "Prices reset to the starting values." : "Prices saved."} The website uses them now.</p>`);
  }));

  return { router };
};
