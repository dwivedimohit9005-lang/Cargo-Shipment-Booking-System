// @ts-nocheck
// ---------- Cities (latitude, longitude) ----------
const CITIES = {
  "Delhi": [28.61, 77.21], "Mumbai": [19.08, 72.88], "Kolkata": [22.57, 88.36], "Chennai": [13.08, 80.27],
  "Bengaluru": [12.97, 77.59], "Hyderabad": [17.38, 78.48], "Ahmedabad": [23.02, 72.57], "Pune": [18.52, 73.86],
  "Jaipur": [26.91, 75.79], "Lucknow": [26.85, 80.95], "Chandigarh": [30.73, 76.78], "Ludhiana": [30.90, 75.86],
  "Amritsar": [31.63, 74.87], "Jalandhar": [31.33, 75.58], "Kochi": [9.93, 76.27], "Nagpur": [21.15, 79.09],
  "Indore": [22.72, 75.86], "Surat": [21.17, 72.83], "Guwahati": [26.14, 91.74],
  "Dubai": [25.20, 55.27], "Singapore": [1.35, 103.82], "London": [51.51, -0.13], "New York": [40.71, -74.01]
};
const INTL = ["Dubai", "Singapore", "London", "New York"];
const ROUTE_FACTOR = { Road: 1.25, Rail: 1.2, Air: 1.05, Sea: 1.15 }; // straight line -> real route

// ---------- Default tariff (admin can edit) ----------
const DEFAULT_RATES = {
  road: 0.60, rail: 0.35, air: 1.80, sea: 0.25,      // Rs per kg per 100 km
  minCharge: 250, pickupFee: 150,
  fuelPct: 12, peakPct: 8, expressPct: 10, gstPct: 18, volDivisor: 5000,
  fragile: 10, perishable: 15, hazardous: 25, machinery: 12
};
const RATE_FIELDS = [
  ["road", "Road rate (₹/kg per 100 km)"], ["rail", "Rail rate (₹/kg per 100 km)"],
  ["air", "Air rate (₹/kg per 100 km)"], ["sea", "Sea rate (₹/kg per 100 km)"],
  ["minCharge", "Minimum freight (₹)"], ["pickupFee", "Pickup fee (₹)"],
  ["fuelPct", "Fuel surcharge (%)"], ["peakPct", "Peak season Oct–Dec (%)"],
  ["expressPct", "Express pickup within 2 days (%)"], ["gstPct", "GST (%)"],
  ["volDivisor", "Volumetric divisor (cm³ per kg)"],
  ["fragile", "Fragile handling (%)"], ["perishable", "Perishable handling (%)"],
  ["hazardous", "Hazardous handling (%)"], ["machinery", "Machinery handling (%)"]
];
const HANDLING_NOTE = {
  General: "Standard handling.",
  Fragile: "Fragile: padded loading and 'this side up' labelling required.",
  Perishable: "Perishable: temperature-controlled space and priority dispatch.",
  Hazardous: "Hazardous: safety documents and licensed carrier required.",
  Machinery: "Machinery: forklift or crane loading required."
};
const STATUSES = ["Pending", "Confirmed", "Picked up", "In transit", "Delivered", "Cancelled"];
const FLOW = ["Pending", "Confirmed", "Picked up", "In transit", "Delivered"];

// ---------- Storage ----------
const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch (e) { return d; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
let rates = { ...DEFAULT_RATES, ...read("cargoRates", {}) };
let bookings = read("cargoBookings", []);
let users = read("cargoUsers", []);
let me = null;
const saveBookings = () => write("cargoBookings", bookings);

// ---------- Helpers ----------
const $ = (s) => document.querySelector(s);
const money = (n) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const form = $("#form");
const val = (n) => form.elements[n].value.trim();
const isAdmin = () => me && me.role === "admin";
const visible = () => (isAdmin() ? bookings : bookings.filter((b) => b.owner === me.email));

// ---------- Password hashing ----------
async function hash(pw, salt) {
  const text = salt + pw;
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 5381; // fallback for very old browsers
  for (const c of text) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return "f" + h.toString(16);
}
const newSalt = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// ---------- Auth screens ----------
document.querySelectorAll(".atab").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".atab").forEach((x) => x.classList.toggle("active", x === b));
  $("#loginForm").classList.toggle("hidden", b.dataset.a !== "login");
  $("#signupForm").classList.toggle("hidden", b.dataset.a !== "signup");
}));

