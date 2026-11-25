// The payment mode, switched on /admin/pricing:
//   "quote"    Quote first: customers send a request, Tim confirms the price, then they pay.
//   "checkout" Pay online: customers pay straight away (mainland GB addresses only;
//              anyone else, or anyone who asks, still gets a quote).
// Pages mark wording for one mode with <!--mode:quote--> ... <!--/mode--> or
// <!--mode:checkout--> ... <!--/mode-->; renderPage() keeps the blocks for the
// current mode and drops the others, and fills in __PIVOT_MODE__.
// WhatsApp: Tim saves his number on /admin/pricing. <!--wa--> ... <!--/wa--> blocks
// only show when a number is saved, with __WA_URL__ filled in (wa.me link).
const fs = require("fs");

// Visitor counting: Cloudflare Web Analytics (Tim's account, set up 25 Nov 2026).
// No cookies, so no consent banner. The token isn't secret: it's in every page.
// Added to every public page here, so new pages get it too; the /admin pages don't.
const ANALYTICS = `<!-- Cloudflare Web Analytics --><script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "c58aa7c09d90471a90fb8c04216f9e74"}'></script><!-- End Cloudflare Web Analytics -->`;

module.exports = function makeSite({ store }) {
  let mode = "quote", whatsapp = "";
  // UK numbers: 07xxx or +44 7xxx → 447xxx (the form wa.me needs). Returns "" if it doesn't look right.
  const waNumber = (n) => {
    let d = String(n || "").replace(/[^\d+]/g, "");
    if (d.startsWith("+")) d = d.slice(1); else if (d.startsWith("00")) d = d.slice(2); else if (d.startsWith("0")) d = "44" + d.slice(1);
    return /^\d{10,15}$/.test(d) ? d : "";
  };
  const cache = new Map();
  return {
    async load() { const m = await store.getSetting("mode"); mode = m === "checkout" ? "checkout" : "quote"; whatsapp = waNumber(await store.getSetting("whatsapp")); },
    whatsapp: () => whatsapp,
    waNumber,
    async setWhatsapp(n) { whatsapp = waNumber(n); await store.setSetting("whatsapp", whatsapp); return whatsapp; },
    mode: () => mode,
    async setMode(m) { mode = m === "checkout" ? "checkout" : "quote"; await store.setSetting("mode", mode); return mode; },
    renderPage(file) {
      let html = cache.get(file);
      if (html === undefined) { html = fs.readFileSync(file, "utf8"); cache.set(file, html); }
      return html
        .replace(/<!--mode:(quote|checkout)-->([\s\S]*?)<!--\/mode-->/g, (all, m, inner) => (m === mode ? inner : ""))
        .replace(/<!--wa-->([\s\S]*?)<!--\/wa-->/g, (all, inner) => (whatsapp ? inner : ""))
        .replace(/__WA_URL__/g, "https://wa.me/" + whatsapp)
        .replace(/__PIVOT_MODE__/g, mode)
        .replace("</body>", ANALYTICS + "\n</body>");
    }
  };
};
