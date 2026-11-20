// End-to-end test of orders and payments, without touching real Stripe.
//
//   node scripts/test-payments.js
//   TEST_DATABASE_URL=postgres://... node scripts/test-payments.js   (tests the Postgres store)
//
// Stripe's servers are replaced with a stand-in, but webhook signatures are
// made and checked with Stripe's real library.
const assert = require("assert");
const os = require("os");
const fs = require("fs");
const path = require("path");

const RealStripe = require("stripe");
const realStripe = new RealStripe("sk_test_dummy");
const sessions = {};
function fakeStripe() { return {
  checkout: {
    sessions: {
      async create(p) {
        const id = "cs_test_" + Object.keys(sessions).length;
        sessions[id] = { id, url: "https://checkout.stripe.test/" + id, params: p, metadata: p.metadata, amount_total: p.line_items[0].price_data.unit_amount, payment_status: "unpaid", payment_intent: "pi_" + id };
        return sessions[id];
      },
      async retrieve(id) { return sessions[id]; }
    }
  },
  webhooks: realStripe.webhooks
}; }
require.cache[require.resolve("stripe")] = { id: "stripe", filename: "stripe", loaded: true, exports: fakeStripe };

const PORT = 4000 + Math.floor(Math.random() * 1000);
const BASE = `http://localhost:${PORT}`;
const WHSEC = "whsec_test_secret";
Object.assign(process.env, {
  PORT: String(PORT), ADMIN_PASSWORD: "pw", STRIPE_SECRET_KEY: "sk_test_dummy", STRIPE_WEBHOOK_SECRET: WHSEC,
  SITE_URL: BASE, DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "pivot-test-")), DATABASE_URL: process.env.TEST_DATABASE_URL || ""
});
if (!process.env.DATABASE_URL) delete process.env.DATABASE_URL;
// Catch emails on their way to Resend instead of sending them.
const emails = [];
let failNextEmail = false;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  if (String(url).startsWith("https://api.resend.com/")) {
    assert.strictEqual(opts.headers.Authorization, "Bearer re_test_dummy");
    if (failNextEmail) { failNextEmail = false; return new Response(JSON.stringify({ message: "Domain not verified" }), { status: 403 }); }
    emails.push({ ...JSON.parse(opts.body), idem: opts.headers["Idempotency-Key"] });
    return new Response(JSON.stringify({ id: "email_" + emails.length }), { status: 200 });
  }
  return realFetch(url, opts);
};
process.env.RESEND_API_KEY = "re_test_dummy";
require("../server.js");

const auth = { Authorization: "Basic " + Buffer.from("tim:pw").toString("base64") };
const req = (p, o = {}) => fetch(BASE + p, { redirect: "manual", ...o });
const admin = (ref, body, origin = BASE) => req(`/admin/orders/${ref}`, { method: "POST", headers: { ...auth, Origin: origin, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
const spec = async (ref) => (await req(`/admin/orders/${ref}.json`, { headers: auth })).json();
const webhook = (session, secret = WHSEC) => {
  const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: session } });
  return req("/api/stripe/webhook", { method: "POST", headers: { "Content-Type": "application/json", "Stripe-Signature": realStripe.webhooks.generateTestHeaderString({ payload, secret }) }, body: payload });
};
async function newOrder() {
  const r = await req("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
    customer: { name: "Test Customer", email: "test@example.com", postcode: "ab1 2cd", address: "1 Test Street" },
    doors: [{ design: "slab", width: 400, height: 700, qty: 2 }]
  }) });
  assert.strictEqual(r.status, 201);
  return (await r.json()).ref;
}
// Reads the pay token the way Tim gets it: from the link on the admin page.
async function payPath(ref) {
  const html = await (await req("/admin", { headers: auth })).text();
  const m = html.match(new RegExp(`value="${BASE.replace(/[./]/g, "\\$&")}(/pay/${ref}\\?t=[^"]+)"`));
  assert(m, "payment link shown on admin page");
  return m[1].replace(/&amp;/g, "&");
}