$("#signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target.elements, err = $("#signupErr");
  const name = f.name.value.trim(), email = f.email.value.trim().toLowerCase(), phone = f.phone.value.trim();
  const pw = f.password.value, errs = [];
  if (name.length < 2) errs.push("Enter your full name.");
  if (!/^\S+@\S+\.\S+$/.test(email)) errs.push("Enter a valid email address.");
  if (!/^\d{10}$/.test(phone)) errs.push("Phone number must be exactly 10 digits.");
  if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) errs.push("Password needs 8+ characters with letters and numbers.");
  if (pw !== f.confirm.value) errs.push("Passwords do not match.");
  if (users.some((u) => u.email === email)) errs.push("An account with this email already exists.");
  if (errs.length) { err.innerHTML = errs.map((x) => `<p>• ${esc(x)}</p>`).join(""); return; }
  const salt = newSalt();
  const user = { name, email, phone, role: "customer", salt, hash: await hash(pw, salt) };
  users.push(user); write("cargoUsers", users);
  sessionStorage.setItem("cargoSession", email);
  e.target.reset(); err.innerHTML = "";
  startApp(user);
});

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target.elements, err = $("#loginErr");
  const email = f.email.value.trim().toLowerCase();
  const lk = read("cargoLock", { n: 0, until: 0 });
  if (Date.now() < lk.until) {
    err.textContent = "Too many attempts. Try again in " + Math.ceil((lk.until - Date.now()) / 1000) + " seconds.";
    return;
  }
  const u = users.find((x) => x.email === email);
  if (u && (await hash(f.password.value, u.salt)) === u.hash) {
    write("cargoLock", { n: 0, until: 0 });
    err.textContent = "";
    e.target.reset();
    sessionStorage.setItem("cargoSession", email);
    startApp(u);
  } else {
    lk.n++;
    if (lk.n >= 5) { lk.until = Date.now() + 60000; lk.n = 0; }
    write("cargoLock", lk);
    err.textContent = "Incorrect email or password.";
  }
});

$("#logout").addEventListener("click", () => {
  sessionStorage.removeItem("cargoSession");
  me = null;
  $("#app").classList.add("hidden");
  $("#auth").classList.remove("hidden");
});

function startApp(user) {
  me = user;
  $("#auth").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#who").textContent = `${me.name} (${me.role})`;
  document.querySelectorAll(".admin-only").forEach((el) => el.classList.toggle("hidden", !isAdmin()));
  $("#manageTab").textContent = isAdmin() ? "Manage bookings" : "My bookings";
  $("#manageTitle").textContent = $("#manageTab").textContent;
  $("#trackResult").innerHTML = "";
  prefill();
  showView("book");
  renderQuote();
}

function prefill() {
  form.reset();
  form.elements.name.value = me.name;
  form.elements.email.value = me.email;
  form.elements.phone.value = me.phone;
}

// ---------- Navigation ----------
function showView(name) {
  if (name === "rates" && !isAdmin()) name = "book";
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === name));
  if (name === "manage") renderManage();
  if (name === "rates") renderRates();
}
document.querySelectorAll(".tab").forEach((btn) => btn.addEventListener("click", () => showView(btn.dataset.view)));

// ---------- Route and quotation ----------
const findCity = (n) => Object.keys(CITIES).find((c) => c.toLowerCase() === n.trim().toLowerCase());

