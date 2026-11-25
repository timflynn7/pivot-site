// UK address lookup for the order form, through Ideal Postcodes.
//
// The browser never sees the API key: it asks this server, which asks
// Ideal Postcodes. Suggestions as you type are free; each address a customer
// picks uses one lookup from Tim's credit. Each visitor is limited to a
// number of searches so nobody can drain the credit.
//
// Settings in Render's Environment tab:
//   IDEAL_POSTCODES_KEY   the API key (ak_...) from the Ideal Postcodes dashboard
// Without it the search box is hidden and customers type their address in.
const express = require("express");

const API = () => (process.env.IDEAL_POSTCODES_URL || "https://api.ideal-postcodes.co.uk").replace(/\/$/, "");
const key = () => process.env.IDEAL_POSTCODES_KEY;

// Simple per-visitor limits, kept in memory.
function limiter(max, windowMs) {
  const seen = new Map();
  return (ip) => {
    const now = Date.now();
    const list = (seen.get(ip) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) { seen.set(ip, list); return false; }
    list.push(now); seen.set(ip, list);
    if (seen.size > 5000) seen.clear();
    return true;
  };
}
// Free postcode check through postcodes.io (no key, no cost). Only the postcode
// is sent, from this server, so the visitor's own address isn't shared.
const PCIO = () => (process.env.POSTCODES_IO_URL || "https://api.postcodes.io").replace(/\/$/, "");
const PC_RE = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/;
const pcCache = new Map();
async function checkPostcode(pc) {
  if (pcCache.has(pc)) return pcCache.get(pc);
  const get = (path) => fetch(PCIO() + path + encodeURIComponent(pc), { signal: AbortSignal.timeout(5000), headers: { Accept: "application/json" } });
  let out;
  const r = await get("/postcodes/");
  if (r.ok) {
    const a = (await r.json()).result || {};
    const district = a.admin_district && a.admin_district !== a.country ? a.admin_district.replace(/, (County|City) of$/, "") : "";
    out = { found: true, postcode: a.postcode || pc, area: [district, a.country].filter(Boolean).join(", ") };
  } else if (r.status === 404) {
    // A postcode that has been retired still gets deliveries for a while; treat it as found.
    const t = await get("/terminated_postcodes/");
    out = t.ok ? { found: true, postcode: ((await t.json()).result || {}).postcode || pc, area: "", old: true } : { found: false };
  } else throw new Error("postcodes.io " + r.status);
  pcCache.set(pc, out);
  if (pcCache.size > 5000) pcCache.clear();
  return out;
}

const suggestLimit = limiter(150, 10 * 60 * 1000); // searches while typing
const pickLimit = limiter(15, 10 * 60 * 1000);     // addresses chosen (these cost credit)
const pcLimit = limiter(60, 10 * 60 * 1000);       // free postcode checks

async function call(path, params) {
  const u = new URL(API() + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set("api_key", key());
  const r = await fetch(u, { signal: AbortSignal.timeout(6000), headers: { Accept: "application/json" } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Ideal Postcodes ${r.status}: ${body.message || "lookup failed"}`);
  return body.result || {};
}

module.exports = function addressLookup() {
  const router = express.Router();

  router.get("/api/address/status", (req, res) => res.set("Cache-Control", "no-store").json({ enabled: !!key() }));

  // Is this a real UK postcode? Always on. { found: true, postcode, area } or { found: false };
  // { found: null } when the check couldn't run, so the form never blocks on it.
  router.get("/api/postcode", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const pc = String(req.query.pc || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!PC_RE.test(pc)) return res.json({ found: false, format: true });
    if (/^(IM|JE|GY)/.test(pc)) return res.json({ found: null }); // Crown dependencies aren't in the free data
    if (!pcLimit(req.ip)) return res.json({ found: null });
    try { res.json(await checkPostcode(pc)); }
    catch (e) { console.error("Postcode check failed:", e.message); res.json({ found: null }); }
  });

  router.get("/api/address/suggest", async (req, res) => {
    if (!key()) return res.status(503).json({ error: "Address search is switched off." });
    const q = String(req.query.q || "").trim().slice(0, 100);
    if (q.length < 3) return res.json({ hits: [] });
    if (!suggestLimit(req.ip)) return res.status(429).json({ error: "Too many searches. Please type your address in." });
    try {
      const result = await call("/v1/autocomplete/addresses", { query: q, limit: "8" });
      const hits = (result.hits || []).map((h) => ({ id: String(h.id || ""), text: String(h.suggestion || "") })).filter((h) => h.id && h.text);
      res.set("Cache-Control", "no-store").json({ hits });
    } catch (e) {
      console.error("Address search failed:", e.message);
      res.status(502).json({ error: "Address search isn't working right now. Please type your address in." });
    }
  });

  router.get("/api/address/resolve", async (req, res) => {
    if (!key()) return res.status(503).json({ error: "Address search is switched off." });
    const id = String(req.query.id || "");
    if (!/^[A-Za-z0-9_\-]{1,80}$/.test(id)) return res.status(400).json({ error: "Unknown address." });
    if (!pickLimit(req.ip)) return res.status(429).json({ error: "Too many lookups. Please type your address in." });
    try {
      const a = await call(`/v1/autocomplete/addresses/${encodeURIComponent(id)}/gbr`, {});
      const line2 = [a.line_2, a.line_3].filter(Boolean).join(", ");
      // Royal Mail town names are in capitals: KINGTON → Kington, NEWCASTLE UPON TYNE → Newcastle upon Tyne.
      const town = String(a.post_town || "").toLowerCase().replace(/(^|[\s-])([a-z])/g, (m, s, c) => s + c.toUpperCase()).replace(/\b(Upon|On|Under|Le|La|De|Du|Super|By|In|The|And)\b/g, (w) => w.toLowerCase()).replace(/^./, (c) => c.toUpperCase());
      res.set("Cache-Control", "no-store").json({ line1: a.line_1 || "", line2, town, postcode: a.postcode || "" });
    } catch (e) {
      console.error("Address lookup failed:", e.message);
      res.status(502).json({ error: "We couldn't fetch that address. Please type it in." });
    }
  });

  return { router };
};
