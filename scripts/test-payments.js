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

  console.log(`\nAll payment tests passed (orders kept in ${process.env.DATABASE_URL ? "Postgres" : "a file"}).`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
