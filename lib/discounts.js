// Discount codes, made by Tim on /admin/discounts (27 Nov 2026).
//
// A code takes a percentage or a fixed amount (£) off the doors, never off
// delivery. Free delivery is still judged on the doors before the discount.
// Each code can have a minimum spend, an end date and a limit on how many
// times it can be used, and can be switched off without deleting it.
// A use is counted when an order with the code is paid (by Stripe or marked
// paid by Tim), so abandoned checkouts don't use one up.
//
// Stored in the "discounts" setting as a list:
//   { code, kind: "percent" | "amount", value, minSpend, expires: "YYYY-MM-DD" | "",
//     maxUses (0 = no limit), uses, active, note, created }
// Customers only ever see the code, the kind, the value and the minimum spend.
// A switch on the same page ("discountsOn" setting, off by default) turns the whole
// feature on or off: while it's off the basket has no code box and every code is refused.

const CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,23}$/;
const tidy = (c) => String(c == null ? "" : c).toUpperCase().replace(/\s+/g, "").slice(0, 24);
// End dates run to the end of that day, UK time (near enough: midnight UTC the day after, plus an hour for summer time).
const endsAt = (d) => new Date(d + "T00:00:00Z").getTime() + 864e5 + 36e5;
const today = () => new Date().toISOString().slice(0, 10);

module.exports = function makeDiscounts({ store }) {
  let codes = [], on = false;
  const save = () => store.setSetting("discounts", codes);
  const find = (code) => codes.find((c) => c.code === tidy(code));
  const publicView = (c) => ({ code: c.code, kind: c.kind, value: c.value, minSpend: c.minSpend || 0 });
  const money = (n) => "£" + (Number.isInteger(n) ? n : n.toFixed(2));
  const describe = (c) => `${c.kind === "percent" ? c.value + "% off" : money(c.value) + " off"} your doors${c.minSpend ? ` when they come to ${money(c.minSpend)} or more` : ""}`;

  // Why a code can't be used right now, or "" if it can.
  function problem(c) {
    if (!c || !c.active) return "That discount code isn't valid.";
    if (c.expires && Date.now() > endsAt(c.expires)) return "That discount code has expired.";
    if (c.maxUses && (c.uses || 0) >= c.maxUses) return "That discount code has been used up.";
    return "";
  }

  return {
    CODE_RE,
    tidy,
    describe,
    async load() { const s = await store.getSetting("discounts"); codes = Array.isArray(s) ? s : []; on = (await store.getSetting("discountsOn")) === true; },
    enabled: () => on,
    async setEnabled(v) { on = !!v; await store.setSetting("discountsOn", on); return on; },
    list: () => codes.slice(),
    // For customers: { discount } (the public part) or { error }.
    check(code) {
      const t = tidy(code);
      if (!on) return { error: "Discount codes aren't available at the moment." };
      if (!t) return { error: "Please type a discount code." };
      const c = find(t), why = problem(c);
      if (why) return { error: why };
      return { discount: publicView(c), text: describe(c) };
    },
    // Tim adds a code. Returns { code } or { error }.
    async add(b) {
      const code = tidy(b.code);
      const kind = b.kind === "amount" ? "amount" : "percent";
      const num = (v, def) => (v === undefined || v === "" ? def : Number(v));
      const value = num(b.value, NaN), minSpend = num(b.minSpend, 0), maxUses = num(b.maxUses, 0);
      const expires = String(b.expires || "").trim();
      if (!CODE_RE.test(code)) return { error: "Codes are 3 to 24 letters, numbers or dashes, e.g. WELCOME10." };
      if (find(code)) return { error: `There's already a code called ${code}. Delete it first, or pick another name.` };
      if (!Number.isFinite(value) || value <= 0) return { error: "Give the discount a value above 0." };
      if (kind === "percent" && value > 90) return { error: "A percentage discount can be at most 90%." };
      if (!Number.isFinite(minSpend) || minSpend < 0) return { error: "Check the minimum spend (0 for none)." };
      if (!Number.isInteger(maxUses) || maxUses < 0) return { error: "Check the number of uses (0 for no limit)." };
      if (expires && (!/^\d{4}-\d{2}-\d{2}$/.test(expires) || isNaN(endsAt(expires)))) return { error: "Check the end date." };
      if (expires && expires < today()) return { error: "The end date is in the past." };
      const c = { code, kind, value: Math.round(value * 100) / 100, minSpend: Math.round(minSpend * 100) / 100, expires, maxUses, uses: 0, active: true, note: String(b.note || "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, 120), created: new Date().toISOString() };
      codes.push(c);
      await save();
      return { code: c };
    },
    async setActive(code, on) { const c = find(code); if (!c) return null; c.active = !!on; await save(); return c; },
    async remove(code) { const n = codes.length; codes = codes.filter((c) => c.code !== tidy(code)); if (codes.length !== n) await save(); return codes.length !== n; },
    // Counted when an order that used the code is paid.
    async used(code) { const c = find(code); if (!c) return; c.uses = (c.uses || 0) + 1; await save(); },
    status(c) {
      if (!c.active) return "Off";
      if (c.expires && Date.now() > endsAt(c.expires)) return "Expired";
      if (c.maxUses && (c.uses || 0) >= c.maxUses) return "Used up";
      return "On";
    }
  };
};
