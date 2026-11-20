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
<a href="${base()}" style="color:#4B5F51">pivotdesigns.co.uk</a> · Reply to this email to reach us.</p>
</div></body></html>`;
  const button = (href, label) => `<p style="margin:24px 0"><a href="${esc(href)}" style="background:#4B5F51;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:3px;display:inline-block">${esc(label)}</a></p>`;

  const doorLines = (o) => o.doors.map((d) => `${d.qty} × ${E.designById(d.design).name}, ${d.width} × ${d.height} mm${d.name ? ` (${d.name})` : ""} — ${E.describe(d)}`);
  const doorsHtml = (o) => `<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #DAD6CC;margin:16px 0">${o.doors.map((d) =>
    `<tr><td style="padding:10px 12px;border-bottom:1px solid #DAD6CC">${d.qty} × ${esc(E.designById(d.design).name)}, ${d.width} × ${d.height} mm${d.name ? ` <span style="color:#5D625C">(${esc(d.name)})</span>` : ""}<br><span style="color:#5D625C;font-size:13px">${esc(E.describe(d))}</span></td></tr>`).join("")}</table>`;
  const firstName = (o) => o.customer.name.replace(/^(mr|mrs|ms|miss|dr|mx)\.?\s+/i, "").split(/\s+/)[0] || o.customer.name;

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
<p><b>What happens next:</b> we'll check your doors and email you to confirm the final price and lead time, with a link to pay securely online. Nothing is cut until you've paid.</p>
<p>If anything needs changing, just reply to this email.</p>`),
        text: `Thank you, ${firstName(o)}.\n\nWe've received your order request ${o.ref}.\n\n${doorLines(o).join("\n")}\n\nEstimated total: £${o.totals.total.toFixed(2)} including delivery.\n\nWhat happens next: we'll check your doors and email you to confirm the final price and lead time, with a link to pay securely online. Nothing is cut until you've paid.\n\nIf anything needs changing, just reply to this email.\n\nPivot Designs\n${base()}`
      });
    },

    // To the customer: price confirmed, here's how to pay.
    payLink(o, link) {
      return send({
        to: o.customer.email,
        subject: `Your Pivot Designs order ${o.ref}: ${money(o.quote)}, ready to pay`,
        html: wrap(`<h2 style="font-weight:normal;margin:0 0 8px">Your order is ready to pay</h2>
<p>Hello ${esc(firstName(o))}. We've checked your order <b>${esc(o.ref)}</b> and confirmed the price.</p>${doorsHtml(o)}
<p style="font-size:17px">Total to pay, including delivery: <b>${money(o.quote)}</b></p>
${button(link, `Pay ${money(o.quote)} securely`)}
<p style="color:#5D625C;font-size:13px">Payment is handled by Stripe. Card, Apple Pay and Google Pay accepted. If the button doesn't work, copy this link into your browser:<br>${esc(link)}</p>
<p>Questions or changes? Just reply to this email.</p>`),
        text: `Hello ${firstName(o)}.\n\nWe've checked your order ${o.ref} and confirmed the price.\n\n${doorLines(o).join("\n")}\n\nTotal to pay, including delivery: ${money(o.quote)}\n\nPay securely here:\n${link}\n\nPayment is handled by Stripe. Questions or changes? Just reply to this email.\n\nPivot Designs`
      });
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
