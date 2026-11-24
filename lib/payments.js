// Online payment with Stripe Checkout.
//
// How it works:
// 1. A customer sends an order request. It's saved with status "new" and a
//    secret pay token.
// 2. Tim checks it on /admin, confirms the price, and the order becomes
//    "quoted". The admin page then shows a payment link, /pay/<ref>?t=<token>,
//    for Tim to email to the customer.
// 3. The customer opens the link, sees the order and the price, and clicks Pay.
//    The site makes a fresh Stripe Checkout page each time, so the link
//    never expires. The payment methods offered are chosen in
//    the Stripe dashboard (Settings → Payment methods).
// 4. Stripe tells the site the payment went through (the webhook), and the
//    order becomes "paid". The thank-you page also checks with Stripe, so the
//    order shows as paid even if the webhook is slow.
//
// Settings in Render's Environment tab:
//   STRIPE_SECRET_KEY       sk_test_... while testing; for live, a restricted key rk_live_...
//   STRIPE_WEBHOOK_SECRET   whsec_... from Stripe's webhook page
//   SITE_URL                https://pivotdesigns.co.uk (where Stripe sends people back to)
const express = require("express");
const crypto = require("crypto");

// A confirmed price can be paid for this many days (see /terms).
const QUOTE_DAYS = 30;
const quoteExpires = (o) => (o.quotedAt ? new Date(new Date(o.quotedAt).getTime() + QUOTE_DAYS * 864e5) : null);
const quoteExpired = (o) => o.status === "quoted" && !!o.quotedAt && Date.now() > quoteExpires(o).getTime();
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (pence) => "£" + (pence / 100).toFixed(2);
const sameToken = (a, b) => {
  if (!a || !b) return false;
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

// Records a payment once. Called by the webhook and by the thank-you page.
function applyPayment(order, p) {
  if (order.status === "paid" || (order.payment && order.payment.id === p.id)) return null;
  order.status = "paid";
  order.payment = p;
  if (order.pendingEmail === "paylink") order.pendingEmail = null; // they've paid, so no need to send the link
  order.history = (order.history || []).concat({ at: p.at, what: `Paid ${money(p.amount)} by ${p.method}` });
  return order;
}
// Records a refund made in the Stripe dashboard. Stripe reports the total
// refunded so far, so repeats and part refunds are handled the same way.
function applyRefund(order, totalRefunded) {
  const before = order.refund ? order.refund.amount : 0;
  if (!order.payment || totalRefunded <= before) return null;
  order.refund = { amount: totalRefunded, at: new Date().toISOString() };
  const full = totalRefunded >= order.payment.amount;
  if (full) order.status = "refunded";
  order.pendingEmail = "refunded";
  order.history = (order.history || []).concat({ at: order.refund.at, what: `${full ? "Refunded" : "Part refunded"} ${money(totalRefunded - before)} in Stripe${full ? "" : ` (${money(totalRefunded)} of ${money(order.payment.amount)} so far)`}` });
  return order;
}
function paymentFromSession(s) {
  return { id: s.payment_intent || s.id, session: s.id, method: "Stripe", amount: s.amount_total, at: new Date().toISOString() };
}

function page(title, body) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex"><title>${esc(title)} | Pivot Designs</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500&family=Inter:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/css/site.css">
<style>
.pay{max-width:640px}.pay h1{font-size:var(--step-2);margin:8px 0 12px}
.pay table{width:100%;border-collapse:collapse;background:var(--paper);border:1px solid var(--line);margin:20px 0}
.pay td{padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}
.pay td.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.pay tr.total td{font-weight:600;border-bottom:0}.pay .m{color:var(--muted);font-size:var(--step--1)}
.pay form{margin-top:8px}.pay .note{color:var(--muted);font-size:var(--step--1);margin-top:14px}
</style></head><body>
<header class="site-head"><div class="inner">
<a class="brand" href="/" aria-label="Pivot Designs home"><span class="word">PIVOT</span><span class="sub">DESIGNS</span></a>
<nav class="nav" aria-label="Main"><a href="/">Home</a><a href="/configurator">Design your door</a><a href="/story">Our story</a><a href="/contact">Contact</a></nav>
</div></header>
<main><section><div class="inner prose pay">${body}</div></section></main></body></html>`;
}

module.exports = function payments({ store, E, siteUrl, onPaid = () => {} }) {
  const router = express.Router();
  const key = process.env.STRIPE_SECRET_KEY;
  const Stripe = require("stripe");
  const stripe = key ? new Stripe(key) : null;
  const testMode = !key || key.startsWith("sk_test_");
  const base = () => (process.env.SITE_URL || siteUrl).replace(/\/$/, "");
  const nope = (res, code, title, text) => res.status(code).set("Cache-Control", "no-store").send(page(title, `<span class="eyebrow">Payment</span><h1>${esc(title)}</h1><p class="lede">${text}</p><div class="actions"><a class="btn line" href="/contact">Contact us</a></div>`));

  // Saves a Stripe payment once, and tells Tim the first time.
  async function recordStripePayment(ref, session) {
    let fresh = false;
    const o = await store.update(ref, (x) => {
      const r = applyPayment(x, paymentFromSession(session));
      if (r) fresh = true;
      return r;
    });
    if (o && fresh) onPaid(o);
    return o;
  }

  async function findForCustomer(req, res) {
    const order = await store.get(req.params.ref);
    if (!order || !sameToken(order.payToken, req.query.t)) {
      nope(res, 404, "We can't find that payment link.", "Please check the link in your email, or get in touch and we'll send a new one.");
      return null;
    }
    return order;
  }

  function summary(o) {
    const rows = o.doors.map((d) => `<tr><td>${d.qty} × ${esc(E.designById(d.design).name)}, ${d.width} × ${d.height} mm${d.name ? ` <span class="m">(${esc(d.name)})</span>` : ""}<br><span class="m">${esc(E.describe(d))}</span></td></tr>`).join("");
    return `<table>${rows}<tr class="total"><td>Total to pay, including delivery <span style="float:right">${money(o.quote)}</span></td></tr></table>`;
  }

  // The page the customer lands on from the email.
  router.get("/pay/:ref", async (req, res, next) => {
    try {
      const o = await findForCustomer(req, res);
      if (!o) return;
      res.set("Cache-Control", "no-store");
      if (o.status === "paid" || o.status === "cut" || o.status === "dispatched") {
        return res.send(page("Paid", `<span class="eyebrow">Order ${esc(o.ref)}</span><h1>This order is paid. Thank you.</h1><p class="lede">We'll be in touch when your doors are on their way.</p>`));
      }
      if (quoteExpired(o)) {
        return nope(res, 200, "This price has expired.", `Confirmed prices can be paid for ${QUOTE_DAYS} days, because material costs change. Get in touch and we'll send you an up-to-date price.`);
      }
      if (o.status !== "quoted" || !o.quote) {
        return nope(res, 200, "This order isn't ready to pay yet.", "We're still checking the details. We'll email you when it's ready.");
      }
      const cancelled = "cancelled" in req.query ? `<p class="note" role="status">The payment wasn't completed. You can try again whenever you're ready.</p>` : "";
      const button = stripe
        ? `<form method="post" action="/pay/${encodeURIComponent(o.ref)}?t=${encodeURIComponent(req.query.t)}"><button class="btn" type="submit">Pay ${money(o.quote)} securely</button></form>
           <p class="note">You'll pay on a secure page run by Stripe. Pay by card, Apple Pay or Google Pay. By paying you agree to our <a href="/terms">terms of sale</a>; made-to-measure doors can't be returned for a change of mind.${testMode ? " <b>Test mode: no real money is taken.</b>" : ""}</p>`
        : `<p class="note">Online payment isn't switched on yet. Please contact us to pay.</p>`;
      res.send(page("Pay for your order", `<span class="eyebrow">Order ${esc(o.ref)}</span><h1>${o.checkout ? "Your order" : "Your order, ready to pay"}</h1>
        <p>Hello ${esc(o.customer.name)}. ${o.checkout ? "Here's your order." : "Here's the order we've confirmed with you."}</p>${summary(o)}${o.quoteNote ? `<p class="note" style="white-space:pre-line;color:var(--ink);background:var(--paper);border-left:3px solid var(--tan);padding:10px 14px">${esc(o.quoteNote)}</p>` : ""}${cancelled}${button}`));
    } catch (e) { next(e); }
  });

  // Pay button (and the configurator's checkout in Pay online mode, by GET):
  // make a Stripe Checkout page and send the customer to it.
  const startCheckout = async (req, res, next) => {
    try {
      const o = await findForCustomer(req, res);
      if (!o) return;
      const back = `${base()}/pay/${encodeURIComponent(o.ref)}?t=${encodeURIComponent(req.query.t)}`;
      if (!stripe || o.status !== "quoted" || !o.quote || quoteExpired(o)) return res.redirect(303, back);
      const count = o.doors.reduce((a, d) => a + d.qty, 0);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        // No payment method list here: Tim chooses them in the Stripe dashboard
        // (Settings → Payment methods), as Stripe recommends.
        customer_email: o.customer.email,
        client_reference_id: o.ref,
        metadata: { ref: o.ref },
        payment_intent_data: { description: `Pivot Designs order ${o.ref}`, metadata: { ref: o.ref } },
        line_items: [{
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: o.quote,
            product_data: { name: `Pivot Designs order ${o.ref}`, description: `${count} made-to-measure MDF door${count === 1 ? "" : "s"}, including delivery` }
          }
        }],
        success_url: `${base()}/pay/${encodeURIComponent(o.ref)}/done?t=${encodeURIComponent(req.query.t)}&s={CHECKOUT_SESSION_ID}`,
        cancel_url: back + "&cancelled",
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 2
      }, { idempotencyKey: `${o.ref}-${o.quote}-${Math.floor(Date.now() / 60000)}` });
      res.redirect(303, session.url);
    } catch (e) {
      console.error("Stripe checkout failed", e.message);
      nope(res, 502, "We couldn't open the payment page.", "Nothing has been charged. Please try again in a minute, or contact us.");
    }
  };
  router.post("/pay/:ref", startCheckout);
  router.get("/pay/:ref/checkout", startCheckout);

  // Thank-you page. Checks with Stripe so the order is marked paid straight away.
  router.get("/pay/:ref/done", async (req, res, next) => {
    try {
      let o = await findForCustomer(req, res);
      if (!o) return;
      if (stripe && o.status !== "paid" && typeof req.query.s === "string" && req.query.s.startsWith("cs_")) {
        try {
          const s = await stripe.checkout.sessions.retrieve(req.query.s);
          if (s.payment_status === "paid" && s.metadata && s.metadata.ref === o.ref) {
            o = await recordStripePayment(o.ref, s);
          }
        } catch (e) { console.error("Could not check Stripe session", e.message); }
      }
      res.set("Cache-Control", "no-store").send(page("Thank you", `<span class="eyebrow">Order ${esc(o.ref)}</span>
        <h1>Thank you. ${o.status === "paid" ? "Your payment has gone through." : "Your payment is being confirmed."}</h1>
        <p class="lede">${o.checkout ? "We'll email you an order confirmation. Most orders are dispatched within 5–7 working days, and we'll let you know when yours is on its way." : "Stripe will email you a receipt. We'll be in touch when your doors are cut and on their way."}</p>
        <div class="actions"><a class="btn line" href="/">Back to the home page</a></div>`));
    } catch (e) { next(e); }
  });

  // Stripe's message to the site that a payment has gone through.
  // Needs the raw body to check Stripe's signature, so it's mounted before any JSON parsing.
  router.post("/api/stripe/webhook", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !secret) return res.status(503).send("Payments are not set up.");
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.get("stripe-signature"), secret);
    } catch (e) {
      return res.status(400).send("Bad signature.");
    }
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const s = event.data.object;
      const ref = s.metadata && s.metadata.ref;
      if (s.payment_status === "paid" && ref) {
        try {
          const o = await recordStripePayment(ref, s);
          if (!o) console.error(`Stripe paid for unknown order ${ref}`);
          else console.log(`Order ${ref} paid: ${money(s.amount_total)}`);
        } catch (e) {
          console.error("Could not record payment", e);
          return res.status(500).send("Try again."); // Stripe retries
        }
      }
    }
    if (event.type === "charge.refunded") {
      const c = event.data.object;
      try {
        const found = c.payment_intent && (await store.findByPayment(c.payment_intent));
        if (!found) console.log(`Refund for a payment with no order (${c.payment_intent})`);
        else {
          await store.update(found.ref, (x) => applyRefund(x, c.amount_refunded));
          console.log(`Order ${found.ref} refunded: ${money(c.amount_refunded)} in total`);
        }
      } catch (e) {
        console.error("Could not record refund", e);
        return res.status(500).send("Try again.");
      }
    }
    res.json({ received: true });
  });

  return { router, applyPayment, applyRefund, testMode, enabled: !!stripe, quoteExpires, quoteExpired, QUOTE_DAYS };
};
