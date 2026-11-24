// Signing in to /admin (Tim only).
//
// 1. Password: ADMIN_PASSWORD from Render's Environment settings.
// 2. A 6-digit code from an authenticator app on Tim's phone (TOTP, RFC 6238),
//    or one of 10 single-use backup codes. The first sign-in after this was
//    added walks Tim through setting up the app.
// 3. A signed cookie keeps the browser signed in for 30 days. Changing
//    ADMIN_PASSWORD, or pressing "Sign out everywhere", signs every browser out.
//
// Wrong passwords and codes are limited per visitor and overall, every sign-in
// is logged (shown on /admin/security), and Tim is emailed for each one.
// Lost phone and backup codes: set ADMIN_RESET_2FA=yes in Render, sign in with
// the password, set the app up again, then remove ADMIN_RESET_2FA.
const crypto = require("crypto");
const express = require("express");
const QRCode = require("qrcode");

const DAY = 864e5;
const SESSION_DAYS = 30;
const COOKIE = "pivot_admin";
const LIMIT = { perIp: 10, overall: 50, windowMs: 15 * 60 * 1000 };

/* ---------- TOTP ---------- */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32(buf) {
  let bits = "", out = "";
  for (const b of buf) bits += b.toString(2).padStart(8, "0");
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}
function unbase32(s) {
  let bits = "";
  for (const c of s.replace(/=+$/, "").toUpperCase()) { const v = B32.indexOf(c); if (v >= 0) bits += v.toString(2).padStart(5, "0"); }
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
function totp(secret, step) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac("sha1", unbase32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, "0");
}
const stepNow = (t = Date.now()) => Math.floor(t / 30000);
const same = (a, b) => {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};
const hash = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

