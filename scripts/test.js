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
const pcioCalls = [];
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
  if (String(url).startsWith("https://api.postcodes.io/")) {
    const u = new URL(url); pcioCalls.push(u.pathname);
    if (u.pathname === "/postcodes/HR53DJ") return new Response(JSON.stringify({ status: 200, result: { postcode: "HR5 3DJ", country: "England", admin_district: "Herefordshire, County of" } }), { status: 200 });
    if (u.pathname === "/terminated_postcodes/AB12CD") return new Response(JSON.stringify({ status: 200, result: { postcode: "AB1 2CD" } }), { status: 200 });
    if (u.pathname === "/postcodes/GU11ZZ") return new Response("down", { status: 500 });
    return new Response(JSON.stringify({ status: 404, error: "Postcode not found" }), { status: 404 });
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

// Filled in after signing in (password + phone code) at the start of the tests.
const auth = {};
const { totpNow } = require("../lib/auth.js");
const cookieFrom = (r) => (r.headers.get("set-cookie") || "").split(";")[0];
const field = (html, name) => { const m = html.match(new RegExp(`name="${name}" value="([^"]+)"`)); return m && m[1].replace(/&amp;/g, "&"); };
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

  // ---------- signing in: password, then set up the phone app ----------
  const login = (body, path = "/admin/login") => req(path, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
  assert.strictEqual((await req("/admin")).status, 303, "signed-out visitors are sent to the sign-in page");
  assert.strictEqual((await req("/admin/orders/PD-X.json")).status, 401);
  let lr = await login({ password: "nope" });
  assert.strictEqual(lr.status, 401);
  lr = await login({ password: "pw", next: "/admin" });
  let lh = await lr.text();
  assert(lh.includes("Set up your phone") && lh.includes("data:image/png;base64"), "first sign-in sets up the phone app");
  const secret = lh.match(/<code>([A-Z2-7 ]+)<\/code>/)[1].replace(/ /g, "");
  const ticket = field(lh, "ticket");
  assert.strictEqual((await login({ ticket, code: "000000" }, "/admin/login/setup")).status, 401);
  lr = await login({ ticket, code: totpNow(secret) }, "/admin/login/setup");
  lh = await lr.text();
  assert(lr.status === 200 && lh.includes("backup codes"));
  const backups = [...lh.matchAll(/<div>([0-9a-f]{5}-[0-9a-f]{5})<\/div>/g)].map((m) => m[1]);
  assert.strictEqual(backups.length, 10);
  auth.Cookie = cookieFrom(lr);
  assert(/HttpOnly/i.test(lr.headers.get("set-cookie")) && /Max-Age=2592000/i.test(lr.headers.get("set-cookie")), "30-day, script-proof cookie");
  assert.strictEqual((await req("/admin", { headers: auth })).status, 200);
  // a second browser: password, then a code; codes can't be reused; backup codes work once
  lh = await (await login({ password: "pw" })).text();
  assert(lh.includes("Enter your code"));
  const t2 = field(lh, "ticket");
  assert.strictEqual((await login({ ticket: t2, code: totpNow(secret) }, "/admin/login/code")).status, 401, "a code that was just used can't be used again");
  lr = await login({ ticket: t2, code: backups[0] }, "/admin/login/code");
  assert(lr.status === 303 && cookieFrom(lr).startsWith("pivot_admin="));
  const second = { Cookie: cookieFrom(lr) };
  lh = await (await login({ password: "pw" })).text();
  assert.strictEqual((await login({ ticket: field(lh, "ticket"), code: backups[0] }, "/admin/login/code")).status, 401, "a backup code works once");
  assert.strictEqual((await req("/admin", { headers: { Cookie: "pivot_admin=forged.token" } })).status, 303);
  await settle();
  assert(emails.filter((m) => m.subject.startsWith("Signed in to Pivot orders")).length === 2, "Tim is emailed for each sign-in");
  const sec = await (await req("/admin/security", { headers: auth })).text();
  assert(sec.includes("Backup codes left: <b>9</b>") && sec.includes("Wrong password") && sec.includes("Signed in with a backup code"));
  assert.strictEqual((await req("/admin", { headers: second })).status, 200);
  step("sign-in: password + phone code (set up on first sign-in), 30-day cookie, codes and backup codes work once, emails Tim, log on /admin/security");

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

  assert.strictEqual((await req("/admin")).status, 303);
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
  const cookieBefore = auth.Cookie;
  try {
    assert.strictEqual((await req("/admin", { headers: auth })).status, 303, "a sign-in lasts 30 days");
    const tk = field(await (await login({ password: "pw" })).text(), "ticket");
    auth.Cookie = cookieFrom(await login({ ticket: tk, code: backups[1] }, "/admin/login/code"));
    assert((await (await req(pp3)).text()).includes("This price has expired"));
    assert(!(await req(pp3, { method: "POST" })).headers.get("location").includes("stripe"));
    assert(!(await page("/admin")).includes(`id="${ref3}"`) && (await page("/admin?archived=1")).includes("Price expired"));
    assert((await page(`/admin/orders/${ref3}/email?kind=paylink`)).includes("This price has expired"));
  } finally { Date.now = realNow; }
    auth.Cookie = cookieBefore;
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
  assert(hd.includes("HINGES RIGHT x3 TOP 120 BOTTOM 90") && hd.includes("HINGE NOTE: Blum soft-close") && hd.includes("BEVEL_D8") && hd.includes("POCKET_D8"));
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
  assert(E.layerList([sk]).some((l) => l.layer === "POCKET_D5"));
  assert(E.layerList([{ ...sk, version: 2 }]).some((l) => l.layer === "POCKET_D8"), "old skinny orders keep their 8 mm pocket");
  assert(E.normalizeDoor({ design: "skinny", width: 400, height: 600, opts: { border: 40 } }).errors.border);
  const tp = await req("/test-designs");
  assert(tp.status === 200 && (await tp.text()).includes("configurator.js"));
  // engine version 4 changes, with old orders kept as they were
  const nd = (o) => E.normalizeDoor(o);
  assert(E.layerList([nd({ design: "beaded", width: 450, height: 700 }).door]).some((l) => l.layer === "ROUNDOVER"));
  assert(E.layerList([{ ...nd({ design: "beaded", width: 450, height: 700 }).door, version: 3 }]).some((l) => l.layer === "BEAD_D3"));
  const bevelW = (version) => { const d = { ...nd({ design: "bevelled", width: 450, height: 700 }).door }; if (version) d.version = version; const b = E.buildDoor(d).paths.find((p) => p.inner); return [b.inner[0][0] - b.pts[0][0], b.tool, E.layerList([d]).map((l) => l.layer).join()]; };
  assert.deepStrictEqual(bevelW().slice(0, 2), [8, "bevel8"], "bevel as wide as the 8 mm pocket is deep");
  assert(bevelW()[2].includes("POCKET_D8") && bevelW(4)[2].includes("POCKET_D5") && bevelW(4)[0] === 5 && bevelW(3)[0] === 12, "older bevelled orders keep their geometry");
  assert(E.designById("lattice").archived && E.buildDoor(nd({ design: "lattice", width: 400, height: 680 }).door).dims.length === 2, "lattice archived, with diamond measurements");
  assert(!/tight but/.test(E.designNote(nd({ design: "shaker", width: 450, height: 700 }).door)) && E.designNote(nd({ design: "newcountry", width: 450, height: 700 }).door) === "");
  assert(E.layerList([nd({ design: "georgian", width: 450, height: 700, opts: { sdepth: "3" } }).door]).some((l) => l.layer === "POCKET_D3"));
  // engine version 6: New Country from the test cuts, with old orders kept as they were
  const ncDoor = (opts, version) => { const d = { ...nd({ design: "newcountry", width: 500, height: 720, opts }).door }; if (version) d.version = version; return d; };
  const nc = E.buildDoor(ncDoor({ border: 70 })), ncPk = nc.paths.find((p) => p.tool === "pocket3");
  assert.deepStrictEqual(ncPk.pts[0], [75, 75], "frame width runs to the top of the chamfer: pocket line 5 mm further in");
  assert(nc.paths.some((p) => p.tool === "pchamfer5" && p.pts[0][0] === 75) && nc.paths.filter((p) => p.tool === "v90d5p").every((p) => p.pts[0][1] === 75 && p.pts[1][1] === 645));
  assert.deepStrictEqual(E.layerList([ncDoor({})]).map((l) => l.layer).sort(), ["CHAMFER_D5", "CUTOUT", "POCKET_D3", "VGROOVE_D5"]);
  assert(!nc.paths.some((p) => p.tool === "v90d2"), "no joint grooves unless chosen");
  const j = E.buildDoor(ncDoor({ border: 70, joints: "fivepiece" })).paths.filter((p) => p.tool === "v90d2");
  assert.deepStrictEqual(j.map((p) => p.pts), [[[68, -10], [68, 68]], [[432, -10], [432, 68]], [[68, 652], [68, 730]], [[432, 652], [432, 730]]], "joint grooves set out 5 + 2 mm from the pocket line, overcut past the edge");
  assert(E.layerList([ncDoor({ joints: "fivepiece" })]).some((l) => l.layer === "VGROOVE_D2"));
  const ncOld = E.buildDoor(ncDoor({ border: 70, joints: "fivepiece" }, 5));
  assert(ncOld.paths[1].tool === "pocket8" && ncOld.paths[1].pts[0][0] === 70 && ncOld.paths.slice(2).every((p) => p.tool === "v90d4"), "version 5 New Country orders keep their geometry");
  // engine version 9: reeded on REED_D5, arched on FLUTE_D5 (same geometry), older orders unchanged
  const lay = (design, opts, version) => { const d = { ...nd({ design, width: 450, height: 900, opts }).door }; if (version) d.version = version; return E.layerList([d]).map((l) => l.layer).sort().join(); };
  assert.strictEqual(lay("reeded", {}), "CUTOUT,REED_D5");
  assert.strictEqual(lay("reeded", {}, 8), "CUTOUT,REED_D4", "version 8 reeded orders keep REED_D4");
  assert.strictEqual(lay("arched", {}), "CUTOUT,FLUTE_D5");
  assert.strictEqual(lay("arched", {}, 8), "CUTOUT,REED_D4", "version 8 arched orders keep REED_D4");
  const archPts = (version) => { const d = { ...nd({ design: "arched", width: 450, height: 900, opts: {} }).door }; if (version) d.version = version; return JSON.stringify(E.buildDoor(d).paths.slice(1).map((p) => p.pts)); };
  assert.strictEqual(archPts(), archPts(8), "arched geometry unchanged, only the layer");
  // engine version 8: tongue & bead groove, bead on the reed bit 12.5 mm from the V-groove
  const tb = (version) => { const d = { ...nd({ design: "tbgroove", width: 600, height: 720, opts: { fit: "exact", spacing: 100 } }).door }; if (version) d.version = version; return d; };
  const tbP = E.buildDoor(tb()).paths, tbV = tbP.filter((p) => p.tool === "v90d4"), tbB = tbP.filter((p) => p.tool === "reed5");
  assert(tbV.length && tbV.length === tbB.length && tbV.every((p, i) => Math.abs(tbB[i].pts[0][0] - p.pts[0][0] - 12.5) < 1e-9), "bead line 12.5 mm from each V-groove");
  assert.strictEqual(E.layerList([tb()]).map((l) => l.layer).sort().join(), "CUTOUT,REED_D5,VGROOVE_D4");
  const tbOld = E.buildDoor(tb(7)).paths;
  assert(tbOld.filter((p) => p.tool === "bead6").every((p, i) => Math.abs(p.pts[0][0] - tbOld.filter((q) => q.tool === "v90d4")[i].pts[0][0] - 9) < 1e-9) && !tbOld.some((p) => p.tool === "reed5"), "version 7 tongue & bead orders keep the 6 mm bead 9 mm away");
  // engine version 7: bevelled shaker options
  const bv = (opts, version) => { const d = { ...nd({ design: "bevelled", width: 500, height: 720, opts }).door }; if (version) d.version = version; return d; };
  const bvLayers = (d) => E.layerList([d]).map((l) => l.layer).sort().join();
  const bvPocket = (d) => E.buildDoor(d).paths.find((p) => p.tool === "pocket8").pts[0];
  assert.strictEqual(bvLayers(bv({ border: 70 })), "BEVEL_D8,CUTOUT,POCKET_D8", "default bevel unchanged");
  assert.deepStrictEqual(bvPocket(bv({ border: 70 })), [78, 78]);
  assert.strictEqual(bvLayers(bv({ border: 70, bevel: "step" })), "CHAMFER_D6,CUTOUT,POCKET_D8", "step: a 6 mm chamfer on the pocket line, no BEVEL line");
  assert.deepStrictEqual(bvPocket(bv({ border: 70, bevel: "step" })), [76, 76], "step: bevel top still at the frame width, pocket line 6 mm in");
  assert.deepStrictEqual(E.buildDoor(bv({ border: 70, bevel: "step" })).paths.find((p) => p.tool === "pchamfer6").pts[0], [76, 76]);
  for (const bevel of ["floor", "step"]) assert.deepStrictEqual(E.buildDoor(bv({ border: 70, bevel, joints: "fivepiece" })).paths.filter((p) => p.tool === "v90d2").map((p) => p.pts),
    [[[68, -10], [68, 68]], [[432, -10], [432, 68]], [[68, 652], [68, 730]], [[432, 652], [432, 730]]], "bevel joint grooves meet the top of the bevel");
  assert.strictEqual(bvLayers(bv({ border: 70, bevel: "step", joints: "fivepiece" }, 6)), "BEVEL_D8,CUTOUT,POCKET_D8", "version 6 bevelled orders keep their geometry");
  assert(nd({ design: "georgian", width: 450, height: 700, opts: { border: 35 } }).errors.border, "Georgian frame minimum matches the shaker");
  const ex = (w) => E.buildDoor(nd({ design: "tvgroove", width: w, height: 600, opts: { fit: "exact", spacing: 100 } }).door).paths.filter((p) => p.tool === "v90d4").map((p) => p.pts[0][0]);
  for (const w of [450, 600, 733]) { const xs = ex(w); for (let i = 1; i < xs.length; i++) assert(Math.abs(xs[i] - xs[i - 1] - 100) < 1e-6, "exact boards are exactly 100 mm"); }
  const rd = E.buildDoor(nd({ design: "reeded", width: 450, height: 600, opts: { spacing: 20 } }).door).paths.filter((p) => p.tool === "reed5").map((p) => p.pts[0][0]);
  assert(Math.abs(rd[1] - rd[0] - 12.5) < 1e-6, "reed spacing fixed at 12.5 mm");
  const arc4 = (layout, margin) => E.buildDoor(nd({ design: "arched", width: 450, height: 900, opts: { layout, margin } }).door).paths.filter((p) => p.tool === "arch5");
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
  const pc = async (q) => (await req("/api/postcode?pc=" + encodeURIComponent(q))).json();
  assert.deepStrictEqual(await pc("hr5 3dj"), { found: true, postcode: "HR5 3DJ", area: "Herefordshire, England" });
  const n = pcioCalls.length; await pc("HR53DJ"); assert.strictEqual(pcioCalls.length, n, "postcode results are cached");
  assert.strictEqual((await pc("ab1 2cd")).found, true, "a retired postcode still counts as found");
  assert.strictEqual((await pc("SW9 9ZZ")).found, false);
  assert.strictEqual((await pc("hello")).found, false);
  assert.strictEqual((await pc("GU1 1ZZ")).found, null, "an outage never blocks the form");
  assert.strictEqual((await pc("JE2 3AB")).found, null, "Crown dependencies are not checked");
  assert(!pcioCalls.some((p) => /JE23AB|HELLO/.test(p)), "bad or unsupported postcodes are never sent");
  step("postcode check: real, retired, unknown and badly formed postcodes; cached; outages don't block");
  step("address lookup: key stays on the server, suggestions and full address returned, bad ids refused, picks limited");

  const addrOrder = (c) => req("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer: { name: "Addr Test", email: "a@example.com", ...c }, doors: [{ design: "slab", width: 400, height: 500 }] }) });
  const ao = await addrOrder({ line1: "61 Bridge Street", line2: "Flat 2", town: "Kington", postcode: "hr53dj" });
  assert.strictEqual(ao.status, 201);
  o = await spec((await ao.json()).ref);
  assert(o.customer.address === "61 Bridge Street, Flat 2, Kington" && o.customer.postcode === "HR5 3DJ" && o.customer.addressLines.town === "Kington");
  assert.strictEqual((await addrOrder({ line1: "1 Road", town: "Leeds", postcode: "NOTAPOSTCODE" })).status, 400);
  assert.strictEqual((await addrOrder({ line1: "1 Road", postcode: "LS1 4AB" })).status, 400);
  step("address saved as separate lines; postcode tidied and checked; town required");

  // ---------- pricing: Etsy bands less 10% ----------
  const priceOf = (design, width, height, opts) => E.priceDoor(nd({ design, width, height, opts }).door);
  assert.deepStrictEqual([priceOf("slab", 300, 600), priceOf("fluted", 300, 600), priceOf("shaker", 600, 600), priceOf("shaker", 450, 640), priceOf("fluted", 600, 1150), priceOf("shaker", 800, 1150), priceOf("slab", 1000, 1200), priceOf("arched", 450, 700, { layout: "pair" })], [27, 27, 36, 54, 54, 67, 90, 108]);
  const etsy = (w, h) => (w <= 300 && h <= 600 ? 30 : w <= 600 && h <= 600 ? 40 : w <= 600 && h <= 1150 ? 60 : w <= 800 && h <= 1150 ? 75 : null);
  for (const d of E.DESIGNS.filter((x) => E.orderable(x))) for (let w = 300; w <= 1000; w += 50) for (let h = 300; h <= 1200; h += 50) {
    const r = nd({ design: d.id, width: w, height: h }); if (Object.keys(r.errors).length) continue;
    const p = E.priceDoor(r.door), e = etsy(w, h);
    if (e != null) assert(p <= e * 0.9 && p < e, `${d.id} ${w}x${h}: £${p} must be under Etsy £${e}`);
    else assert(p >= 67, `${d.id} ${w}x${h}: bigger than the bands, at least the Extra large price`);
  }
  const six = E.priceOrder([nd({ design: "shaker", width: 600, height: 900, qty: 6 }).door]);
  assert(six.sub === 324 && six.ship === 37 && !six.freeDelivery, "6 x 600 x 900: £324 + £37 delivery");
  assert(E.priceOrder([nd({ design: "shaker", width: 600, height: 900, qty: 8 }).door]).freeDelivery, "free delivery from £400");
  const api = await (await req("/api/pricing")).text();
  assert(api.includes('"price":27') && !/etsy/i.test(api), "public prices never mention Etsy");
  assert((await page("/admin/pricing")).includes("Etsy price"));
  assert.strictEqual((await form("/admin/pricing", { discount: "5" }, "https://evil.example")).status, 403);
  const P0 = E.getPricing();
  const body = { etsy0: "30", etsy1: "40", etsy2: "60", etsy3: "75", discount: "5", sheet: "1220", border: "30", gap: "25", wasteShare: "0.5", "delivery.first": "12", "delivery.extra": "5", "delivery.freeOver": "400" };
  assert((await (await form("/admin/pricing", body)).text()).includes("Prices saved"));
  assert.deepStrictEqual((await (await req("/api/pricing")).json()).bands.map((x) => x.price), [28, 38, 57, 71]);
  const cheap = await tryOrder([{ design: "slab", width: 300, height: 400 }]);
  assert.strictEqual((await spec((await cheap.json()).ref)).totals.sub, 28, "new orders use the saved prices");
  const badSave = await form("/admin/pricing", { ...body, discount: "100" });
  assert(badSave.status === 400 && (await badSave.text()).includes("Not saved"));
  await form("/admin/pricing", { reset: "1" });
  assert.deepStrictEqual(E.getPricing(), P0);
  step("pricing: Etsy bands less 10%, every orderable size under Etsy, oversize from sheet use, /admin/pricing saves and resets, Etsy kept off the public prices");

  // ---------- payment mode: Pay online ----------
  assert.deepStrictEqual(["BT1 1AA", "IM1 1AA", "JE2 3AB", "TR21 0AA", "PO30 1AA", "IV2 3AA", "HS1 2AA", "KW15 1AA", "PA60 7AA", "HR5 3DJ", "SW1A 1AA", "PO1 1AA", "PH1 1AA"].map(E.deliveryArea),
    ["Northern Ireland", "Isle of Man", "the Channel Islands", "the Isles of Scilly", "the Isle of Wight", "the Scottish Highlands", "the Scottish islands", "the Scottish islands", "the Scottish islands", null, null, null, null]);
  const postOrder = (customer, intent) => req("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer: { name: "Pat Payer", email: "pat@example.com", line1: "1 Road", town: "Leeds", ...customer }, doors: [{ design: "shaker", width: 500, height: 720, qty: 2 }], intent }) });
  let home = await (await req("/")).text();
  assert(home.includes("confirm the price before you pay") && !home.includes("pay securely online") && !home.includes("<!--mode"), "quote wording in Quote first mode");
  assert.strictEqual((await (await req("/api/pricing")).json()).mode, "quote");
  const qp = await postOrder({ postcode: "LS1 4AB" }, "pay");
  const qpd = await qp.json();
  assert(qp.status === 201 && !qpd.payUrl && (await spec(qpd.ref)).status === "new", "no paying online in Quote first mode");
  assert.strictEqual((await form("/admin/mode", { mode: "checkout" }, "https://evil.example")).status, 403);
  assert((await (await form("/admin/mode", { mode: "checkout" })).text()).includes("Payment mode is now <b>Pay online</b>"));
  home = await (await req("/")).text();
  assert(home.includes("pay securely online") && !home.includes("confirm the price before you pay") && !home.includes("<!--mode"));
  const terms = await (await req("/terms")).text();
  assert(terms.includes("Quote requests.") && !terms.includes("Order request.</b>") && terms.includes("send us a quote request instead of paying online"));
  const cfgPage = await (await req("/configurator")).text();
  assert(cfgPage.includes('data-mode="checkout"') && !cfgPage.includes("testbar") && cfgPage.includes("intentToggle"));
  assert((await (await req("/terms.html")).text()).includes("Quote requests."), "the .html address gets the same wording");
  // a mainland customer pays online: no emails until they've paid
  await settle(); emails.length = 0;
  const co = await postOrder({ postcode: "ls1 4ab" }, "pay");
  const cod = await co.json();
  assert(co.status === 201 && cod.payUrl, "checkout returns a payment address");
  await settle();
  assert.strictEqual(emails.length, 0, "no emails before payment");
  o = await spec(cod.ref);
  assert(o.checkout && o.status === "quoted" && o.quote === Math.round(o.totals.total * 100) && o.quote === 12500, "priced at the website price: 2 x £54 + £17 delivery");
  assert((await page("/admin")).includes("Awaiting payment (online checkout)"));
  const coGo = await req(cod.payUrl);
  assert.strictEqual(coGo.status, 303);
  const coSid = coGo.headers.get("location").split("/").pop();
  assert.strictEqual(sessions[coSid].params.line_items[0].price_data.unit_amount, 12500);
  sessions[coSid].payment_status = "paid";
  const coDone = await (await req(`/pay/${cod.ref}/done?t=${cod.payUrl.split("t=")[1]}&s=${coSid}`)).text();
  assert(coDone.includes("has gone through") && coDone.includes("order confirmation"));
  await settle();
  assert.strictEqual((await spec(cod.ref)).status, "paid");
  assert(emails.some((m) => m.to[0] === "pat@example.com" && m.subject.startsWith("Order confirmed")) && emails.some((m) => m.subject.startsWith("New paid order")), "confirmation to the customer and a paid notice to Tim");
  // outside the delivery area: can't pay online, can send a quote request
  for (const pc of ["BT1 1AA", "PO30 5AA", "HS1 2AA", "IV2 3AA"]) {
    const no = await postOrder({ postcode: pc }, "pay");
    assert(no.status === 400 && /can't take payment online/.test((await no.json()).error), pc + " can't pay online");
  }
  emails.length = 0;
  const oq = await postOrder({ postcode: "BT1 1AA" }, "quote");
  const oqd = await oq.json();
  assert(oq.status === 201 && !oqd.payUrl);
  await settle();
  o = await spec(oqd.ref);
  assert(o.status === "new" && !o.checkout && o.history.some((h) => /Northern Ireland: outside the online delivery area/.test(h.what)) && emails.length === 2, "quote request from outside the area, emails as usual");
  const mq = await postOrder({ postcode: "LS1 4AB" }, "quote");
  assert((await spec((await mq.json()).ref)).status === "new", "anyone can still ask for a quote");
  await form("/admin/mode", { mode: "quote" });
  assert((await (await req("/")).text()).includes("confirm the price before you pay"));
  step("payment mode: switch on /admin/pricing, page wording follows it, mainland checkout pays at once with emails after payment, outside-area and chosen quotes come in as requests");

  // ---------- hinge-hole charge (off by default) ----------
  const pubP = async () => (await req("/api/pricing")).json();
  assert.deepStrictEqual((await pubP()).hinges, { charge: false, perDoor: 0 }, "no hinge charge by default");
  const hingeDoor = { design: "shaker", width: 500, height: 720, hingeSide: "left", hingeCount: 2 };
  let ho = await spec((await (await tryOrder([hingeDoor])).json()).ref);
  assert(ho.totals.sub === 54 && ho.totals.hinges === 0, "hinge holes free while the charge is off");
  assert((await page("/admin/pricing")).includes("Hinge holes"));
  assert.strictEqual((await form("/admin/hinges", { charge: "yes", perDoor: "8" }, "https://evil.example")).status, 403);
  assert.strictEqual((await form("/admin/hinges", { charge: "yes", perDoor: "0" })).status, 400, "a charge needs an amount");
  assert((await (await form("/admin/hinges", { charge: "yes", perDoor: "8" })).text()).includes("£8.00 per door"));
  assert.deepStrictEqual((await pubP()).hinges, { charge: true, perDoor: 8 });
  ho = await spec((await (await tryOrder([{ ...hingeDoor, qty: 2 }, { design: "shaker", width: 500, height: 720 }])).json()).ref);
  assert(ho.totals.sub === 3 * 54 + 16 && ho.totals.hinges === 16, "£8 per door with hinge holes, none on the door without");
  const hpr = await spec((await (await tryOrder([{ design: "arched", width: 450, height: 900, opts: { layout: "pair" }, hingeSide: "left" }])).json()).ref);
  assert.strictEqual(hpr.totals.hinges, 16, "each door of a pair is charged");
  // saving prices keeps the hinge charge
  await form("/admin/pricing", body);
  assert.deepStrictEqual((await pubP()).hinges, { charge: true, perDoor: 8 }, "saving prices keeps the hinge charge");
  await form("/admin/pricing", { reset: "1" });
  E.setPricing(await pubP());
  assert.strictEqual(E.priceDoor(nd(hingeDoor).door), 62, "the engine adds the charge to the door price");
  assert((await (await form("/admin/hinges", { charge: "no", perDoor: "8" })).text()).includes("Hinge holes are now free"));
  E.setPricing(await pubP());
  assert.strictEqual(E.priceDoor(nd(hingeDoor).door), 54);
  step("hinge holes: free by default, a per-door charge switched on and off at /admin/pricing, pairs charged per door, kept when prices are saved");

  // ---------- discount codes ----------
  const dform = (b) => form("/admin/discounts", { kind: "percent", minSpend: "0", maxUses: "0", expires: "", note: "", ...b });
  const chk = async (c) => { const r = await req("/api/discount?code=" + encodeURIComponent(c)); return { status: r.status, ...(await r.json()) }; };
  assert((await page("/admin/discounts")).includes("No codes yet"));
  assert.strictEqual((await pubP()).codes, false, "discount codes are off by default");
  assert.strictEqual((await form("/admin/discounts", { code: "EVIL", value: "50" }, "https://evil.example")).status, 403);
  assert.strictEqual((await dform({ code: "a b", value: "10" })).status, 400, "codes need 3+ letters or numbers");
  assert.strictEqual((await dform({ code: "BIG", value: "95" })).status, 400, "at most 90%");
  assert.strictEqual((await dform({ code: "OLD", value: "10", expires: "2020-01-01" })).status, 400, "no end dates in the past");
  assert((await (await dform({ code: "welcome10", value: "10", note: "Flyer" })).text()).includes("WELCOME10</b> created"));
  assert.strictEqual((await dform({ code: "Welcome10", value: "5" })).status, 400, "no duplicate codes");
  await dform({ code: "TENOFF", kind: "amount", value: "10", minSpend: "100", maxUses: "1" });
  let ck = await chk("welcome10");
  assert(ck.status === 404 && /aren't available/.test(ck.error), "codes are refused while the switch is off");
  assert.strictEqual((await form("/admin/discounts-switch", { on: "yes" }, "https://evil.example")).status, 403);
  assert((await (await form("/admin/discounts-switch", { on: "yes" })).text()).includes("Discount codes are now <b>on</b>"));
  assert.strictEqual((await pubP()).codes, true);
  ck = await chk(" welcome10 ");
  assert(ck.status === 200 && ck.discount.code === "WELCOME10" && ck.discount.value === 10 && !("note" in ck.discount) && !("uses" in ck.discount), "codes are checked without the private details");
  assert.strictEqual((await chk("NOPE")).status, 404);
  const dcOrder = (doors, code, intent = "quote") => req("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer: { name: "Dee Count", email: "dc@example.com", line1: "1 Road", town: "Leeds", postcode: "LS1 4AB" }, doors, intent, discountCode: code }) });
  // 2 x £54 = £108, 10% off = £10.80, delivery £17 still charged
  let dr = await dcOrder([{ design: "shaker", width: 500, height: 720, qty: 2 }], "welcome10");
  let dd = await spec((await dr.json()).ref);
  assert(dr.status === 201 && dd.totals.discount.amount === 10.8 && dd.totals.ship === 17 && dd.totals.total === 114.2, "10% off the doors, not delivery");
  assert(dd.history.some((h) => h.what.includes("Discount code WELCOME10")));
  assert((await page("/admin")).includes("incl. code WELCOME10"));
  const nb = await dcOrder([{ design: "shaker", width: 500, height: 720 }], "TENOFF");
  assert(nb.status === 400 && /at least £100/.test((await nb.json()).error), "minimum spend checked");
  assert(/isn't valid/.test((await (await dcOrder([{ design: "shaker", width: 500, height: 720 }], "NOPE")).json()).error), "unknown codes refused, not ignored");
  // Pay online: the Stripe price has the discount taken off; a use is counted when paid
  await form("/admin/mode", { mode: "checkout" });
  dr = await dcOrder([{ design: "shaker", width: 500, height: 720, qty: 2 }], "TENOFF", "pay");
  const drd = await dr.json();
  dd = await spec(drd.ref);
  assert(dd.quote === 11500 && dd.totals.discount.amount === 10, "£108 - £10 + £17 = £115");
  const dGo = await req(drd.payUrl);
  const dSid = dGo.headers.get("location").split("/").pop();
  assert.strictEqual(sessions[dSid].params.line_items[0].price_data.unit_amount, 11500);
  assert(sessions[dSid].params.line_items[0].price_data.product_data.description.includes("discount code TENOFF"));
  assert((await (await req(drd.payUrl.replace("/checkout", ""))).text()).includes("Discount code TENOFF"), "the pay page shows the discount");
  sessions[dSid].payment_status = "paid";
  await req(`/pay/${drd.ref}/done?t=${drd.payUrl.split("t=")[1]}&s=${dSid}`);
  await settle();
  assert(emails.some((m) => m.to[0] === "dc@example.com" && m.text.includes("Discount code TENOFF: −£10.00")), "emails show the discount");
  ck = await chk("TENOFF");
  assert(ck.status === 404 && /used up/.test(ck.error), "a one-use code is used up once paid");
  assert((await page("/admin/discounts")).includes("Used up"));
  await form("/admin/mode", { mode: "quote" });
  // switch off, on and delete
  await form("/admin/discounts/WELCOME10", { action: "off" });
  assert((await chk("WELCOME10")).status === 404, "switched-off codes don't work");
  await form("/admin/discounts/WELCOME10", { action: "on" });
  assert((await chk("WELCOME10")).status === 200);
  await form("/admin/discounts-switch", { on: "no" });
  assert(/aren't available/.test((await (await dcOrder([{ design: "shaker", width: 500, height: 720 }], "WELCOME10")).json()).error), "orders can't use codes while the switch is off");
  await form("/admin/discounts-switch", { on: "yes" });
  await form("/admin/discounts/WELCOME10", { action: "delete" });
  await form("/admin/discounts/TENOFF", { action: "delete" });
  assert((await chk("WELCOME10")).status === 404 && (await page("/admin/discounts")).includes("No codes yet"));
  assert.strictEqual((await spec(drd.ref)).totals.discount.code, "TENOFF", "orders keep their discount after the code is deleted");
  assert.strictEqual(E.discountFor({ kind: "amount", value: 50 }, 30), 30, "a discount never goes below zero");
  step("discount codes: made, checked, switched off and deleted on /admin/discounts; percent or £ off the doors only; minimum spend, use limits; Stripe charged the discounted price; shown on the pay page and emails");

  // ---------- filters, search and deleting several orders ----------
  let fl = await page("/admin?q=pat%40example.com");
  assert(fl.includes(`id="${cod.ref}"`) && !fl.includes(`id="${ref}"`) && fl.includes("matching"), "search by email finds the order");
  assert((await page(`/admin?q=${cod.ref.toLowerCase()}`)).includes(`id="${cod.ref}"`), "search by reference, any case");
  fl = await page("/admin?show=paid");
  assert(fl.includes(`id="${cod.ref}"`) && fl.includes("Paid: to cut") && !fl.includes(`id="${oqd.ref}"`));
  fl = await page("/admin?show=new");
  assert(fl.includes(`id="${oqd.ref}"`) && !fl.includes(`id="${cod.ref}"`));
  assert((await page("/admin?show=action")).includes(`id="${oqd.ref}"`), "new requests need action");
  assert((await page("/admin")).includes('aria-current="true">Current'));
  const bulk = (body, origin) => req("/admin/bulk-delete", { method: "POST", headers: { ...auth, Origin: origin || BASE, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
  const mq2 = (await spec(oqd.ref)).ref;
  assert.strictEqual((await bulk([["refs", mq2]], "https://evil.example")).status, 403);
  let bd = await (await bulk([["refs", mq2], ["refs", cod.ref]])).text();
  assert(bd.includes("Delete 2 orders?") && bd.includes("Type <b>DELETE</b>"), "asks first, and paid orders need DELETE typed");
  assert.strictEqual((await bulk([["refs", mq2], ["refs", cod.ref], ["confirm", "yes"], ["typed", "delete"]])).status, 400);
  assert.strictEqual((await req(`/admin/orders/${mq2}.json`, { headers: auth })).status, 200, "nothing deleted without DELETE");
  const bdone = await bulk([["refs", mq2], ["refs", cod.ref], ["confirm", "yes"], ["typed", "DELETE"]]);
  assert(bdone.status === 303 && bdone.headers.get("location").endsWith("deleted=2"));
  assert.strictEqual((await req(`/admin/orders/${cod.ref}.json`, { headers: auth })).status, 404);
  assert((await page("/admin?deleted=2")).includes("2 orders deleted"));
  step("filters: search and what's-next views with counts; delete several orders at once, with DELETE typed for paid ones");

  // ---------- WhatsApp button ----------
  assert(!(await (await req("/contact")).text()).includes("wa.me") && !(await (await req("/configurator")).text()).includes("wa-float"), "no button until a number is saved");
  const waSave = (n, origin) => req("/admin/whatsapp", { method: "POST", headers: { ...auth, Origin: origin || BASE, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ whatsapp: n }) });
  assert.strictEqual((await waSave("07700 900123", "https://evil.example")).status, 403);
  assert.strictEqual((await waSave("not a number")).status, 400);
  assert((await (await waSave("07700 900123")).text()).includes("WhatsApp button is on, for +447700900123"));
  const ct = await (await req("/contact")).text();
  assert(ct.includes("https://wa.me/447700900123?text=") && ct.includes("wa-float") && !ct.includes("__WA_URL__") && !ct.includes("<!--wa"));
  assert((await (await req("/configurator")).text()).includes("https://wa.me/447700900123?text="), "on the Shop page");
  assert(!(await (await req("/")).text()).includes("wa.me"), "not on the home page");
  assert((await (await req("/privacy")).text()).includes("<b>WhatsApp</b>"));
  await waSave("");
  assert(!(await (await req("/contact")).text()).includes("wa.me"), "empty number hides it again");
  step("WhatsApp button: set on /admin/pricing, shown on Shop and Contact only, privacy note, hidden when cleared");

  // ---------- visitor counting ----------
  for (const path of ["/", "/configurator", "/story", "/contact", "/terms", "/privacy"]) {
    const h = await (await req(path)).text();
    assert.strictEqual((h.match(/static\.cloudflareinsights\.com\/beacon\.min\.js/g) || []).length, 1, path + " counts visits once");
    assert(h.includes('<meta name="google-site-verification" content="NojJCifZUdCLtJ8YbGHnGiaJHK_ztOtDh8CGmwDJ9cs">'), path + " has the Search Console tag");
  }
  assert(!(await page("/admin")).includes("cloudflareinsights"), "admin pages aren't counted");
  step("Cloudflare Web Analytics on every public page, not on /admin");
  const robots = await (await req("/robots.txt")).text();
  assert(robots.includes("Disallow: /admin") && robots.includes("Sitemap: https://pivotdesigns.co.uk/sitemap.xml"));
  const sm = await req("/sitemap.xml");
  const smx = await sm.text();
  assert(sm.status === 200 && /xml/.test(sm.headers.get("content-type")) && smx.includes("<loc>https://pivotdesigns.co.uk/configurator</loc>") && !smx.includes("admin"));
  assert.strictEqual(await (await req("/googlea5060464aae04fbe.html")).text(), "google-site-verification: googlea5060464aae04fbe.html", "Google Search Console verification file served exactly");
  step("robots.txt and sitemap.xml for search engines");

  // ---------- quote-only wording stays out of Pay online mode ----------
  await form("/admin/mode", { mode: "checkout" });
  assert(!(await (await req("/configurator")).text()).includes("We check every order and confirm the price, including delivery, before you pay."));
  await form("/admin/mode", { mode: "quote" });
  assert((await (await req("/configurator")).text()).includes("We check every order and confirm the price, including delivery, before you pay."));
  step("the \"we check every order\" note only shows in Quote first mode");

  const dxf = await req(`/admin/orders/${ref}.dxf`, { headers: auth });
  assert(dxf.status === 200 && (await dxf.text()).includes("CUTOUT"));
  step("DXF still downloads");

  // ---------- sign out, sign out everywhere, and the lock-out (last: it blocks this address) ----------
  let so = await req("/admin/logout", { method: "POST", headers: second });
  assert(so.status === 303 && /pivot_admin=;/.test(so.headers.get("set-cookie")));
  assert.strictEqual((await form("/admin/security", { do: "everywhere" })).status, 303);
  assert.strictEqual((await req("/admin", { headers: auth })).status, 303, "sign out everywhere ends every session");
  for (let i = 0; i < 10; i++) await login({ password: "wrong" + i });
  assert.strictEqual((await login({ password: "pw" })).status, 429, "locked out after 10 wrong tries, even with the right password");
  step("sign out, sign out everywhere, and 10 wrong passwords lock the visitor out for 15 minutes");

  console.log(`\nAll tests passed (orders kept in ${process.env.DATABASE_URL ? "Postgres" : "a file"}).`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
