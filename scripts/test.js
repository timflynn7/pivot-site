// End-to-end test of orders, payments, refunds, emails and the admin pages,
// without touching real Stripe or sending real email.
//
//   npm test
//   TEST_DATABASE_URL=postgres://... npm test   (tests the Postgres store)
//
// Stripe's servers are replaced with a stand-in, but webhook signatures are
// made and checked with Stripe's real library.
const assert = require("assert");
const os = require("os");
const fs = require("fs");
const path = require("path");
const E = require("../public/js/engine.js");

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
const idealCalls = [];
process.env.IDEAL_POSTCODES_KEY = "ak_test_dummy";
let failNextEmail = false;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  if (String(url).startsWith("https://api.ideal-postcodes.co.uk/")) {
    const u = new URL(url);
    idealCalls.push(u.pathname);
    assert.strictEqual(u.searchParams.get("api_key"), "ak_test_dummy");
    if (u.pathname === "/v1/autocomplete/addresses") return new Response(JSON.stringify({ code: 2000, result: { hits: [{ id: "paf_123", suggestion: "61 Bridge Street, Kington, HR5" }, { id: "paf_456", suggestion: "63 Bridge Street, Kington, HR5" }] } }), { status: 200 });
    if (u.pathname === "/v1/autocomplete/addresses/paf_123/gbr") return new Response(JSON.stringify({ code: 2000, result: { line_1: "61 Bridge Street", line_2: "Flat 2", line_3: "", post_town: "KINGTON", postcode: "HR5 3DJ" } }), { status: 200 });
    return new Response(JSON.stringify({ message: "Not found" }), { status: 404 });
  }
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
const form = (p, body, origin = BASE) => req(p, { method: "POST", headers: { ...auth, Origin: origin, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
const page = async (p) => (await req(p, { headers: auth })).text();
const admin = (ref, body, origin = BASE) => req(`/admin/orders/${ref}`, { method: "POST", headers: { ...auth, Origin: origin, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
const spec = async (ref) => (await req(`/admin/orders/${ref}.json`, { headers: auth })).json();
const webhook = (session, secret = WHSEC, type = "checkout.session.completed") => {
  const payload = JSON.stringify({ id: "evt_1", type, data: { object: session } });
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
  const step = (s) => console.log("  ok  " + s);
  const settle = () => new Promise((r) => setTimeout(r, 300));
  const unesc = (h) => h.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  let o;

  // ---------- customer request ----------
  emails.length = 0;
  const r1 = await req("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
    customer: { name: "Mrs <b>Jo</b> Smith", email: "jo@example.com", postcode: "ab1 2cd", address: "1 Test Street" },
    doors: [{ design: "slab", width: 400, height: 700, qty: 2 }]
  }) });
  assert.strictEqual(r1.status, 201);
  const ref = (await r1.json()).ref;
  await settle();
  o = await spec(ref);
  assert.strictEqual(o.status, "new"); assert.strictEqual(o.payToken, undefined); assert.strictEqual(o.source, "website");
  assert.strictEqual(emails.length, 2);
  assert.deepStrictEqual(emails.map((m) => m.to[0]).sort(), ["jo@example.com", "tim@pivotdesigns.co.uk"]);
  assert(emails.every((m) => !m.html.includes("<b>Jo</b>")), "customer text escaped in emails");
  step("customer request saved; it emails Tim and the customer automatically (escaped)");

  assert.strictEqual((await req("/admin")).status, 401);
  assert.strictEqual((await req(`/pay/${ref}?t=wrong`)).status, 404);
  let html = await page("/admin");
  assert(html.includes("Needs action (1)") && html.includes("Check the order and confirm the price"));
  step("admin needs password; new order shows Action required: confirm the price");

  // ---------- confirm price: no email until Tim presses Send ----------
  emails.length = 0;
  assert.strictEqual((await admin(ref, { action: "quote", price: "123.45" }, "https://evil.example")).status, 403);
  assert.strictEqual((await admin(ref, { action: "quote", price: "abc" })).status, 400);
  const q = await admin(ref, { action: "quote", price: "123.45", note: "Ready in 2 weeks." });
  assert.strictEqual(q.status, 303);
  assert.strictEqual(q.headers.get("location"), `/admin/orders/${ref}/email?kind=paylink`);
  await settle();
  assert.strictEqual(emails.length, 0, "confirming a price sends nothing by itself");
  o = await spec(ref);
  assert.strictEqual(o.status, "quoted"); assert.strictEqual(o.quote, 12345); assert.strictEqual(o.pendingEmail, "paylink");
  html = await page("/admin");
  assert(html.includes('Send the customer the &quot;Payment link&quot; email') && html.includes(`/admin/orders/${ref}/email?kind=paylink`));
  step("Confirm price: blocked from other sites, checks the number, sends nothing, flags the payment email");

  html = await page(`/admin/orders/${ref}/email?kind=paylink`);
  assert(html.includes("£123.45") && html.includes("Ready in 2 weeks.") && html.includes("<iframe") && html.includes("/pay/" + ref));
  const pv = await form(`/admin/orders/${ref}/email?kind=paylink`, { do: "preview", subject: "Your price", message: "Hi Jo,\n\nEdited <message> here.", doors: "1", nonce: "0123456789abcdef" });
  html = await pv.text();
  assert(pv.status === 200 && html.includes("Edited &lt;message&gt; here.") && html.includes("Edited &amp;lt;message&amp;gt; here."));
  assert.strictEqual(emails.length, 0);
  step("email preview: shows the draft and Pay link; Update preview shows edits (escaped) and sends nothing");

  assert.strictEqual((await form(`/admin/orders/${ref}/email?kind=paylink`, { do: "send", subject: "x", message: "" })).status, 400);
  assert.strictEqual((await form(`/admin/orders/${ref}/email?kind=paylink`, { do: "send", subject: "x", message: "y" }, "https://evil.example")).status, 403);
  failNextEmail = true;
  const bad = await form(`/admin/orders/${ref}/email?kind=paylink`, { do: "send", subject: "Your price", message: "Hi" });
  assert(bad.status === 502 && (await bad.text()).includes("Domain not verified"));
  assert.strictEqual((await spec(ref)).pendingEmail, "paylink");
  step("Send: refuses an empty message or another site; a failed send says why and keeps the flag");

  const sent = await form(`/admin/orders/${ref}/email?kind=paylink`, { do: "send", subject: "Your price is ready", message: "Hi Jo,\n\nHere's your link.", doors: "1", nonce: "fedcba9876543210" });
  assert.strictEqual(sent.status, 303);
  assert.strictEqual(emails.length, 1);
  const pe = emails[0];
  const pp = await payPath(ref);
  assert(pe.to[0] === "jo@example.com" && pe.subject === "Your price is ready" && pe.html.includes("Here&#39;s your link.") && pe.html.includes("Pay £123.45 securely"));
  assert(pe.text.includes(BASE + pp) && pe.idem === `manual-${ref}-fedcba9876543210`);
  o = await spec(ref);
  assert.strictEqual(o.pendingEmail, null);
  assert(o.history.some((h) => h.what.startsWith('Email sent: "Payment link"')));
  step("Send: delivers exactly the edited email with the Pay button, clears the flag, notes it in History");

  // ---------- paying ----------
  const page1 = await (await req(pp)).text();
  assert(page1.includes("£123.45") && page1.includes("Test mode") && page1.includes("Ready in 2 weeks."));
  const go = await req(pp, { method: "POST" });
  const sid = go.headers.get("location").split("/").pop();
  const s = sessions[sid];
  assert(s.params.line_items[0].price_data.unit_amount === 12345 && s.params.line_items[0].price_data.currency === "gbp" && s.params.metadata.ref === ref);
  assert.strictEqual(s.params.payment_method_types, undefined);
  step("pay page shows price and note; Pay opens Stripe Checkout for £123.45");

  emails.length = 0;
  s.payment_status = "paid";
  assert.strictEqual((await webhook(s, "whsec_wrong")).status, 400);
  assert.strictEqual((await webhook(s)).status, 200);
  assert.strictEqual((await webhook(s)).status, 200);
  await settle();
  o = await spec(ref);
  assert.strictEqual(o.status, "paid"); assert.strictEqual(o.payment.amount, 12345);
  assert.strictEqual(o.history.filter((h) => h.what.startsWith("Paid")).length, 1);
  assert.strictEqual(emails.length, 2, "customer paid by card: receipt to customer and notice to Tim, once each");
  step("card payment: forged webhook refused; signed one marks paid once; customer and Tim emailed once each");

  // ---------- refunds in Stripe ----------
  emails.length = 0;
  const charge = (amount) => ({ id: "ch_1", object: "charge", payment_intent: s.payment_intent, amount: 12345, amount_refunded: amount, refunded: amount >= 12345 });
  assert.strictEqual((await webhook(charge(2000), WHSEC, "charge.refunded")).status, 200);
  o = await spec(ref);
  assert(o.status === "paid" && o.refund.amount === 2000 && o.pendingEmail === "refunded" && o.history.some((h) => h.what.includes("Part refunded £20.00")));
  await webhook(charge(2000), WHSEC, "charge.refunded");
  assert.strictEqual((await spec(ref)).history.filter((h) => /refunded/i.test(h.what)).length, 1);
  await webhook(charge(12345), WHSEC, "charge.refunded");
  o = await spec(ref);
  assert(o.status === "refunded" && o.refund.amount === 12345 && o.history.some((h) => h.what.startsWith("Refunded £103.45")));
  await settle();
  assert.strictEqual(emails.length, 0, "refunds email nobody automatically");
  assert((await page("/admin")).includes('&quot;Refund confirmation&quot; email'));
  assert.strictEqual((await webhook({ ...charge(500), payment_intent: "pi_unknown" }, WHSEC, "charge.refunded")).status, 200);
  step("Stripe refunds: part then full refund recorded once each, flagged for a refund email, nothing sent");

  html = await page(`/admin/orders/${ref}/email?kind=refunded`);
  assert(html.includes("£123.45"));
  await form(`/admin/orders/${ref}/email?kind=refunded`, { do: "send", subject: "Refund", message: unesc(html.match(/<textarea name="message"[^>]*>([\s\S]*?)<\/textarea>/)[1]) });
  assert(emails.length === 1 && emails[0].text.includes("We've refunded £123.45"));
  assert.strictEqual((await spec(ref)).pendingEmail, null);
  assert(!(await page("/admin")).includes(`id="${ref}"`) && (await page("/admin?archived=1")).includes(`id="${ref}"`));
  step("refund email sent from the preview; the refunded order then moves to Archived");

  // ---------- bank transfer, dispatch, dismiss ----------
  const ref2 = await newOrder(); await settle(); emails.length = 0;
  const mp = await admin(ref2, { action: "paid" });
  assert.strictEqual(mp.headers.get("location"), `/admin/orders/${ref2}/email?kind=paid`);
  o = await spec(ref2);
  assert(o.status === "paid" && o.pendingEmail === "paid" && o.payment.method === "bank transfer or cash");
  assert((await page(`/admin/orders/${ref2}/email?kind=paid`)).includes("by bank transfer or cash"));
  const dm = await form(`/admin/orders/${ref2}/email?kind=paid`, { do: "dismiss" });
  assert.strictEqual(dm.headers.get("location"), `/admin?dismissed=${ref2}#${ref2}`);
  o = await spec(ref2);
  assert(o.pendingEmail === null && o.history.some((h) => h.what.includes("marked as not needed")));
  step("Mark paid: records it, sends nothing, opens the preview; No email needed clears the flag");

  assert.strictEqual((await admin(ref, { action: "dispatch" })).status, 400);
  const dp = await admin(ref2, { action: "dispatch", note: "DPD 1550123" });
  assert.strictEqual(dp.headers.get("location"), `/admin/orders/${ref2}/email?kind=dispatched`);
  o = await spec(ref2);
  assert(o.status === "dispatched" && o.dispatchNote === "DPD 1550123" && o.pendingEmail === "dispatched");
  html = await page(`/admin/orders/${ref2}/email?kind=dispatched`);
  assert(html.includes("DPD 1550123") && html.includes("Delivering to"));
  assert((await page(`/admin?later=${ref2}`)).includes("still flagged"));
  assert.strictEqual(emails.length, 0);
  step("Mark dispatched: only once paid, saves the note, sends nothing; Not now leaves the flag");

  assert.strictEqual((await page(`/admin/orders/${ref2}/email?kind=paylink`)).includes("no confirmed price"), true);
  await form(`/admin/orders/${ref2}/email?kind=custom`, { do: "send", subject: "Quick question", message: "Hello" });
  assert(emails.length === 1 && emails[0].subject === "Quick question" && (await spec(ref2)).pendingEmail === "dispatched");
  step("Email customer: a free-form message any time, without clearing other flags");

  assert.strictEqual((await admin(ref2, { action: "status", status: "refunded" })).status, 400);
  assert.strictEqual((await admin(ref2, { action: "status", status: "paid" })).status, 400);
  step("status menu can't fake a payment or a refund");

  // ---------- price expiry ----------
  const ref3 = await newOrder(); await admin(ref3, { action: "quote", price: "45" });
  const pp3 = await payPath(ref3);
  const realNow = Date.now;
  Date.now = () => realNow() + 31 * 864e5;
  try {
    assert((await (await req(pp3)).text()).includes("This price has expired"));
    assert(!(await req(pp3, { method: "POST" })).headers.get("location").includes("stripe"));
    assert(!(await page("/admin")).includes(`id="${ref3}"`) && (await page("/admin?archived=1")).includes("Price expired"));
    assert((await page(`/admin/orders/${ref3}/email?kind=paylink`)).includes("This price has expired"));
  } finally { Date.now = realNow; }
  await admin(ref3, { action: "quote", price: "47" });
  assert((await (await req(pp3)).text()).includes("£47.00"));
  step("prices expire after 30 days (link stops, Archived, no payment email); Change price revives");

  // thank-you page records a card payment even before the webhook
  const sid3 = (await req(pp3, { method: "POST" })).headers.get("location").split("/").pop();
  sessions[sid3].payment_status = "paid";
  assert((await (await req(`/pay/${ref3}/done?t=${pp3.split("t=")[1]}&s=${sid3}`)).text()).includes("has gone through"));
  o = await spec(ref3);
  assert(o.status === "paid" && o.pendingEmail === null, "paying clears an unsent payment-link flag");
  step("thank-you page confirms with Stripe; paying clears the unsent payment-link flag");

  // ---------- Tim creates an order ----------
  await settle(); emails.length = 0;
  const newBody = JSON.stringify({ customer: { name: "Phone Customer", email: "phone@example.com", postcode: "hr5 3dj", address: "2 Road" }, doors: [{ design: "shaker", width: 500, height: 900, qty: 1 }] });
  assert.strictEqual((await req("/admin/orders", { method: "POST", headers: { "Content-Type": "application/json", Origin: BASE }, body: newBody })).status, 401);
  assert.strictEqual((await req("/admin/orders", { method: "POST", headers: { ...auth, "Content-Type": "application/json", Origin: "https://evil.example" }, body: newBody })).status, 403);
  assert.strictEqual((await req("/admin/orders", { method: "POST", headers: { ...auth, "Content-Type": "application/json", Origin: BASE }, body: JSON.stringify({ customer: {}, doors: [] }) })).status, 400);
  const cr = await req("/admin/orders", { method: "POST", headers: { ...auth, "Content-Type": "application/json", Origin: BASE }, body: newBody });
  assert.strictEqual(cr.status, 201);
  const ref4 = (await cr.json()).ref;
  await settle();
  o = await spec(ref4);
  assert(o.source === "admin" && o.status === "new" && o.history[0].what.includes("created by Tim"));
  assert(!emails.some((m) => m.to[0] === "phone@example.com" || m.subject.includes(ref4)), "orders Tim creates email nobody");
  assert((await page(`/admin?created=${ref4}`)).includes("created by you"));
  assert((await (await req("/configurator?admin")).text()).includes("configurator.js"));
  step("New order: password and same-site only, same checks as customers, nobody emailed");

  // ---------- delete ----------
  assert.strictEqual((await form(`/admin/orders/${ref4}/delete`, { confirm: ref4 }, "https://evil.example")).status, 403);
  assert((await page(`/admin/orders/${ref4}/delete`)).includes("Delete order"));
  const del = await form(`/admin/orders/${ref4}/delete`, { confirm: ref4 });
  assert.strictEqual(del.headers.get("location"), `/admin?deleted=${ref4}`);
  assert.strictEqual((await req(`/admin/orders/${ref4}.json`, { headers: auth })).status, 404);
  assert((await page(`/admin/orders/${ref2}/delete`)).includes("six years"));
  assert.strictEqual((await form(`/admin/orders/${ref2}/delete`, { confirm: "nope" })).status, 400);
  assert.strictEqual((await req(`/admin/orders/${ref2}.json`, { headers: auth })).status, 200);
  assert.strictEqual((await form(`/admin/orders/${ref2}/delete`, { confirm: ref2.toLowerCase() })).status, 303);
  assert.strictEqual((await req(`/admin/orders/${ref2}.json`, { headers: auth })).status, 404);
  step("Delete: blocked from other sites; unpaid deletes after one click; paid needs the reference typed");

  // ---------- designs and hinges ----------
  const tryOrder = (doors) => req("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer: { name: "Hinge Test", email: "h@example.com", postcode: "hr5 3dj", address: "3 Road" }, doors }) });
  const ar = await tryOrder([{ design: "victorian", width: 450, height: 700 }]);
  assert(ar.status === 400 && (await ar.json()).error.includes("no longer available"));
  const hr = await tryOrder([{ design: "bevelled", width: 450, height: 900, hingeSide: "right", hingeCount: 3, hingeTop: 120, hingeBottom: 90, hingeNotes: "Blum soft-close" }]);
  assert.strictEqual(hr.status, 201);
  const href = (await hr.json()).ref;
  o = await spec(href);
  assert(o.doors[0].hingeTop === 120 && o.doors[0].hingeBottom === 90 && o.doors[0].hingeNotes === "Blum soft-close" && o.doors[0].version === E.VERSION);
  assert((await page("/admin")).includes("120 mm from top, 90 mm from bottom · Hinge notes: Blum soft-close"));
  const hd = await (await req(`/admin/orders/${href}.dxf`, { headers: auth })).text();
  assert(hd.includes("HINGES RIGHT x3 TOP 120 BOTTOM 90") && hd.includes("HINGE NOTE: Blum soft-close") && hd.includes("BEVEL_D8") && hd.includes("POCKET_EM6_D8"));
  assert.strictEqual((await tryOrder([{ design: "shaker", width: 450, height: 400, hingeSide: "left", hingeTop: 20 }])).status, 400);
  const nh = await tryOrder([{ design: "shaker", width: 450, height: 700 }]);
  assert.strictEqual((await spec((await nh.json()).ref)).doors[0].hingeSide, "none");
  step("archived designs refused; hinge distances and notes saved, shown on /admin and in the DXF; no hinges by default");

  // ---------- arched pairs, skinny depth, test page ----------
  const pr = await tryOrder([{ design: "arched", width: 450, height: 700, opts: { layout: "pair", count: 3 }, hingeSide: "left", qty: 2 }]);
  assert.strictEqual(pr.status, 201);
  const pref = (await pr.json()).ref;
  o = await spec(pref);
  assert.strictEqual(o.totals.count, 4, "a pair counts as two doors");
  const pd = await (await req(`/admin/orders/${pref}.dxf`, { headers: auth })).text();
  for (const t of ["1.1L", "1.1R", "1.2L", "1.2R", "LEFT OF PAIR", "RIGHT OF PAIR", "HINGES LEFT", "HINGES RIGHT"]) assert(pd.includes(t), t);
  const sk = E.normalizeDoor({ design: "skinny", width: 400, height: 600 }).door;
  assert(E.layerList([sk]).some((l) => l.layer === "POCKET_EM6_D5"));
  assert(E.layerList([{ ...sk, version: 2 }]).some((l) => l.layer === "POCKET_EM6_D8"), "old skinny orders keep their 8 mm pocket");
  assert(E.normalizeDoor({ design: "skinny", width: 400, height: 600, opts: { border: 40 } }).errors.border);
  const tp = await req("/test-designs");
  assert(tp.status === 200 && (await tp.text()).includes("configurator.js"));
  // engine version 4 changes, with old orders kept as they were
  const nd = (o) => E.normalizeDoor(o);
  assert(E.layerList([nd({ design: "beaded", width: 450, height: 700 }).door]).some((l) => l.layer === "MOULD_ROUNDOVER13_RAIL"));
  assert(E.layerList([{ ...nd({ design: "beaded", width: 450, height: 700 }).door, version: 3 }]).some((l) => l.layer === "BEAD_FORM6_D3"));
  const bevelW = (version) => { const d = { ...nd({ design: "bevelled", width: 450, height: 700 }).door }; if (version) d.version = version; const b = E.buildDoor(d).paths.find((p) => p.inner); return [b.inner[0][0] - b.pts[0][0], b.tool, E.layerList([d]).map((l) => l.layer).join()]; };
  assert.deepStrictEqual(bevelW().slice(0, 2), [8, "bevel8"], "bevel as wide as the 8 mm pocket is deep");
  assert(bevelW()[2].includes("POCKET_EM6_D8") && bevelW(4)[2].includes("POCKET_EM6_D5") && bevelW(4)[0] === 5 && bevelW(3)[0] === 12, "older bevelled orders keep their geometry");
  assert(E.designById("lattice").archived && E.buildDoor(nd({ design: "lattice", width: 400, height: 680 }).door).dims.length === 2, "lattice archived, with diamond measurements");
  assert(!/tight but/.test(E.designNote(nd({ design: "shaker", width: 450, height: 700 }).door)) && E.designNote(nd({ design: "newcountry", width: 450, height: 700 }).door) === "");
  assert(E.layerList([nd({ design: "georgian", width: 450, height: 700, opts: { sdepth: "3" } }).door]).some((l) => l.layer === "POCKET_EM6_D3"));
  assert(nd({ design: "georgian", width: 450, height: 700, opts: { border: 35 } }).errors.border, "Georgian frame minimum matches the shaker");
  const ex = (w) => E.buildDoor(nd({ design: "tvgroove", width: w, height: 600, opts: { fit: "exact", spacing: 100 } }).door).paths.filter((p) => p.tool === "v90d4").map((p) => p.pts[0][0]);
  for (const w of [450, 600, 733]) { const xs = ex(w); for (let i = 1; i < xs.length; i++) assert(Math.abs(xs[i] - xs[i - 1] - 100) < 1e-6, "exact boards are exactly 100 mm"); }
  const rd = E.buildDoor(nd({ design: "reeded", width: 450, height: 600, opts: { spacing: 20 } }).door).paths.filter((p) => p.tool === "reed13").map((p) => p.pts[0][0]);
  assert(Math.abs(rd[1] - rd[0] - 12.5) < 1e-6, "reed spacing fixed at 12.5 mm");
  const arc4 = (layout, margin) => E.buildDoor(nd({ design: "arched", width: 450, height: 900, opts: { layout, margin } }).door).paths.filter((p) => p.tool === "reed13");
  const topY = (paths) => Math.min(...paths.flatMap((p) => p.pts.map((q) => q[1])));
  assert(Math.abs(topY(arc4("single", 50)) - topY(arc4("single", 90))) < 0.5, "arch top stays put when the width changes");
  const L = arc4("left", 50), R = arc4("right", 50);
  assert(Math.abs(Math.min(...L.flatMap((p) => p.pts.map((q) => q[0]))) - (450 - Math.max(...R.flatMap((p) => p.pts.map((q) => q[0])))) ) < 0.5, "left and right doors mirror each other");
  step("engine 4: round-over beading, bevel = pocket depth, Georgian shoulder depth, exact boards, fixed reeds, mirrored arches; old orders unchanged");
  step("arched pair: two doors priced and in the DXF, hinges on outer edges; skinny 5 mm pocket (old orders keep 8 mm); test page served");

  // ---------- address lookup and checks ----------
  assert.deepStrictEqual(await (await req("/api/address/status")).json(), { enabled: true });
  assert.deepStrictEqual(await (await req("/api/address/suggest?q=ab")).json(), { hits: [] });
  const sg = await (await req("/api/address/suggest?q=61%20bridge")).text();
  assert(sg.includes("61 Bridge Street, Kington") && !sg.includes("ak_test"));
  const rs = await (await req("/api/address/resolve?id=paf_123")).json();
  assert.deepStrictEqual(rs, { line1: "61 Bridge Street", line2: "Flat 2", town: "Kington", postcode: "HR5 3DJ" });
  assert.strictEqual((await req("/api/address/resolve?id=../../x")).status, 400);
  assert.strictEqual((await req("/api/address/resolve?id=paf_999")).status, 502);
  let limited = 0;
  for (let i = 0; i < 16; i++) if ((await req("/api/address/resolve?id=paf_123")).status === 429) limited++;
  assert(limited >= 1, "address picks are rate limited");
  step("address lookup: key stays on the server, suggestions and full address returned, bad ids refused, picks limited");

  const addrOrder = (c) => req("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer: { name: "Addr Test", email: "a@example.com", ...c }, doors: [{ design: "slab", width: 400, height: 500 }] }) });
  const ao = await addrOrder({ line1: "61 Bridge Street", line2: "Flat 2", town: "Kington", postcode: "hr53dj" });
  assert.strictEqual(ao.status, 201);
  o = await spec((await ao.json()).ref);
  assert(o.customer.address === "61 Bridge Street, Flat 2, Kington" && o.customer.postcode === "HR5 3DJ" && o.customer.addressLines.town === "Kington");
  assert.strictEqual((await addrOrder({ line1: "1 Road", town: "Leeds", postcode: "NOTAPOSTCODE" })).status, 400);
  assert.strictEqual((await addrOrder({ line1: "1 Road", postcode: "LS1 4AB" })).status, 400);
  step("address saved as separate lines; postcode tidied and checked; town required");

  const dxf = await req(`/admin/orders/${ref}.dxf`, { headers: auth });
  assert(dxf.status === 200 && (await dxf.text()).includes("CUTOUT_EM6"));
  step("DXF still downloads");

  console.log(`\nAll tests passed (orders kept in ${process.env.DATABASE_URL ? "Postgres" : "a file"}).`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
