// Shared order logic: statuses, creating an order, and noting emails.
// Used by the public order form (server.js) and the admin pages (lib/admin.js).
const crypto = require("crypto");

// Prices are kept in pence. Orders move through these statuses.
const STATUSES = ["new", "quoted", "paid", "cut", "dispatched", "cancelled", "refunded"];
const STATUS_TEXT = {
  new: "New request", quoted: "Price confirmed, awaiting payment", paid: "Paid", cut: "Cut",
  dispatched: "Dispatched", cancelled: "Cancelled", refunded: "Refunded"
};

function newRef() {
  const ymd = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return "PD-" + ymd + "-" + crypto.randomBytes(2).toString("hex").toUpperCase();
}
const newToken = () => crypto.randomBytes(18).toString("base64url");
// One line of text: control characters become spaces.
const clean = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
// Several lines of text: keeps line breaks, drops other control characters.
const cleanLines = (s, max) => String(s == null ? "" : s).replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, " ").trim().slice(0, max);
// A UK postcode, tidied to capitals with one space before the last three characters.
const UK_POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}|GIR 0AA)$/;
function formatPostcode(p) {
  const s = String(p == null ? "" : p).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return s.length > 3 ? s.slice(0, -3) + " " + s.slice(-3) : s;
}
const money = (pence) => "£" + (pence / 100).toFixed(2);
const estimatePence = (o) => Math.round(o.totals.total * 100);
const note = (o, what) => { o.history = (o.history || []).concat({ at: new Date().toISOString(), what }); };

module.exports = function makeOrders({ store, E, email }) {
  // Checks a submitted order (from the configurator) and saves it.
  // Returns { order } or { error }.
  async function createOrder(body, { source }) {
    const c = (body && body.customer) || {};
    // The order form sends the address as separate lines; older forms sent one block.
    const lines = { line1: clean(c.line1, 100), line2: clean(c.line2, 100), town: clean(c.town, 60) };
    const postcode = formatPostcode(c.postcode);
    const customer = {
      name: clean(c.name, 80), email: clean(c.email, 120), phone: clean(c.phone, 40), postcode,
      address: lines.line1 ? [lines.line1, lines.line2, lines.town].filter(Boolean).join(", ") : clean(c.address, 300),
      notes: clean(c.notes, 1000)
    };
    if (lines.line1) customer.addressLines = lines;
    if (customer.name.length < 2) return { error: "Please add your name." };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email)) return { error: "Please add a valid email address." };
    if (lines.line1 && !lines.town) return { error: "Please add your town or city." };
    if (!customer.address) return { error: "Please add your delivery address." };
    if (!postcode) return { error: "Please add your delivery postcode." };
    if (!UK_POSTCODE.test(postcode)) return { error: "Please check your postcode. We deliver to UK addresses." };
    if (!Array.isArray(body.doors) || !body.doors.length) return { error: "Add at least one door to your list." };
    if (body.doors.length > 50) return { error: "Please send no more than 50 door lines in one request." };
    // Every door is checked again here with the same engine, so the DXF is always makeable.
    const doors = [];
    for (let i = 0; i < body.doors.length; i++) {
      const { door, errors } = E.normalizeDoor(body.doors[i]);
      const msgs = Object.values(errors);
      if (msgs.length) return { error: `Door ${i + 1}: ${msgs.join(" ")}` };
      if (!E.orderable(E.designById(door.design))) return { error: `Door ${i + 1}: the ${E.designById(door.design).name} design is no longer available. Please choose another.` };
      doors.push(door);
    }
    const created = new Date().toISOString();
    const order = {
      ref: newRef(), created, source, engine: E.VERSION, customer, doors, totals: E.priceOrder(doors),
      status: "new", quote: null, payToken: newToken(), pendingEmail: null,
      history: [{ at: created, what: source === "admin" ? "Order created by Tim on the orders page" : "Request received" }]
    };
    await store.add(order);
    console.log(`Order ${source === "admin" ? "created by Tim" : "request"} ${order.ref}: ${order.totals.count} doors, £${order.totals.total}`);
    return { order };
  }

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
    return { ok: !what.startsWith("Email FAILED"), what };
  }

  return { STATUSES, STATUS_TEXT, newToken, clean, cleanLines, money, estimatePence, note, createOrder, mail };
};