function km(a, b) {
  const toR = (d) => (d * Math.PI) / 180;
  const [la1, lo1] = CITIES[a], [la2, lo2] = CITIES[b];
  const dl = toR(la2 - la1), dn = toR(lo2 - lo1);
  const x = Math.sin(dl / 2) ** 2 + Math.cos(toR(la1)) * Math.cos(toR(la2)) * Math.sin(dn / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}

function routeInfo() {
  const from = findCity(val("from")), to = findCity(val("to")), mode = val("service");
  if (!from || !to) return { error: "Choose pickup and destination from the city list." };
  if (from === to) return { error: "Pickup and destination cannot be the same city." };
  const intl = INTL.includes(from) || INTL.includes(to);
  if (intl && (mode === "Road" || mode === "Rail")) return { error: "International shipments are only possible by Air or Sea." };
  if (!intl && mode === "Sea") return { error: "Sea freight is only available for international routes." };
  return { from, to, mode, dist: km(from, to) * ROUTE_FACTOR[mode] };
}

function calcQuote() {
  const qty = +val("qty") || 0, l = +val("l") || 0, w = +val("w") || 0, h = +val("h") || 0;
  const actual = +val("weight") || 0;
  const vol = (l * w * h * qty) / rates.volDivisor;
  const chargeable = Math.max(actual, vol);
  const r = routeInfo();
  const dist = r.error ? 0 : r.dist;
  const rate = rates[val("service").toLowerCase()];
  const freight = r.error || !chargeable ? 0 : Math.max(rates.minCharge, chargeable * (dist / 100) * rate);
  const handling = (freight * (rates[val("type").toLowerCase()] || 0)) / 100;
  const fuel = (freight * rates.fuelPct) / 100;
  let peak = 0, express = 0;
  const d = val("date");
  if (d && freight) {
    if (new Date(d).getUTCMonth() >= 9) peak = (freight * rates.peakPct) / 100;
    if ((new Date(d) - new Date(today())) / 864e5 <= 2) express = (freight * rates.expressPct) / 100;
  }
  const pickup = freight ? rates.pickupFee : 0;
  const sub = freight + handling + fuel + peak + express + pickup;
  const gst = (sub * rates.gstPct) / 100;
  return { r, dist, vol, actual, chargeable, freight, handling, fuel, peak, express, pickup, gst, total: sub + gst };
}

function renderQuote() {
  if (!me) return;
  const q = calcQuote();
  const row = (k, v, c = "") => `<div class="row ${c}"><dt>${k}</dt><dd>${v}</dd></div>`;
  $("#quote").innerHTML =
    row("Distance", q.dist ? Math.round(q.dist) + " km" : "–") +
    row("Chargeable weight", q.chargeable.toFixed(1) + " kg") +
    row("Freight", money(q.freight)) +
    row("Pickup fee", money(q.pickup)) +
    row("Handling", money(q.handling)) +
    row(`Fuel (${rates.fuelPct}%)`, money(q.fuel)) +
    (q.peak ? row("Peak season", money(q.peak)) : "") +
    (q.express ? row("Express pickup", money(q.express)) : "") +
    row(`GST (${rates.gstPct}%)`, money(q.gst)) +
    row("Total", money(q.total), "total");
  $("#handling").textContent = q.r.error ? q.r.error : HANDLING_NOTE[val("type")];
}
form.addEventListener("input", renderQuote);

// ---------- Validation and booking ----------
function validate() {
  const errs = [];
  form.querySelectorAll("input").forEach((i) => i.classList.remove("bad"));
  const bad = (n, msg) => { errs.push(msg); form.elements[n].classList.add("bad"); };

  if (val("name").length < 2) bad("name", "Enter the customer's full name.");
  if (!/^\S+@\S+\.\S+$/.test(val("email"))) bad("email", "Enter a valid email address.");
  if (!/^\d{10}$/.test(val("phone"))) bad("phone", "Phone number must be exactly 10 digits.");
  if (!val("desc")) bad("desc", "Describe the cargo.");
  ["qty", "l", "w", "h", "weight"].forEach((n) => { if (!(+val(n) > 0)) bad(n, "Enter a value greater than 0 for " + n.toUpperCase() + "."); });
  const r = routeInfo();
  if (r.error) bad("from", r.error);
  if (!val("date") || val("date") < today()) bad("date", "Choose a pickup date that is today or later.");
  $("#errors").innerHTML = errs.map((e) => `<p>• ${esc(e)}</p>`).join("");
  return errs.length === 0;
}

const nextId = () => "CB-" + (Math.max(1000, ...bookings.map((b) => parseInt(b.id.slice(3), 10) || 0)) + 1);

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!me) return;
  if (!validate()) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
  const q = calcQuote();
  const id = nextId();
  bookings.push({
    id, owner: me.email, status: "Pending", created: new Date().toLocaleString(),
    name: val("name"), company: val("company"), email: val("email"), phone: val("phone"),
    desc: val("desc"), type: val("type"), qty: +val("qty"),
    dims: `${val("l")}×${val("w")}×${val("h")} cm`, weight: +val("weight"),
    from: q.r.from, to: q.r.to, zone: INTL.includes(q.r.from) || INTL.includes(q.r.to) ? "International" : "Domestic",
    service: val("service"), date: val("date"), dist: Math.round(q.dist),
    chargeable: q.chargeable, total: q.total
  });
  saveBookings();
  alert(`Booking confirmed!\nYour booking ID is ${id}.\nTotal quotation: ${money(q.total)}`);
  prefill(); renderQuote();
});

