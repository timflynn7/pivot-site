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
const suggestLimit = limiter(150, 10 * 60 * 1000); // searches while typing
const pickLimit = limiter(15, 10 * 60 * 1000);     // addresses chosen (these cost credit)

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
