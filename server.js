// Pivot Designs website.
// Serves the pages in /public. The configurator, order requests and DXF
// downloads will be added as routes here in the next steps.
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Send www.pivotdesigns.co.uk to pivotdesigns.co.uk so there is one address.
app.use((req, res, next) => {
  if (req.hostname === "www.pivotdesigns.co.uk") {
    return res.redirect(301, "https://pivotdesigns.co.uk" + req.originalUrl);
  }
  next();
});

app.get("/health", (req, res) => res.json({ ok: true }));

// Clean addresses: /story serves story.html, and so on.
app.use(express.static(PUBLIC, { extensions: ["html"], maxAge: "1h" }));

app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC, "404.html")));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Pivot Designs running on port ${PORT}`);
});