// ---------- Manage / My bookings ----------
function renderManage() {
  const filter = $("#filter");
  if (!filter.options.length) {
    filter.innerHTML = `<option value="">All statuses</option>` + STATUSES.map((s) => `<option>${s}</option>`).join("");
  }
  const mine = visible();
  $("#stats").innerHTML =
    `<div class="stat"><b>${mine.length}</b>Total</div>` +
    STATUSES.map((s) => `<div class="stat"><b>${mine.filter((b) => b.status === s).length}</b>${s}</div>`).join("") +
    `<div class="stat"><b>${money(mine.filter((b) => b.status !== "Cancelled").reduce((a, b) => a + b.total, 0))}</b>${isAdmin() ? "Revenue" : "Spent"}</div>`;

  const term = $("#search").value.toLowerCase();
  const list = mine.filter((b) =>
    (!filter.value || b.status === filter.value) &&
    (b.id + b.name + b.to + b.from).toLowerCase().includes(term));

  $("#empty").style.display = list.length ? "none" : "block";
  $("#rows").innerHTML = list.map((b) => `
    <tr>
      <td><b>${esc(b.id)}</b><br><small>${esc(b.date)}</small></td>
      <td>${esc(b.name)}<br><small>${esc(b.phone)}</small></td>
      <td>${esc(b.from)} → ${esc(b.to)}<br><small>${esc(b.service)} · ${esc(b.zone)}${b.dist ? " · " + b.dist + " km" : ""}</small></td>
      <td>${esc(b.desc)}<br><small>${esc(b.type)} · ${b.qty} pkg · ${esc(b.dims)} · ${b.weight} kg</small></td>
      <td>${money(b.total)}</td>
      <td>${isAdmin()
        ? `<select data-id="${esc(b.id)}" class="status">${STATUSES.map((s) => `<option ${s === b.status ? "selected" : ""}>${s}</option>`).join("")}</select>`
        : `<span class="badge ${b.status.replace(" ", "-")}">${esc(b.status)}</span>`}</td>
      <td>${isAdmin()
        ? `<button class="del" data-del="${esc(b.id)}">Delete</button>`
        : b.status === "Pending" ? `<button class="del" data-cancel="${esc(b.id)}">Cancel</button>` : ""}</td>
    </tr>`).join("");
}
$("#search").addEventListener("input", renderManage);
$("#filter").addEventListener("change", renderManage);