module.exports = function makeAuth({ store, email }) {
  let S = null; // { key, ver, totp, pending, recovery: [hash], lastStep, log: [] }
  async function load() {
    S = (await store.getSetting("auth")) || {};
    if (!S.key) S.key = crypto.randomBytes(32).toString("hex");
    if (!S.ver) S.ver = 1;
    if (!Array.isArray(S.log)) S.log = [];
    if (process.env.ADMIN_RESET_2FA === "yes" && S.totp) { S.totp = null; S.recovery = []; S.ver++; console.log("ADMIN_RESET_2FA: the authenticator app has been removed. Sign in with the password to set it up again."); }
    await save();
  }
  const save = () => store.setSetting("auth", S);
  const password = () => process.env.ADMIN_PASSWORD;
  // Signing key: changes when the password changes, so a new password signs everyone out.
  const sigKey = () => crypto.createHmac("sha256", S.key).update(password() || "").digest();
  const sign = (obj) => { const p = Buffer.from(JSON.stringify(obj)).toString("base64url"); return p + "." + crypto.createHmac("sha256", sigKey()).update(p).digest("base64url"); };
  function unsign(tok) {
    if (typeof tok !== "string" || !tok.includes(".")) return null;
    const [p, sig] = tok.split(".");
    const want = crypto.createHmac("sha256", sigKey()).update(p).digest("base64url");
    if (!same(sig, want)) return null;
    try { const o = JSON.parse(Buffer.from(p, "base64url").toString()); return o.exp > Date.now() ? o : null; } catch (e) { return null; }
  }
  const cookies = (req) => Object.fromEntries((req.get("cookie") || "").split(";").map((c) => c.trim().split("=")).filter((x) => x[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join("="))]));
  const signedIn = (req) => { const s = unsign(cookies(req)[COOKIE]); return !!(s && s.kind === "session" && s.ver === S.ver && S.totp); };

  /* ---------- limits on wrong guesses ---------- */
  const fails = new Map(); let overall = [];
  const recent = (arr) => arr.filter((t) => Date.now() - t < LIMIT.windowMs);
  const blocked = (ip) => recent(fails.get(ip) || []).length >= LIMIT.perIp || recent(overall).length >= LIMIT.overall;
  const fail = (ip) => { fails.set(ip, recent(fails.get(ip) || []).concat(Date.now())); overall = recent(overall).concat(Date.now()); };

  async function logEvent(req, what) {
    const ua = (req.get("user-agent") || "").replace(/[^\x20-\x7E]/g, "").slice(0, 160);
    S.log = [{ at: new Date().toISOString(), ip: req.ip, ua, what }].concat(S.log).slice(0, 30);
    await save();
  }
  function checkCode(code) {
    code = String(code || "").replace(/\s+/g, "").toLowerCase();
    if (/^\d{6}$/.test(code)) {
      const now = stepNow();
      for (const st of [now - 1, now, now + 1]) {
        if (st > (S.lastStep || 0) && same(totp(S.totp, st), code)) { S.lastStep = st; return "app"; } // each code works once
      }
      return null;
    }
    const i = (S.recovery || []).findIndex((h) => same(h, hash(code.replace(/-/g, ""))));
    if (i >= 0) { S.recovery.splice(i, 1); return "backup"; }
    return null;
  }
  const newRecovery = () => Array.from({ length: 10 }, () => crypto.randomBytes(5).toString("hex").replace(/(.{5})/, "$1-"));

  /* ---------- pages ---------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shell = (title, body) => `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} | Pivot Designs</title>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;padding:32px 16px;background:#F4F2EC;color:#1C1F1D}main{max-width:440px;margin:0 auto;background:#fff;border:1px solid #DAD6CC;border-radius:4px;padding:24px}h1{font-weight:500;font-size:24px;margin:0 0 12px}
label{display:grid;gap:4px;font-weight:600;margin:12px 0}input{font:inherit;padding:10px 12px;border:1.5px solid #BDB8AC;border-radius:3px}button{font:inherit;font-weight:600;padding:10px 16px;border-radius:3px;border:0;background:#4B5F51;color:#fff;cursor:pointer;margin-top:8px}
.m{color:#5D625C;font-size:14px}.bad{color:#9B2C1F;font-weight:600}.codes{font:15px ui-monospace,monospace;columns:2;background:#F4F2EC;padding:12px 16px;border-radius:3px}img{display:block;margin:12px auto}code{font-size:15px;word-break:break-all}</style></head><body><main>${body}</main></body></html>`;
  const send = (res, title, body, code = 200) => res.status(code).set({ "Cache-Control": "no-store", "X-Frame-Options": "DENY" }).send(shell(title, body));
  const safeNext = (n) => (typeof n === "string" && /^\/admin(\/|\?|#|$)/.test(n) && !n.startsWith("//") ? n : "/admin");
  const loginPage = (res, msg, next, code) => send(res, "Sign in", `<h1>Pivot orders: sign in</h1>${msg ? `<p class="bad">${msg}</p>` : ""}
<form method="post" action="/admin/login"><input type="hidden" name="next" value="${esc(safeNext(next))}"><label>Password <input type="password" name="password" autocomplete="current-password" autofocus required></label><button>Next</button></form>`, code);
  const codePage = (res, ticket, msg, code) => send(res, "Sign in", `<h1>Enter your code</h1>${msg ? `<p class="bad">${msg}</p>` : ""}
<p class="m">Open the authenticator app on your phone and type the 6-digit code for Pivot Designs. Lost your phone? Use one of your backup codes instead.</p>
<form method="post" action="/admin/login/code"><input type="hidden" name="ticket" value="${esc(ticket)}"><label>Code <input name="code" inputmode="numeric" autocomplete="one-time-code" autofocus required></label><button>Sign in</button></form>`, code);
  async function setupPage(res, ticket, secret, msg, code) {
    const uri = `otpauth://totp/Pivot%20Designs:Tim?secret=${secret}&issuer=Pivot%20Designs&digits=6&period=30`;
    const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
    send(res, "Set up sign-in codes", `<h1>Set up your phone</h1>${msg ? `<p class="bad">${msg}</p>` : ""}
<p>From now on, signing in needs your password <b>and</b> a code from your phone.</p>
<ol><li>Install an authenticator app if you don't have one: Google Authenticator, Microsoft Authenticator or 1Password.</li><li>In the app, add an account and scan this code:</li></ol>
<img src="${qr}" alt="QR code for your authenticator app" width="220" height="220">
<p class="m">Can't scan it? Choose "enter a setup key" in the app and type: <code>${secret.replace(/(.{4})/g, "$1 ").trim()}</code></p>
<form method="post" action="/admin/login/setup"><input type="hidden" name="ticket" value="${esc(ticket)}"><label>3. Type the 6-digit code the app shows <input name="code" inputmode="numeric" autocomplete="one-time-code" required></label><button>Turn on sign-in codes</button></form>`, code);
  }
  const setCookie = (req, res) => res.cookie(COOKIE, sign({ kind: "session", ver: S.ver, exp: Date.now() + SESSION_DAYS * DAY }), { httpOnly: true, secure: req.secure, sameSite: "lax", path: "/", maxAge: SESSION_DAYS * DAY });
  async function finish(req, res, how, next) {
    setCookie(req, res);
    await logEvent(req, how);
    email.signInAlert({ at: new Date(), ip: req.ip, ua: req.get("user-agent") || "", how }).catch((e) => console.error("Sign-in email failed", e.message));
  }

  const router = express.Router();
  const form = express.urlencoded({ extended: false, limit: "4kb" });
  router.get("/admin/login", (req, res) => (signedIn(req) ? res.redirect(303, safeNext(req.query.next)) : loginPage(res, "", req.query.next)));
  router.post("/admin/login", form, async (req, res, next) => {
    try {
      if (!password()) return send(res, "Sign in", `<h1>Sign-in is turned off</h1><p>Add ADMIN_PASSWORD in Render's Environment settings to turn it on.</p>`, 503);
      if (blocked(req.ip)) return loginPage(res, "Too many wrong attempts. Please wait 15 minutes and try again.", req.body.next, 429);
      if (!same(req.body.password || "", password())) { fail(req.ip); await logEvent(req, "Wrong password"); return loginPage(res, "That password isn't right.", req.body.next, 401); }
      const n = safeNext(req.body.next);
      if (!S.totp) {
        const secret = base32(crypto.randomBytes(20));
        return setupPage(res, sign({ kind: "setup", secret, next: n, exp: Date.now() + 15 * 60000 }), secret);
      }
      codePage(res, sign({ kind: "pw", next: n, exp: Date.now() + 5 * 60000 }));
    } catch (e) { next(e); }
  });
  router.post("/admin/login/code", form, async (req, res, next) => {
    try {
      const t = unsign(req.body.ticket);
      if (!t || t.kind !== "pw" || !S.totp) return loginPage(res, "That took too long. Please sign in again.", "/admin", 401);
      if (blocked(req.ip)) return codePage(res, req.body.ticket, "Too many wrong attempts. Please wait 15 minutes and try again.", 429);
      const how = checkCode(req.body.code);
      if (!how) { fail(req.ip); await logEvent(req, "Wrong code"); return codePage(res, req.body.ticket, "That code isn't right. Check the time on your phone is set automatically.", 401); }
      await finish(req, res, how === "backup" ? `Signed in with a backup code (${S.recovery.length} left)` : "Signed in");
      res.redirect(303, t.next);
    } catch (e) { next(e); }
  });
  router.post("/admin/login/setup", form, async (req, res, next) => {
    try {
      const t = unsign(req.body.ticket);
      if (!t || t.kind !== "setup") return loginPage(res, "That took too long. Please sign in again.", "/admin", 401);
      if (S.totp) return loginPage(res, "Sign-in codes are already set up. Please sign in again.", "/admin", 409);
      if (blocked(req.ip)) return setupPage(res, req.body.ticket, t.secret, "Too many wrong attempts. Please wait 15 minutes and try again.", 429);
      const code = String(req.body.code || "").replace(/\s+/g, "");
      const st = stepNow(), ok = [st - 1, st, st + 1].find((x) => /^\d{6}$/.test(code) && same(totp(t.secret, x), code));
      if (ok === undefined) { fail(req.ip); return setupPage(res, req.body.ticket, t.secret, "That code isn't right. Check the time on your phone is set automatically, and try the newest code.", 401); }
      const codes = newRecovery();
      Object.assign(S, { totp: t.secret, lastStep: ok, recovery: codes.map((c) => hash(c.replace(/-/g, ""))) });
      await finish(req, res, "Set up sign-in codes and signed in");
      send(res, "Backup codes", `<h1>Sign-in codes are on</h1><p>Here are your <b>backup codes</b>. Each one works once, instead of a phone code, if you lose your phone. <b>Print them or write them down now and keep them somewhere safe.</b> They won't be shown again.</p>
<div class="codes">${codes.map((c) => `<div>${c}</div>`).join("")}</div><p><a href="${esc(t.next)}"><button type="button">I've saved them: go to orders</button></a></p>`);
    } catch (e) { next(e); }
  });
  router.post("/admin/logout", (req, res) => { res.clearCookie(COOKIE, { path: "/" }); res.redirect(303, "/admin/login"); });

  // Everything else under /admin needs a signed-in browser.
  function requireAdmin(req, res, next) {
    if (req.path.startsWith("/admin/login") || req.path === "/admin/logout") return next();
    if (!password()) return res.status(503).type("text").send("The orders page is turned off. Add ADMIN_PASSWORD in Render's Environment settings to turn it on.");
    if (signedIn(req)) return next();
    if (req.method === "GET" && !req.path.endsWith(".json") && !req.path.endsWith(".dxf")) return res.redirect(303, "/admin/login?next=" + encodeURIComponent(req.originalUrl));
    res.status(401).type("text").send("Please sign in to the orders page first.");
  }

  /* ---------- /admin/security ---------- */
  function securityHtml() {
    return `<p><b>Sign-in codes:</b> on. Backup codes left: <b>${(S.recovery || []).length}</b>${(S.recovery || []).length < 4 ? ` <span class="bad">(running low: make new ones below)</span>` : ""}.</p>
<p class="m">Browsers stay signed in for ${SESSION_DAYS} days. A new device needs your password and a phone code. After ${LIMIT.perIp} wrong tries in 15 minutes, that visitor is locked out for 15 minutes.</p>
<h2>Recent sign-ins</h2><div class="wrap"><table><tr><th>When</th><th>What</th><th>Address</th><th>Browser</th></tr>${S.log.map((l) => `<tr><td class="n">${esc(new Date(l.at).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "short", timeStyle: "short" }))}</td><td${/Wrong/.test(l.what) ? ' class="bad"' : ""}>${esc(l.what)}</td><td class="n">${esc(l.ip)}</td><td class="m">${esc(l.ua.slice(0, 90))}</td></tr>`).join("") || '<tr><td colspan="4">None yet.</td></tr>'}</table></div>
<h2>If something looks wrong</h2>
<form method="post" action="/admin/security" class="f"><input type="hidden" name="do" value="everywhere"><button class="danger" onclick="return confirm('Sign out every browser, including this one?')">Sign out everywhere</button><span class="m">Then change ADMIN_PASSWORD in Render (Environment) if you think the password is known.</span></form>
<form method="post" action="/admin/security" class="f"><input type="hidden" name="do" value="codes"><label class="m">Code from your phone <input name="code" inputmode="numeric" size="8" required></label><button class="ghost">Make new backup codes</button></form>`;
  }
  async function securityPost(req) {
    if (req.body.do === "everywhere") { S.ver++; await logEvent(req, "Signed out everywhere"); return { out: true }; }
    if (req.body.do === "codes") {
      if (blocked(req.ip)) return { msg: `<p class="bad">Too many wrong attempts. Please wait 15 minutes.</p>` };
      if (checkCode(req.body.code) !== "app") { fail(req.ip); await save(); return { msg: `<p class="bad">That code isn't right. Use a code from your phone app.</p>` }; }
      const codes = newRecovery();
      S.recovery = codes.map((c) => hash(c.replace(/-/g, "")));
      await logEvent(req, "Made new backup codes");
      return { msg: `<p class="ok">New backup codes. Your old ones no longer work. <b>Print or write these down now</b>; they won't be shown again.</p><div style="font:15px ui-monospace,monospace;columns:2;background:#fff;padding:12px 16px;border:1px solid #DAD6CC;max-width:360px">${codes.map((c) => `<div>${c}</div>`).join("")}</div>` };
    }
    return { msg: "" };
  }

  return { load, router, requireAdmin, securityHtml, securityPost, COOKIE, totpForTests: (secret) => totp(secret, stepNow()) };
};
// For the tests: the current code for a secret.
module.exports.totpNow = (secret, t) => totp(secret, stepNow(t));
