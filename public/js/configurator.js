/* Pivot configurator page. All geometry, checks and prices come from PivotEngine. */
(function () {
  "use strict";
  const E = window.PivotEngine;
  const $ = (id) => document.getElementById(id);
  const gbp = (n) => "£" + n.toFixed(2);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TEST = /[?&]test\b/.test(location.search);

  const state = { design: "shaker", width: 450, height: 700, opts: {}, hingeSide: "left", hingeCount: 2, hingeTouched: false, name: "", qty: 1 };
  for (const d of E.DESIGNS) { state.opts[d.id] = {}; for (const o of d.opts) state.opts[d.id][o.key] = o.def; }

  let list = [];
  try { const saved = JSON.parse(localStorage.getItem("pivot-door-list") || "[]"); if (Array.isArray(saved)) list = saved.map((d) => E.normalizeDoor(d)).filter((r) => !Object.keys(r.errors).length).map((r) => r.door); } catch (e) { list = []; }
  const saveList = () => { try { localStorage.setItem("pivot-door-list", JSON.stringify(list)); } catch (e) { /* private window */ } };

  const current = () => E.normalizeDoor({ design: state.design, width: state.width, height: state.height, opts: state.opts[state.design], hingeSide: state.hingeSide, hingeCount: state.hingeCount, name: state.name, qty: state.qty });

  /* ---------- design tiles ---------- */
  function renderDesigns() {
    $("designs").innerHTML = E.DESIGNS.map((d) => {
      const { door } = E.normalizeDoor({ design: d.id, width: 400, height: 600 });
      return `<button type="button" class="dz" data-design="${d.id}" aria-pressed="${d.id === state.design}">${E.doorSVG(door)}<span>${esc(d.name)}</span></button>`;
    }).join("");
  }

  /* ---------- options ---------- */
  function renderOpts() {
    const d = E.designById(state.design);
    const vals = state.opts[d.id];
    if (!d.opts.length) { $("opts").innerHTML = `<p class="none">${esc(d.name)} is a fixed design. The pattern is fitted to your sizes.</p>`; return; }
    $("opts").innerHTML = d.opts.map((o) => {
      const id = "opt-" + o.key;
      if (o.type === "choice") {
        return `<div class="opt"><span class="top">${esc(o.label)}</span><div class="seg" role="group" aria-label="${esc(o.label)}" data-opt="${o.key}">${o.choices.map((c) => `<button type="button" data-v="${c[0]}" aria-pressed="${vals[o.key] === c[0]}">${esc(c[1])}</button>`).join("")}</div>${o.help ? `<span class="hint">${esc(o.help)}</span>` : ""}</div>`;
      }
      if (o.type === "int") {
        const btns = []; for (let v = o.min; v <= o.max; v++) btns.push(`<button type="button" data-v="${v}" aria-pressed="${vals[o.key] === v}">${v}</button>`);
        return `<div class="opt"><span class="top">${esc(o.label)}</span><div class="seg" role="group" aria-label="${esc(o.label)}" data-opt="${o.key}" data-int="1">${btns.join("")}</div>${o.help ? `<span class="hint">${esc(o.help)}</span>` : ""}</div>`;
      }
      return `<div class="opt"><label class="top" for="${id}">${esc(o.label)} <output id="${id}-out">${vals[o.key]} mm</output></label><input type="range" id="${id}" data-opt="${o.key}" min="${o.min}" max="${o.max}" step="${o.step}" value="${vals[o.key]}">${o.help ? `<span class="hint">${esc(o.help)}</span>` : ""}</div>`;
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
    const optErr = Object.keys(errors).filter((k) => !["width", "height", "geometry", "qty"].includes(k)).map((k) => errors[k]);
    $("geomMsg").textContent = errors.geometry || optErr.join(" ");
    const ok = !Object.keys(errors).length;
    $("addBtn").disabled = !ok;
    const d = E.designById(state.design);
    $("pvName").textContent = d.name;
    if (ok) {
      $("stage").innerHTML = E.doorSVG(door, { dims: true });
      $("pvInfo").textContent = `${door.width} × ${door.height} mm` + (E.buildDoor(door).info ? " · " + E.buildDoor(door).info : "");
      const p = E.priceDoor(door);
      $("pvPrice").textContent = p ? gbp(p * door.qty) + (door.qty > 1 ? ` (${door.qty} × ${gbp(p)})` : "") : "";
    } else {
      $("pvInfo").textContent = "Check the sizes and options";
      $("pvPrice").textContent = "";
    }
    $("hingeCountField").hidden = state.hingeSide === "none";
    document.querySelectorAll("#hingeSide button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === state.hingeSide));
    $("hingeCount").value = String(state.hingeCount);
  }

  /* ---------- door list ---------- */
  function renderList() {
    $("items").innerHTML = list.length ? list.map((door, i) => {
      const d = E.designById(door.design), p = E.priceDoor(door);
      return `<div class="item">${E.doorSVG(door)}<div><div class="t">${i + 1}. ${esc(door.name || d.name)}</div><div class="s">${esc(d.name)} · ${door.width} × ${door.height} mm</div><div class="s">${esc(E.describe(door))}</div></div>` +
        `<div class="r"><span>${door.qty} × ${gbp(p)}</span><button type="button" class="linkbtn" data-remove="${i}">Remove</button></div></div>`;
    }).join("") : `<div class="empty">No doors yet. Design one above and press Add to door list.</div>`;
    const t = E.priceOrder(list);
    $("sCount").textContent = t.count; $("sSub").textContent = gbp(t.sub); $("sShip").textContent = gbp(t.ship); $("sTotal").textContent = gbp(t.total);
    $("sendBtn").disabled = !list.length;
    $("testDxf").hidden = !(TEST && list.length);
  }

  /* ---------- events ---------- */
  $("designs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-design]"); if (!b) return;
    state.design = b.dataset.design;
    document.querySelectorAll(".dz").forEach((x) => x.setAttribute("aria-pressed", x === b));
    renderOpts(); update();
  });
  $("opts").addEventListener("input", (e) => {
    const t = e.target; if (!t.dataset.opt) return;
    state.opts[state.design][t.dataset.opt] = Number(t.value);
    const out = $(t.id + "-out"); if (out) out.textContent = t.value + " mm";
    update();
  });
  $("opts").addEventListener("click", (e) => {
    const b = e.target.closest("[data-v]"); if (!b) return;
    const g = b.closest("[data-opt]");
    state.opts[state.design][g.dataset.opt] = g.dataset.int ? Number(b.dataset.v) : b.dataset.v;
    g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    update();
  });
  for (const k of ["width", "height"]) $(k).addEventListener("input", (e) => {
    state[k] = Number(e.target.value);
    if (k === "height" && !state.hingeTouched && Number.isFinite(state.height)) state.hingeCount = E.hingeDefault(state.height);
    update();
  });
  $("hingeSide").addEventListener("click", (e) => { const b = e.target.closest("[data-v]"); if (!b) return; state.hingeSide = b.dataset.v; update(); });
  $("hingeCount").addEventListener("change", (e) => { state.hingeCount = Number(e.target.value); state.hingeTouched = true; update(); });
  $("doorName").addEventListener("input", (e) => { state.name = e.target.value; });
  $("qty").addEventListener("input", (e) => { state.qty = Number(e.target.value) || 1; update(); });

  $("doorForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const { door, errors } = current();
    if (Object.keys(errors).length) return;
    list.push(door); saveList(); renderList();
    $("addMsg").textContent = `Added ${door.qty} × ${E.designById(door.design).name}. Change the sizes to add another.`;
    state.name = ""; $("doorName").value = "";
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
    const customer = { name: $("cName").value.trim(), email: $("cEmail").value.trim(), phone: $("cPhone").value.trim(), postcode: $("cPostcode").value.trim(), address: $("cAddress").value.trim(), notes: $("cNotes").value.trim(), website: $("cWebsite").value };
    const missing = [];
    if (customer.name.length < 2) missing.push("your name");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email)) missing.push("a valid email");
    if (!customer.postcode) missing.push("your postcode");
    if (!customer.address) missing.push("your address");
    if (missing.length) { msg.className = "send-msg bad"; msg.textContent = "Please add " + missing.join(", ") + "."; return; }
    if (!list.length) { msg.className = "send-msg bad"; msg.textContent = "Add at least one door to your list first."; return; }
    $("sendBtn").disabled = true; msg.className = "send-msg"; msg.textContent = "Sending…";
    try {
      const r = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer, doors: list }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Something went wrong. Please try again, or email tim@pivotdesigns.co.uk.");
      msg.className = "send-msg ok";
      msg.textContent = `Thank you. Your order request ${data.ref} has been sent. We'll email you to confirm the price and lead time.`;
      list = []; saveList(); renderList();
    } catch (err) {
      msg.className = "send-msg bad"; msg.textContent = err.message;
      $("sendBtn").disabled = false;
    }
  });

  renderDesigns(); renderOpts(); update(); renderList();
})();
