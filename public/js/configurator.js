/* Pivot configurator page. All geometry, checks and prices come from PivotEngine. */
(function () {
  "use strict";
  const E = window.PivotEngine;
  const $ = (id) => document.getElementById(id);
  const gbp = (n) => "£" + n.toFixed(2);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // /test-designs: the test page, showing archived and draft designs. Nothing there can be ordered.
  const LAB = location.pathname.replace(/\/$/, "") === "/test-designs";
  const TEST = LAB || /[?&]test\b/.test(location.search);

  const state = { design: "shaker", width: 450, height: 700, opts: {}, hingeSide: "none", hingeCount: 2, hingeTouched: false, hingeTop: 100, hingeBottom: 100, hingeNotes: "", qty: 1, measures: false };
  for (const d of E.DESIGNS) { state.opts[d.id] = {}; for (const o of d.opts) state.opts[d.id][o.key] = o.def; }

  let list = [];
  // /configurator?admin: Tim creating an order for a customer (from /admin → New order).
  // It posts to the password-protected /admin/orders and sends the customer nothing.
  const ADMIN = new URLSearchParams(location.search).has("admin");
  // Pay online mode (switched on /admin/pricing; the server marks the page).
  // Tim's admin orders and the test page always work the old way.
  const CHECKOUT = document.body.dataset.mode === "checkout" && !ADMIN && !LAB;
  let wantQuote = false; // the customer chose "Ask for a quote instead"
  const LIST_KEY = LAB ? "pivot-door-list-lab" : ADMIN ? "pivot-door-list-admin" : "pivot-door-list";
  const offered = (d) => LAB || E.orderable(d);
  try { const saved = JSON.parse(localStorage.getItem(LIST_KEY) || "[]"); if (Array.isArray(saved)) list = saved.map((d) => E.normalizeDoor(d)).filter((r) => !Object.keys(r.errors).length && offered(E.designById(r.door.design))).map((r) => r.door); } catch (e) { list = []; }
  const saveList = () => { try { localStorage.setItem(LIST_KEY, JSON.stringify(list)); } catch (e) { /* private window */ } };

  const current = () => E.normalizeDoor({ design: state.design, width: state.width, height: state.height, opts: state.opts[state.design], hingeSide: state.hingeSide, hingeCount: state.hingeCount, hingeTop: state.hingeTop, hingeBottom: state.hingeBottom, hingeNotes: state.hingeNotes, qty: state.qty });

  /* ---------- design tiles ---------- */
  function renderDesigns() {
    // Archived designs stay in the engine (so old orders can be cut again) but aren't offered.
    $("designs").innerHTML = E.DESIGNS.filter(offered).map((d) => {
      const { door } = E.normalizeDoor({ design: d.id, width: 400, height: 600 });
      const tag = LAB ? (d.archived ? "Archived" : d.lab ? "Test only" : d.draft ? "Draft" : "") : "";
      return `<button type="button" class="dz" data-design="${d.id}" aria-pressed="${d.id === state.design}">${E.doorSVG(door)}<span>${esc(d.name)}</span>${tag ? `<em class="dz-tag">${tag}</em>` : ""}</button>`;
    }).join("");
  }

  /* ---------- options ---------- */
  function renderOpts() {
    const d = E.designById(state.design);
    const vals = state.opts[d.id];
    if (!d.opts.length) { $("opts").innerHTML = `<p class="none">${esc(d.name)} is a fixed design. The pattern is fitted to your sizes.</p>`; return; }
    $("opts").innerHTML = d.opts.map((o) => {
      const id = "opt-" + o.key;
      if (!E.optShown(o, vals)) return "";
      if (o.type === "choice") {
        return `<div class="opt"><span class="top">${esc(o.label)}</span><div class="seg" role="group" aria-label="${esc(o.label)}" data-opt="${o.key}">${o.choices.map((c) => `<button type="button" data-v="${c[0]}" aria-pressed="${vals[o.key] === c[0]}">${esc(c[1])}</button>`).join("")}</div>${o.help ? `<span class="hint">${esc(o.help)}</span>` : ""}</div>`;
      }
      if (o.type === "int") {
        const btns = []; for (let v = o.min; v <= o.max; v++) btns.push(`<button type="button" data-v="${v}" aria-pressed="${vals[o.key] === v}">${v}</button>`);
        return `<div class="opt"><span class="top">${esc(o.label)}</span><div class="seg" role="group" aria-label="${esc(o.label)}" data-opt="${o.key}" data-int="1">${btns.join("")}</div>${o.help ? `<span class="hint">${esc(o.help)}</span>` : ""}</div>`;
      }
      // A slider and a number box that update each other.
      return `<div class="opt"><div class="top"><label for="${id}">${esc(o.label)}</label><span class="numbox"><input type="number" id="${id}-num" data-opt="${o.key}" data-pair="${id}" inputmode="decimal" min="${o.min}" max="${o.max}" step="${o.step}" value="${vals[o.key]}" aria-label="${esc(o.label)} in mm"><span>mm</span></span></div>` +
        `<input type="range" id="${id}" data-opt="${o.key}" data-pair="${id}-num" min="${o.min}" max="${o.max}" step="${o.step}" value="${vals[o.key]}">${o.help ? `<span class="hint">${esc(o.help)}</span>` : ""}</div>`;
    }).join("");
  }

  /* ---------- live update ---------- */
  function update() {
    const { door, errors } = current();
    for (const k of ["width", "height"]) {
      $(k).setAttribute("aria-invalid", errors[k] ? "true" : "false");
      $(k + "Msg").textContent = errors[k] || `${E.LIMITS[k === "width" ? "wMin" : "hMin"]} to ${E.LIMITS[k === "width" ? "wMax" : "hMax"]} mm`;
      $(k + "Msg").className = errors[k] ? "hint bad" : "hint";
    }
    const HINGE_KEYS = ["hingeTop", "hingeBottom", "hingeCount"];
    const optErr = Object.keys(errors).filter((k) => !["width", "height", "geometry", "qty", ...HINGE_KEYS].includes(k)).map((k) => errors[k]);
    $("hingeMsg").textContent = HINGE_KEYS.map((k) => errors[k]).filter(Boolean).join(" ");
    $("geomMsg").textContent = errors.geometry || optErr.join(" ");
    let note = ""; try { note = !errors.geometry && door ? E.designNote(door) : ""; } catch (e) { note = ""; }
    $("designNote").textContent = note;
    const ok = !Object.keys(errors).length;
    $("addBtn").disabled = !ok;
    const d = E.designById(state.design);
    $("pvName").textContent = d.name;
    if (ok) {
      $("stage").innerHTML = E.doorSVG(door, { dims: true, measures: state.measures });
      const pair = E.doorParts(door).length > 1, info = E.buildDoor(door).info;
      $("pvInfo").textContent = (pair ? `Pair, each ${door.width} × ${door.height} mm` : `${door.width} × ${door.height} mm`) + (info ? " · " + info : "");
      const p = E.priceDoor(door);
      $("pvPrice").textContent = p ? gbp(p * door.qty) + (door.qty > 1 ? ` (${door.qty} × ${gbp(p)}${pair ? " a pair" : ""})` : "") : "";
    } else {
      $("pvInfo").textContent = "Check the sizes and options";
      $("pvPrice").textContent = "";
    }
    $("hingeFields").hidden = state.hingeSide === "none";
    $("pvNote").hidden = state.hingeSide === "none";
    // An arched pair has its hinges on the outer edges of both doors.
    const isPair = d.id === "arched" && state.opts.arched.layout === "pair";
    if (isPair && state.hingeSide === "right") state.hingeSide = "left";
    const hb = document.querySelectorAll("#hingeSide button");
    hb.forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === state.hingeSide));
    hb[1].textContent = isPair ? "Outer edges" : "Left";
    hb[2].hidden = isPair;
    $("hingeCount").value = String(state.hingeCount);
  }

  /* ---------- basket (the door list) ---------- */
  function renderList() {
    $("items").innerHTML = list.length ? list.map((door, i) => {
      const d = E.designById(door.design), p = E.priceDoor(door);
      const pair = E.doorParts(door).length > 1;
      return `<div class="item">${E.doorSVG(door)}<div><div class="t">${i + 1}. ${esc(door.name || d.name)}${pair ? " (pair)" : ""}</div><div class="s">${pair ? "Each " : ""}${door.width} × ${door.height} mm</div><div class="s">${esc(E.describe(door))}</div></div>` +
        `<div class="r"><span>${door.qty} × ${gbp(p)}</span><button type="button" class="linkbtn" data-remove="${i}">Remove</button></div></div>`;
    }).join("") : `<div class="empty">Your basket is empty. Design a door above and press Add to basket.</div>`;
    const t = E.priceOrder(list);
    $("sCount").textContent = t.count; $("sSub").textContent = gbp(t.sub); $("sShip").textContent = t.freeDelivery ? "Free" : gbp(t.ship); $("sTotal").textContent = gbp(t.total);
    $("sFree").textContent = !t.freeOver ? "" : t.freeDelivery ? "Your order qualifies for free delivery." : t.count ? `Add ${gbp(t.freeOver - t.sub)} more for free delivery.` : `Free delivery on orders over ${gbp(t.freeOver).replace(".00", "")}.`;
    $("sendBtn").disabled = !list.length;
    $("testDxf").hidden = !(TEST && list.length);
    // Contact and address details come after the door list is ready.
    $("continueBtn").disabled = !list.length;
    if (LAB || (!list.length && !$("sendMsg").classList.contains("ok"))) $("sendSection").hidden = true;
    $("continueBtn").hidden = $("continueHint").hidden = LAB || !$("sendSection").hidden;
    if (CHECKOUT) $("continueBtn").textContent = "Continue to checkout";
    updateIntent();
  }

  /* ---------- pay online, or send a quote request ---------- */
  // Addresses outside the delivery area (Northern Ireland, the islands, the Scottish
  // Highlands, the Isle of Wight) can't pay online; the server checks this too.
  const outsideArea = () => E.deliveryArea($("cPostcode").value);
  const payingNow = () => CHECKOUT && !wantQuote && !outsideArea();
  function updateIntent() {
    if (!CHECKOUT) return;
    const area = outsideArea(), t = E.priceOrder(list);
    $("areaMsg").hidden = !area;
    if (area) $("areaMsg").textContent = `We can't take payment online for delivery to ${area}. Send us a quote request and we'll email you a price that includes delivery.`;
    $("intentToggle").hidden = !!area;
    $("intentToggle").textContent = wantQuote ? "Pay online instead" : "Need something different? Ask for a quote instead";
    $("payHint").hidden = !payingNow();
    $("sendBtn").textContent = payingNow() ? `Continue to payment${list.length ? " (" + gbp(t.total) + ")" : ""}` : "Send quote request";
    $("sendH").textContent = payingNow() ? "Your details and delivery address" : "Send a quote request";
  }
  if (CHECKOUT) {
    $("intentToggle").addEventListener("click", () => { wantQuote = !wantQuote; updateIntent(); });
    for (const ev of ["input", "change", "blur"]) $("cPostcode").addEventListener(ev, updateIntent);
  }

  /* ---------- events ---------- */
  $("designs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-design]"); if (!b) return;
    state.design = b.dataset.design;
    document.querySelectorAll(".dz").forEach((x) => x.setAttribute("aria-pressed", x === b));
    renderOpts(); update(); renderGallery();
  });
  $("opts").addEventListener("input", (e) => {
    const t = e.target; if (!t.dataset.opt) return;
    if (t.value === "") return; // let the customer clear the box while typing
    state.opts[state.design][t.dataset.opt] = Number(t.value);
    const other = t.dataset.pair && $(t.dataset.pair); if (other) other.value = t.value;
    update();
  });
  $("opts").addEventListener("click", (e) => {
    const b = e.target.closest("[data-v]"); if (!b) return;
    const g = b.closest("[data-opt]");
    state.opts[state.design][g.dataset.opt] = g.dataset.int ? Number(b.dataset.v) : b.dataset.v;
    g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    renderOpts(); update(); // options can show or hide others (e.g. the gap for a pair)
  });
  for (const k of ["width", "height"]) $(k).addEventListener("input", (e) => {
    state[k] = Number(e.target.value);
    if (k === "height" && !state.hingeTouched && Number.isFinite(state.height)) state.hingeCount = E.hingeDefault(state.height);
    update();
  });
  $("hingeSide").addEventListener("click", (e) => { const b = e.target.closest("[data-v]"); if (!b) return; state.hingeSide = b.dataset.v; update(); });
  $("hingeCount").addEventListener("change", (e) => { state.hingeCount = Number(e.target.value); state.hingeTouched = true; update(); });
  $("hingeTop").addEventListener("input", (e) => { state.hingeTop = e.target.value; update(); });
  $("hingeBottom").addEventListener("input", (e) => { state.hingeBottom = e.target.value; update(); });
  $("hingeNotes").addEventListener("input", (e) => { state.hingeNotes = e.target.value; });
  $("measures").addEventListener("change", (e) => { state.measures = e.target.checked; update(); });
  $("qty").addEventListener("input", (e) => { state.qty = Number(e.target.value) || 1; update(); });

  $("doorForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const { door, errors } = current();
    if (Object.keys(errors).length) return;
    list.push(door); saveList(); renderList();
    $("addMsg").textContent = `Added ${door.qty} × ${E.designById(door.design).name}. Change the sizes to add another, or continue below when your basket is complete.`;
  });
  $("continueBtn").addEventListener("click", () => {
    $("sendSection").hidden = false; renderList();
    $("sendSection").scrollIntoView({ behavior: "smooth", block: "start" });
    $("cName").focus({ preventScroll: true });
  });
  $("items").addEventListener("click", (e) => {
    const b = e.target.closest("[data-remove]"); if (!b) return;
    list.splice(Number(b.dataset.remove), 1); saveList(); renderList();
  });

  $("testDxf").addEventListener("click", () => {
    const blob = new Blob([E.orderDXF({ ref: "TEST", doors: list })], { type: "application/dxf" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "pivot-test-order.dxf";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  $("orderForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("sendMsg");
    const customer = { name: $("cName").value.trim(), email: $("cEmail").value.trim(), phone: $("cPhone").value.trim(), line1: $("cLine1").value.trim(), line2: $("cLine2").value.trim(), town: $("cTown").value.trim(), postcode: $("cPostcode").value.trim(), notes: $("cNotes").value.trim(), website: $("cWebsite").value };
    const missing = [];
    if (customer.name.length < 2) missing.push("your name");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email)) missing.push("a valid email");
    if (!customer.line1) missing.push("the first line of your address");
    if (!customer.town) missing.push("your town or city");
    if (!customer.postcode) missing.push("your postcode");
    if (missing.length) { msg.className = "send-msg bad"; msg.textContent = "Please add " + missing.join(", ") + "."; return; }
    if (!list.length) { msg.className = "send-msg bad"; msg.textContent = "Add at least one door to your basket first."; return; }
    $("sendBtn").disabled = true; msg.className = "send-msg"; msg.textContent = "Sending…";
    try {
      const paying = payingNow();
      const r = await fetch(ADMIN ? "/admin/orders" : "/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer, doors: list, intent: paying ? "pay" : "quote" }) });
      if (ADMIN && (r.status === 401 || r.status === 403)) throw new Error("You're not signed in to the orders page. Open /admin in this browser, sign in, then try again.");
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Something went wrong. Please try again, or email tim@pivotdesigns.co.uk.");
      if (ADMIN) { list = []; saveList(); location.href = "/admin?created=" + encodeURIComponent(data.ref) + "#" + encodeURIComponent(data.ref); return; }
      if (data.payUrl) {
        msg.className = "send-msg ok"; msg.textContent = "Taking you to our secure payment page…";
        location.href = data.payUrl; return;
      }
      msg.className = "send-msg ok";
      msg.textContent = `Thank you. Your ${CHECKOUT ? "quote" : "order"} request ${data.ref} has been sent. We'll email you to confirm the price and lead time, with a link to pay securely online.`;
      list = []; saveList(); renderList();
    } catch (err) {
      msg.className = "send-msg bad"; msg.textContent = err.message;
      $("sendBtn").disabled = false;
    }
  });

  if (LAB) {
    document.title = "Test designs | Pivot Designs";
    document.querySelector(".cfg-head h1").textContent = "Test designs";
    document.querySelector(".cfg-head .lede").textContent = "Archived and draft designs for fine-tuning before they go live. Use Download test DXF to try them in VCarve.";
    const bar = document.createElement("div");
    bar.className = "testbar"; bar.innerHTML = '<div class="inner">Test page. Not linked from the site, and these designs can\'t be ordered.</div>';
    document.querySelector(".site-head").after(bar);
    const cur = document.querySelector('.nav [aria-current="page"]'); if (cur) cur.removeAttribute("aria-current");
  }

  /* ---------- example photos and illustrations (public/data/design-images.json) ---------- */
  // Small thumbnails under the drawing; tapping one opens a pop-up with the full photo.
  // Each photo can name a "thumb"; otherwise "-thumb.jpg" is tried, then the photo itself.
  let images = {}, lbIndex = 0;
  const picsFor = () => images[state.design] || [];
  const thumbOf = (pic) => pic.thumb || pic.src.replace(/\.jpg$/i, "-thumb.jpg");
  function renderGallery() {
    const pics = picsFor();
    $("gallery").hidden = !pics.length;
    $("gThumbs").innerHTML = pics.map((pic, i) => `<button type="button" class="thumb" data-i="${i}" aria-label="Open photo ${i + 1} of ${pics.length}: ${esc(pic.caption || pic.alt || "")}"><img src="${esc(thumbOf(pic))}" data-full="${esc(pic.src)}" alt="" loading="lazy" width="80" height="80">${pic.illustration ? '<span class="thumb-tag">Illustration</span>' : ""}</button>`).join("");
    $("gThumbs").querySelectorAll("img").forEach((im) => im.addEventListener("error", () => { if (im.src.indexOf(im.dataset.full) < 0) im.src = im.dataset.full; }, { once: true }));
  }
  function showPhoto(i) {
    const pics = picsFor(); if (!pics.length) return;
    lbIndex = (i + pics.length) % pics.length;
    const pic = pics[lbIndex];
    $("lbImg").src = pic.src; $("lbImg").alt = pic.alt || pic.caption || E.designById(state.design).name;
    $("lbCap").textContent = pic.caption || "";
    $("lbTag").hidden = !pic.illustration;
    $("lbCount").textContent = pics.length > 1 ? `${lbIndex + 1} of ${pics.length}` : "";
    $("lbPrev").hidden = $("lbNext").hidden = pics.length < 2;
  }
  const lb = $("lightbox");
  $("gThumbs").addEventListener("click", (e) => {
    const t = e.target.closest("[data-i]"); if (!t) return;
    showPhoto(Number(t.dataset.i));
    if (lb.showModal) lb.showModal(); else lb.setAttribute("open", "");
  });
  const closeLb = () => (lb.close ? lb.close() : lb.removeAttribute("open"));
  $("lbClose").addEventListener("click", closeLb);
  $("lbPrev").addEventListener("click", () => showPhoto(lbIndex - 1));
  $("lbNext").addEventListener("click", () => showPhoto(lbIndex + 1));
  lb.addEventListener("click", (e) => { if (e.target === lb) closeLb(); }); // a tap outside the photo closes it
  lb.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") showPhoto(lbIndex - 1); if (e.key === "ArrowRight") showPhoto(lbIndex + 1); });
  fetch("/data/design-images.json", { cache: "no-cache" }).then((r) => r.ok ? r.json() : {}).then((d) => { images = d && typeof d === "object" ? d : {}; renderGallery(); }).catch(() => {});

  if (ADMIN) {
    const bar = document.createElement("div");
    bar.className = "admin-bar";
    bar.innerHTML = '<b>Creating an order for a customer.</b> Enter their doors and details, then press Create order. It goes straight to your orders page as a new request, and the customer is <b>not</b> emailed. <a href="/admin">Back to orders</a>';
    document.querySelector("main").prepend(bar);
    $("sendH").textContent = "Customer details";
    $("sendBtn").textContent = "Create order";
  }

  /* ---------- address search (Ideal Postcodes, through our server) ---------- */
  (function addressSearch() {
    const box = $("addrSearch"), ul = $("addrList"), hint = $("addrHint");
    let hits = [], active = -1, timer = 0, seq = 0;
    const close = () => { ul.hidden = true; box.setAttribute("aria-expanded", "false"); active = -1; };
    const off = (msg) => { close(); if (msg) hint.textContent = msg; };
    function show() {
      ul.innerHTML = hits.map((h, i) => `<li role="option" id="addr${i}" data-i="${i}" aria-selected="${i === active}">${esc(h.text)}</li>`).join("");
      ul.hidden = !hits.length; box.setAttribute("aria-expanded", String(!!hits.length));
      if (active >= 0) box.setAttribute("aria-activedescendant", "addr" + active); else box.removeAttribute("aria-activedescendant");
    }
    async function search() {
      const q = box.value.trim(), mine = ++seq;
      if (q.length < 3) { hits = []; return show(); }
      try {
        const r = await fetch("/api/address/suggest?q=" + encodeURIComponent(q));
        const data = await r.json().catch(() => ({}));
        if (mine !== seq) return;
        if (!r.ok) return off(data.error);
        hits = data.hits || []; active = -1; show();
        hint.textContent = hits.length ? "Pick your address from the list, or type it in below." : "No matches yet. Keep typing, or type your address in below.";
      } catch (e) { off("Address search isn't working right now. Please type your address in below."); }
    }
    async function pick(i) {
      const h = hits[i]; if (!h) return;
      close(); box.value = h.text; hint.textContent = "Filling in your address…";
      try {
        const r = await fetch("/api/address/resolve?id=" + encodeURIComponent(h.id));
        const a = await r.json().catch(() => ({}));
        if (!r.ok) return off(a.error);
        $("cLine1").value = a.line1 || ""; $("cLine2").value = a.line2 || ""; $("cTown").value = a.town || ""; $("cPostcode").value = a.postcode || ""; updateIntent();
        hint.textContent = "Done. Check the address below and change anything that's not right.";
      } catch (e) { off("We couldn't fetch that address. Please type it in below."); }
    }
    box.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(search, 250); });
    box.addEventListener("keydown", (e) => {
      if (ul.hidden) return;
      if (e.key === "ArrowDown") { active = Math.min(hits.length - 1, active + 1); show(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { active = Math.max(0, active - 1); show(); e.preventDefault(); }
      else if (e.key === "Enter" && active >= 0) { pick(active); e.preventDefault(); }
      else if (e.key === "Escape") close();
    });
    ul.addEventListener("mousedown", (e) => { const li = e.target.closest("[data-i]"); if (li) { e.preventDefault(); pick(Number(li.dataset.i)); } });
    box.addEventListener("blur", () => setTimeout(close, 150));
    // Only show the search box when the lookup is switched on.
    fetch("/api/address/status").then((r) => r.json()).then((d) => { if (d.enabled) $("addrFind").hidden = false; }).catch(() => {});
  })();

  renderDesigns(); renderOpts(); update(); renderList();
  // Prices are set on /admin/pricing; redraw once the current ones arrive.
  fetch("/api/pricing", { cache: "no-cache" }).then((r) => r.ok ? r.json() : null).then((p) => { if (p) { E.setPricing(p); update(); renderList(); } }).catch(() => {});
})();
