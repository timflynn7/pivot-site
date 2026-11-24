// The payment mode, switched on /admin/pricing:
//   "quote"    Quote first: customers send a request, Tim confirms the price, then they pay.
//   "checkout" Pay online: customers pay straight away (mainland GB addresses only;
//              anyone else, or anyone who asks, still gets a quote).
// Pages mark wording for one mode with <!--mode:quote--> ... <!--/mode--> or
// <!--mode:checkout--> ... <!--/mode-->; renderPage() keeps the blocks for the
// current mode and drops the others, and fills in __PIVOT_MODE__.
const fs = require("fs");

module.exports = function makeSite({ store }) {
  let mode = "quote";
  const cache = new Map();
  return {
    async load() { const m = await store.getSetting("mode"); mode = m === "checkout" ? "checkout" : "quote"; },
    mode: () => mode,
    async setMode(m) { mode = m === "checkout" ? "checkout" : "quote"; await store.setSetting("mode", mode); return mode; },
    renderPage(file) {
      let html = cache.get(file);
      if (html === undefined) { html = fs.readFileSync(file, "utf8"); cache.set(file, html); }
      return html
        .replace(/<!--mode:(quote|checkout)-->([\s\S]*?)<!--\/mode-->/g, (all, m, inner) => (m === mode ? inner : ""))
        .replace(/__PIVOT_MODE__/g, mode);
    }
  };
};
