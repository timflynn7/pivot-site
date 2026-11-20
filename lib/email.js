// Order emails, sent through Resend (resend.com).
//
// Settings in Render's Environment tab:
//   RESEND_API_KEY   re_... from Resend → API Keys (sending access only)
//   EMAIL_FROM       who emails come from; default "Pivot Designs <orders@pivotdesigns.co.uk>"
//   EMAIL_ADMIN      where Tim's notifications go; default tim@pivotdesigns.co.uk
// Customer replies go to EMAIL_ADMIN.
// Without RESEND_API_KEY nothing is sent: each email is written to the log instead.
const RESEND_URL = "https://api.resend.com/emails";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (pence) => "£" + (pence / 100).toFixed(2);
const oneLine = (s) => String(s).replace(/[\r\n]+/g, " ").slice(0, 200);

module.exports = function makeEmail({ E, siteUrl }) {
  const key = () => process.env.RESEND_API_KEY;
  const from = () => process.env.EMAIL_FROM || "Pivot Designs <orders@pivotdesigns.co.uk>";
  const admin = () => process.env.EMAIL_ADMIN || "tim@pivotdesigns.co.uk";
  const base = () => (process.env.SITE_URL || siteUrl).replace(/\/$/, "");

  async function send({ to, subject, html, text, idempotencyKey }) {
    subject = oneLine(subject);
    if (!key()) {
      console.log(`[email not sent, no RESEND_API_KEY] to ${to}: ${subject}`);
      return { skipped: true };
    }
    const headers = { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" };
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    const r = await fetch(RESEND_URL, {
      method: "POST", headers, signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ from: from(), to: [to], reply_to: admin(), subject, html, text })
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Resend ${r.status}: ${body.message || body.name || "send failed"}`);
    return { id: body.id };
  }

  // Shared look: plain, readable, works in every mail app.
  const wrap = (inner) => `<!doctype html><html><body style="margin:0;padding:0;background:#F4F2EC">
<div style="max-width:560px;margin:0 auto;padding:28px 20px;font:15px/1.6 Helvetica,Arial,sans-serif;color:#1C1F1D">
<div style="letter-spacing:.3em;font-size:18px;margin-bottom:2px">PIVOT</div>
<div style="letter-spacing:.3em;font-size:10px;color:#5D625C;margin-bottom:24px">DESIGNS</div>
${inner}
<p style="color:#5D625C;font-size:13px;margin-top:32px;border-top:1px solid #DAD6CC;padding-top:12px">Pivot Designs · Made-to-measure MDF doors, cut in our UK workshop<br>
<a href="${base()}" style="color:#4B5F51">pivotdesigns.co.uk</a> · <a href="${base()}/terms" style="color:#4B5F51">Terms &amp; refunds</a> · <a href="${base()}/privacy" style="color:#4B5F51">Privacy</a> · Reply to this email to reach us.</p>
</div></body></html>`;
  const button = (href, label) => `<p style="margin:24px 0"><a href="${esc(href)}" style="background:#4B5F51;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:3px;display:inline-block">${esc(label)}</a></p>`;

  const doorLines = (o) => o.doors.map((d) => `${d.qty} × ${E.designById(d.design).name}, ${d.width} × ${d.height} mm${d.name ? ` (${d.name})` : ""} — ${E.describe(d)}`);
  const doorsHtml = (o) => `<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #DAD6CC;margin:16px 0">${o.doors.map((d) =>
    `<tr><td style="padding:10px 12px;border-bottom:1px solid #DAD6CC">${d.qty} × ${esc(E.designById(d.design).name)}, ${d.width} × ${d.height} mm${d.name ? ` <span style="color:#5D625C">(${esc(d.name)})</span>` : ""}<br><span style="color:#5D625C;font-size:13px">${esc(E.describe(d))}</span></td></tr>`).join("")}</table>`;
  const firstName = (o) => o.customer.name.replace(/^(mr|mrs|ms|miss|dr|mx)\.?\s+/i, "").split(/\s+/)[0] || o.customer.name;

  // ---------- editable customer emails ----------
  const KINDS = {
    paylink: "Payment link",
    paid: "Payment received",
    dispatched: "On its way",
    refunded: "Refund confirmation",
    custom: "Message"
  };
  const dateText = (d) => new Date(d).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" });
  const DRAFTS = {
    paylink: (o, ctx = {}) => ({
      subject: `Your Pivot Designs order ${o.ref}: ${money(o.quote)}, ready to pay`,
      message: [`Hello ${firstName(o)},`, `We've checked your order ${o.ref} and confirmed the price: ${money(o.quote)}, including delivery.`, o.quoteNote || "",
        `You can pay securely online with the button below${ctx.expires ? `. The price can be paid until ${dateText(ctx.expires)}` : ""}. Nothing is cut until you've paid.`,
        "If anything needs changing, just reply to this email.", "Tim\nPivot Designs"].filter(Boolean).join("\n\n"),
      doors: true
    }),
    paid: (o) => ({
      subject: `Payment received for your Pivot Designs order ${o.ref}, thank you`,
      message: [`Thank you, ${firstName(o)}. Your payment is received.`,
        `We've received ${money(o.payment ? o.payment.amount : o.quote || 0)}${o.payment && o.payment.method !== "Stripe" ? ` by ${o.payment.method}` : ""} for your order ${o.ref}.`,
        "Your doors go into our cutting list, and we'll let you know when they're on their way.",
        "If anything's not right, just reply to this email.", "Tim\nPivot Designs"].join("\n\n"),
      doors: true
    }),
    dispatched: (o) => ({
      subject: `Your Pivot Designs order ${o.ref} is on its way`,
      message: [`Hello ${firstName(o)},`, `Good news: your order ${o.ref} has left our workshop.`, o.dispatchNote || "",
        "Please check your doors as soon as they arrive, before painting or fitting. If anything is damaged or not as ordered, reply within 48 hours with photos of the doors and the packaging, and keep the packaging until we've replied.",
        "Thank you for choosing Pivot Designs.", "Tim"].filter(Boolean).join("\n\n"),
      doors: true
    }),
    refunded: (o) => ({
      subject: `Refund for your Pivot Designs order ${o.ref}`,
      message: [`Hello ${firstName(o)},`, `We've refunded ${money(o.refund ? o.refund.amount : 0)} to the card you paid with for order ${o.ref}. It usually appears on your statement within 5 to 10 working days.`,
        "If you have any questions, just reply to this email.", "Tim\nPivot Designs"].join("\n\n"),
      doors: false
    }),
    custom: (o) => ({
      subject: `About your Pivot Designs order ${o.ref}`,
      message: `Hello ${firstName(o)},\n\n\n\nTim\nPivot Designs`,
      doors: false
    })
  };
  // Plain text in, simple paragraphs out: blank lines split paragraphs.
  const paras = (text) => String(text).trim().split(/\n\s*\n/).map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br>")}</p>`).join("\n");
  function renderCustomer(kind, o, d, ctx = {}) {
    const subject = oneLine(d.subject || DRAFTS[kind](o, ctx).subject);
    const message = String(d.message || "").replace(/\r\n?/g, "\n").slice(0, 6000);
    let html = paras(message), text = message.trim();
    if (d.doors) { html += doorsHtml(o); text += "\n\nYour doors:\n" + doorLines(o).join("\n"); }
    if (kind === "paylink" && ctx.link) {
      html += button(ctx.link, `Pay ${money(o.quote)} securely`) + `<p style="color:#5D625C;font-size:13px">Payment is handled by Stripe. If the button doesn't work, copy this link into your browser:<br>${esc(ctx.link)}</p>`;
      text += `\n\nPay securely here:\n${ctx.link}`;
    }
    if (kind === "dispatched") {
      html += `<p>Delivering to:<br><span style="color:#5D625C">${esc(o.customer.address)}<br>${esc(o.customer.postcode)}</span></p>`;
      text += `\n\nDelivering to:\n${o.customer.address}\n${o.customer.postcode}`;
    }
    text += `\n\n--\nPivot Designs · ${base()}`;
    return { subject, html: wrap(html), text };
  }

  return {
    enabled: () => !!key(),

    // To Tim: a new order request.
    newOrderAdmin(o) {
      const c = o.customer;
      return send({
        to: admin(),
        subject: `New order request ${o.ref}: ${o.totals.count} door${o.totals.count === 1 ? "" : "s"}, estimate £${o.totals.total}`,
        idempotencyKey: `new-admin-${o.ref}`,
        html: wrap(`<h2 style="font-weight:normal;margin:0 0 8px">New order request ${esc(o.ref)}</h2>
<p><b>${esc(c.name)}</b><br>${esc(c.email)}${c.phone ? " · " + esc(c.phone) : ""}<br>${esc(c.address)}<br>${esc(c.postcode)}</p>
${doorsHtml(o)}<p>Estimate: <b>£${o.totals.total.toFixed(2)}</b> including delivery.</p>
${c.notes ? `<p style="background:#fff;border-left:3px solid #B38A4E;padding:8px 12px">Notes: ${esc(c.notes)}</p>` : ""}
${button(`${base()}/admin#${encodeURIComponent(o.ref)}`, "Open in orders")}`),
        text: `New order request ${o.ref}\n\n${c.name}\n${c.email}${c.phone ? " · " + c.phone : ""}\n${c.address}\n${c.postcode}\n\n${doorLines(o).join("\n")}\n\nEstimate: £${o.totals.total.toFixed(2)} including delivery.${c.notes ? `\n\nNotes: ${c.notes}` : ""}\n\nOpen in orders: ${base()}/admin`
      });
    },

    // To the customer: we've got your request.
    newOrderCustomer(o) {
      return send({
        to: o.customer.email,
        subject: `We've received your order request ${o.ref}`,
        idempotencyKey: `new-customer-${o.ref}`,
        html: wrap(`<h2 style="font-weight:normal;margin:0 0 8px">Thank you, ${esc(firstName(o))}.</h2>
<p>We've received your order request <b>${esc(o.ref)}</b>.</p>${doorsHtml(o)}
<p>Estimated total: <b>£${o.totals.total.toFixed(2)}</b> including delivery.</p>
<p><b>What happens next:</b> we'll check your doors and email you to confirm the final price and lead time, with a link to pay securely online. The confirmed price can be paid for 30 days. Nothing is cut until you've paid.</p>
<p>If anything needs changing, just reply to this email.</p>`),
        text: `Thank you, ${firstName(o)}.\n\nWe've received your order request ${o.ref}.\n\n${doorLines(o).join("\n")}\n\nEstimated total: £${o.totals.total.toFixed(2)} including delivery.\n\nWhat happens next: we'll check your doors and email you to confirm the final price and lead time, with a link to pay securely online. The confirmed price can be paid for 30 days. Nothing is cut until you've paid.\n\nIf anything needs changing, just reply to this email.\n\nPivot Designs\n${base()}`
      });
    },

    // ---------- customer emails Tim sends by hand ----------
    // Each kind has a default subject and message that Tim can edit on the
    // preview page before sending. Fixed parts (door list, pay button,
    // delivery address) are added around the message.
    KINDS,
    draft(kind, o, ctx = {}) { return DRAFTS[kind](o, ctx); },
    render(kind, o, d, ctx = {}) { return renderCustomer(kind, o, d, ctx); },
    sendCustomer(kind, o, d, ctx = {}) {
      const r = renderCustomer(kind, o, d, ctx);
      return send({ to: o.customer.email, subject: r.subject, html: r.html, text: r.text, idempotencyKey: ctx.nonce ? `manual-${o.ref}-${ctx.nonce}` : undefined });
    },

    // To the customer, automatically when they pay through Stripe.
    paidCustomer(o) {
      const d = DRAFTS.paid(o);
      const r = renderCustomer("paid", o, { ...d, doors: true });
      return send({ to: o.customer.email, subject: r.subject, html: r.html, text: r.text, idempotencyKey: `paid-customer-${o.ref}` });
    },

    // To Tim: an order has been paid through Stripe.
    paidAdmin(o) {
      return send({
        to: admin(),
        subject: `Paid: ${o.ref}, ${money(o.payment.amount)} from ${o.customer.name}`,
        idempotencyKey: `paid-admin-${o.ref}`,
        html: wrap(`<h2 style="font-weight:normal;margin:0 0 8px">Order ${esc(o.ref)} is paid</h2>
<p><b>${money(o.payment.amount)}</b> paid by ${esc(o.payment.method)} from ${esc(o.customer.name)}.</p>${doorsHtml(o)}
${button(`${base()}/admin#${encodeURIComponent(o.ref)}`, "Open in orders")}`),
        text: `Order ${o.ref} is paid.\n\n${money(o.payment.amount)} paid by ${o.payment.method} from ${o.customer.name}.\n\n${doorLines(o).join("\n")}\n\nOpen in orders: ${base()}/admin`
      });
    }
  };
};