$("#rows").addEventListener("change", (e) => {
  if (!isAdmin() || !e.target.classList.contains("status")) return;
  bookings.find((b) => b.id === e.target.dataset.id).status = e.target.value;
  saveBookings(); renderManage();
});
$("#rows").addEventListener("click", (e) => {
  const del = e.target.dataset.del, can = e.target.dataset.cancel;
  if (del && isAdmin() && confirm("Delete booking " + del + "?")) {
    bookings = bookings.filter((b) => b.id !== del);
    saveBookings(); renderManage();
  }
  if (can && confirm("Cancel booking " + can + "?")) {
    const b = bookings.find((x) => x.id === can && x.owner === me.email && x.status === "Pending");
    if (b) { b.status = "Cancelled"; saveBookings(); renderManage(); }
  }
});

// ---------- Tracking ----------
$("#trackForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = $("#trackId").value.trim().toUpperCase();
  const b = visible().find((x) => x.id === id);
  const out = $("#trackResult");
  if (!b) { out.innerHTML = `<p class="errors">No booking found with ID "${esc(id)}" in your account.</p>`; return; }
  const step = FLOW.indexOf(b.status);
  out.innerHTML = `
    <div class="card">
      <h2>${esc(b.id)}: ${esc(b.from)} → ${esc(b.to)}</h2>
      <p>${esc(b.desc)} · ${esc(b.service)} · Pickup ${esc(b.date)} · Total ${money(b.total)}</p>
      ${b.status === "Cancelled"
        ? `<p class="errors">This booking was cancelled.</p>`
        : `<ul class="timeline">${FLOW.map((s, i) => `<li class="${i <= step ? "done" : ""}">${s}</li>`).join("")}</ul>`}
    </div>`;
});

// ---------- Rates (admin) ----------
function renderRates() {
  $("#rateFields").innerHTML = '<legend>Tariff</legend>' + RATE_FIELDS.map(([k, label]) =>
    `<label>${label}<input id="r_${k}" type="number" step="any" min="0" value="${rates[k]}"></label>`).join("");
  $("#rateMsg").textContent = "";
}
$("#rateForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!isAdmin()) return;
  const nr = {}, msg = $("#rateMsg");
  for (const [k, label] of RATE_FIELDS) {
    const v = parseFloat($("#r_" + k).value);
    if (!(v >= 0)) { msg.className = "errors"; msg.textContent = "Enter a valid number for: " + label; return; }
    nr[k] = v;
  }
  if (!(nr.volDivisor > 0)) { msg.className = "errors"; msg.textContent = "Volumetric divisor must be greater than 0."; return; }
  rates = nr; write("cargoRates", rates);
  msg.className = "note ok"; msg.textContent = "Rates saved. New quotations use these rates.";
  renderQuote();
});
$("#rateReset").addEventListener("click", () => {
  if (!isAdmin() || !confirm("Reset all rates to default?")) return;
  rates = { ...DEFAULT_RATES }; write("cargoRates", rates);
  renderRates(); $("#rateMsg").className = "note ok"; $("#rateMsg").textContent = "Rates reset to default.";
  renderQuote();
});

// ---------- Init ----------
async function init() {
  $("#cities").innerHTML = Object.keys(CITIES).map((c) => `<option value="${c}">`).join("");
  form.elements.date.min = today();
  if (!users.some((u) => u.role === "admin")) {
    const salt = newSalt();
    users.push({ name: "Administrator", email: "admin@cargobook.com", phone: "9999999999", role: "admin", salt, hash: await hash("Admin@123", salt) });
    write("cargoUsers", users);
  }
  const s = sessionStorage.getItem("cargoSession");
  const u = users.find((x) => x.email === s);
  if (u) startApp(u);
}
init();