(async () => {
  await new Promise((r) => setTimeout(r, 600));
  let step = (s) => console.log("  ok  " + s);

  const ref = await newOrder();
  step("order request saved");
  let o = await spec(ref);
  assert.strictEqual(o.status, "new"); assert.strictEqual(o.payToken, undefined);
  step("new order has status new; spec download hides the pay token");

  assert.strictEqual((await req("/admin")).status, 401);
  assert.strictEqual((await req(`/pay/${ref}?t=wrong`)).status, 404);
  step("admin needs password; wrong pay token is refused");

  assert.strictEqual((await admin(ref, { action: "quote", price: "123.45" }, "https://evil.example")).status, 403);
  assert.strictEqual((await admin(ref, { action: "quote", price: "abc" })).status, 400);
  assert.strictEqual((await admin(ref, { action: "quote", price: "123.45" })).status, 303);
  o = await spec(ref);
  assert.strictEqual(o.status, "quoted"); assert.strictEqual(o.quote, 12345);
  step("price confirmation: blocked from other sites, checks the number, sets £123.45");

  const pp = await payPath(ref);
  const page = await (await req(pp)).text();
  assert(page.includes("£123.45") && page.includes("Test mode"));
  step("customer pay page shows the price and test-mode notice");

  const go = await req(pp, { method: "POST" });
  assert.strictEqual(go.status, 303);
  const sid = go.headers.get("location").split("/").pop();
  const s = sessions[sid];
  assert.strictEqual(s.params.line_items[0].price_data.unit_amount, 12345);
  assert.strictEqual(s.params.line_items[0].price_data.currency, "gbp");
  assert.strictEqual(s.params.metadata.ref, ref);
  assert.strictEqual(s.params.customer_email, "test@example.com");
  assert.strictEqual(s.params.payment_method_types, undefined); // chosen in the Stripe dashboard
  step("Pay button opens a Stripe Checkout page for £123.45 GBP");

  s.payment_status = "paid";
  assert.strictEqual((await webhook(s, "whsec_wrong")).status, 400);
  assert.strictEqual((await spec(ref)).status, "quoted");
  step("webhook with a forged signature is refused");

  assert.strictEqual((await webhook(s)).status, 200);
  assert.strictEqual((await webhook(s)).status, 200); // Stripe can send twice
  o = await spec(ref);
  assert.strictEqual(o.status, "paid"); assert.strictEqual(o.payment.amount, 12345);
  assert.strictEqual(o.history.filter((h) => h.what.startsWith("Paid")).length, 1);
  step("signed webhook marks the order paid, once only");

  assert((await (await req(pp)).text()).includes("This order is paid"));
  assert.strictEqual((await admin(ref, { action: "quote", price: "1" })).status, 400);
  assert.strictEqual((await admin(ref, { action: "status", status: "cut" })).status, 303);
  assert.strictEqual((await spec(ref)).status, "cut");
  step("paid order: pay page says paid, price locked, status moves to cut");

  // Thank-you page records the payment even if the webhook hasn't arrived.
  const ref2 = await newOrder();
  await admin(ref2, { action: "quote", price: "50" });
  const pp2 = await payPath(ref2);
  const sid2 = (await req(pp2, { method: "POST" })).headers.get("location").split("/").pop();
  sessions[sid2].payment_status = "paid";
  const done = await (await req(`/pay/${ref2}/done?t=${pp2.split("t=")[1]}&s=${sid2}`)).text();
  assert(done.includes("has gone through"));
  assert.strictEqual((await spec(ref2)).status, "paid");
  step("thank-you page confirms with Stripe and marks paid");

  const ref3 = await newOrder();
  assert((await (await req(`/pay/${ref3}?t=x`)).text()).includes("find that payment link"));
  await admin(ref3, { action: "paid" });
  o = await spec(ref3);
  assert.strictEqual(o.status, "paid"); assert.strictEqual(o.payment.method, "bank transfer or cash");
  step("Mark paid records a bank transfer");

  const dxf = await req(`/admin/orders/${ref}.dxf`, { headers: auth });
  assert.strictEqual(dxf.status, 200); assert((await dxf.text()).includes("CUTOUT_EM6"));
  step("DXF still downloads");

  // ---------- emails ----------
  const settle = () => new Promise((r) => setTimeout(r, 300));
  emails.length = 0;
  const r4 = await req("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
    customer: { name: "Mrs <b>Jo</b> Smith", email: "jo@example.com", postcode: "ab1 2cd", address: "1 Test Street", notes: "Line\r\nBreak" },
    doors: [{ design: "slab", width: 400, height: 700, qty: 1 }]
  }) });
  const ref4 = (await r4.json()).ref;
  await settle();
  assert.strictEqual(emails.length, 2);
  const [toTim, toCust] = emails;
  assert.deepStrictEqual(toTim.to, ["tim@pivotdesigns.co.uk"]);
  assert(toTim.subject.includes(ref4) && toTim.html.includes("/admin#" + ref4));
  assert.deepStrictEqual(toCust.to, ["jo@example.com"]);
  assert.strictEqual(toCust.reply_to, "tim@pivotdesigns.co.uk");
  assert(toCust.html.includes("&lt;b&gt;Jo&lt;/b&gt;") && !toCust.html.includes("<b>Jo</b>"), "customer text is escaped in emails");
  assert(!/[\r\n]/.test(toTim.subject) && toTim.text && toCust.text);
  assert.strictEqual(toCust.idem, "new-customer-" + ref4);
  step("new order emails Tim and the customer (escaped, with reply-to)");

  emails.length = 0;
  await admin(ref4, { action: "quote", price: "75" });
  assert.strictEqual(emails.length, 0);
  step("Confirm price with the box unticked sends nothing");

  await admin(ref4, { action: "quote", price: "80", email: "1" });
  assert.strictEqual(emails.length, 1);
  const pp4 = await payPath(ref4);
  assert.deepStrictEqual(emails[0].to, ["jo@example.com"]);
  assert(emails[0].subject.includes("£80.00") && emails[0].html.includes(BASE + pp4.replace(/&/g, "&amp;")) && emails[0].text.includes(BASE + pp4));
  step("Confirm price with the box ticked emails the payment link");

  await admin(ref4, { action: "resend" });
  assert.strictEqual(emails.length, 2);
  failNextEmail = true;
  const bad = await admin(ref4, { action: "resend" });
  assert(bad.headers.get("location").includes("emailfailed=" + ref4));
  o = await spec(ref4);
  assert(o.history.some((h) => h.what.startsWith("Email FAILED") && h.what.includes("Domain not verified")));
  assert((await (await req("/admin?emailfailed=" + ref4, { headers: auth })).text()).includes("didn't send"));
  step("Resend payment link works; a failed email shows on /admin and in History");

  emails.length = 0;
  const sid4 = (await req(pp4, { method: "POST" })).headers.get("location").split("/").pop();
  sessions[sid4].payment_status = "paid";
  await webhook(sessions[sid4]); await webhook(sessions[sid4]);
  await req(`/pay/${ref4}/done?t=${pp4.split("t=")[1]}&s=${sid4}`);
  await settle();
  assert.strictEqual(emails.length, 2, "one email each, however many times Stripe reports it");
  const paidCust = emails.find((m) => m.to[0] === "jo@example.com");
  const paidTim = emails.find((m) => m.to[0] === "tim@pivotdesigns.co.uk");
  assert(paidCust && paidCust.subject.includes("Payment received") && paidCust.html.includes("£80.00") && !paidCust.html.includes(" by Stripe"));
  assert(paidTim && paidTim.subject.startsWith("Paid: " + ref4));
  step("Stripe payment emails the customer and Tim, once each");

  emails.length = 0;
  const ref5 = await newOrder(); await settle(); emails.length = 0;
  await admin(ref5, { action: "paid" }); await settle();
  assert.strictEqual(emails.length, 1);
  assert(emails[0].to[0] === "test@example.com" && emails[0].text.includes("by bank transfer or cash"));
  await admin(ref5, { action: "paid" }); await settle();
  assert.strictEqual(emails.length, 1);
  step("Mark paid (bank transfer) emails the customer once, and not Tim");

  // ---------- note to customer, and dispatch ----------
  const ref6 = await newOrder(); await settle(); emails.length = 0;
  await admin(ref6, { action: "quote", price: "60", email: "1", note: "Ready within 2 weeks.\r\nCall first: <gate code 12>" });
  o = await spec(ref6);
  assert.strictEqual(o.quoteNote, "Ready within 2 weeks.\nCall first: <gate code 12>");
  assert(emails[0].html.includes("Ready within 2 weeks.\nCall first: &lt;gate code 12&gt;") && emails[0].text.includes("Call first: <gate code 12>"));
  const pp6 = await payPath(ref6);
  assert((await (await req(pp6)).text()).includes("Call first: &lt;gate code 12&gt;"));
  step("note to customer: saved, escaped, in the payment email and on the pay page");

  assert.strictEqual((await admin(ref6, { action: "dispatch" })).status, 400);
  await admin(ref6, { action: "paid" }); await settle(); emails.length = 0;
  await admin(ref6, { action: "dispatch", note: "DPD 1550123", email: "1" }); await settle();
  o = await spec(ref6);
  assert.strictEqual(o.status, "dispatched"); assert.strictEqual(o.dispatchNote, "DPD 1550123");
  assert.strictEqual(emails.length, 1);
  assert(emails[0].subject.includes("on its way") && emails[0].html.includes("DPD 1550123") && emails[0].to[0] === "test@example.com");
  assert((await (await req("/admin", { headers: auth })).text()).includes("DPD 1550123"));
  step("Mark dispatched: only once paid, saves the note, emails the customer");

  const ref7 = await newOrder(); await admin(ref7, { action: "paid" }); await settle(); emails.length = 0;
  await admin(ref7, { action: "dispatch" }); await settle();
  assert.strictEqual((await spec(ref7)).status, "dispatched"); assert.strictEqual(emails.length, 0);
  step("Mark dispatched with the box unticked sends nothing");

  // ---------- prices expire after 30 days ----------
  const ref8 = await newOrder(); await admin(ref8, { action: "quote", price: "45" });
  const pp8 = await payPath(ref8);
  assert((await (await req("/admin", { headers: auth })).text()).includes("Price valid until"));
  const realNow = Date.now;
  Date.now = () => realNow() + 31 * 864e5;
  try {
    assert((await (await req(pp8)).text()).includes("This price has expired"));
    const go8 = await req(pp8, { method: "POST" });
    assert(!go8.headers.get("location").includes("stripe"), "no checkout for an expired price");
    const cur = await (await req("/admin", { headers: auth })).text();
    const arch = await (await req("/admin?archived=1", { headers: auth })).text();
    assert(!cur.includes(`id="${ref8}"`) && arch.includes(`id="${ref8}"`) && arch.includes("Price expired"));
    step("after 30 days the price expires: pay link stops, order moves to Archived");
  } finally { Date.now = realNow; }
  await admin(ref8, { action: "quote", price: "47" });
  assert((await (await req(pp8)).text()).includes("£47.00"));
  step("Change price revives an expired order for another 30 days");

  console.log(`\nAll payment and email tests passed (orders kept in ${process.env.DATABASE_URL ? "Postgres" : "a file"}).`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
