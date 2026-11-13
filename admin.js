/* SCAN & GET REWARD — partner console.
   Uses the same Apps Script Web App as the customer page.
   The server checks every permission; this file only shows what each role may see. */

const API_URL = "https://script.google.com/macros/s/AKfycbzesiP83l5SkdKDFTEhzXlwhFNKg47Bnl8MIQP5k2uHsqsTnKdgm3rY197ReEoPPwld7g/exec";
const VALID_DAYS = [1, 3, 7, 15, 30, 60, 90];
const MAX_ROWS = 200;
const SECTIONS = ["overview", "coupons", "redemptions", "settings", "team"];
const OWNER_SECTIONS = ["settings", "team"];
const TITLES = {
  overview: "Overview",
  coupons: "Customer coupons",
  redemptions: "Redemptions",
  settings: "Coupon validity",
  team: "Staff accounts"
};
// Used only if the sheet has no header row. Matches the order admin.js always used.
const COLUMN_FALLBACK = { phone: 0, code: 1, discount: 2, status: 3, created: 4, redeemedAt: 5, redeemedBy: 6 };
// Header names used to find each column, so a reordered sheet still works.
const HEADER_NAMES = {
  phone: "phone",
  code: "coupon code",
  discount: "discount",
  status: "status",
  created: "created at",
  redeemedAt: "redeemed at",
  redeemedBy: "redeemed by"
};

let session = { token: "", role: "", email: "" };
let records = [];
let pendingRedeem = "";
let toastTimer = null;

const $ = id => document.getElementById(id);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));
const ts = v => {
  const t = Date.parse(v);
  return isNaN(t) ? 0 : t;
};
const fmtDate = v => {
  if (!v) return "—";
  const t = Date.parse(v);
  return isNaN(t)
    ? String(v)
    : new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};
// Show only the first two and last four digits of a 10-digit number.
const mask = phone => {
  const digits = String(phone ?? "").replace(/\D/g, "");
  const last10 = digits.slice(-10);
  if (last10.length === 10) return last10.slice(0, 2) + "XXXX" + last10.slice(-4);
  return digits ? "••••" + digits.slice(-4) : "—";
};
const pctText = v => {
  const s = String(v ?? "").replace("%", "").trim();
  return s ? s + "%" : "—";
};
const isRedeemed = status => String(status).toLowerCase() === "redeemed";
const isOpen = status => !["redeemed", "expired", "cancelled"].includes(String(status).toLowerCase());
const pill = status => {
  const s = String(status ?? "").toLowerCase();
  const cls = s === "redeemed" ? "pill-redeemed"
    : s === "expired" ? "pill-expired"
    : s === "cancelled" ? "pill-cancelled"
    : "";
  return '<span class="pill ' + cls + '">' + esc(status || "—") + "</span>";
};

function setStatus(id, text, isError = false) {
  const el = $(id);
  el.textContent = text;
  el.classList.toggle("error", isError);
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

// ---------- API ----------
async function api(action, values = {}) {
  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...values })
    });
  } catch (_) {
    throw new Error("Could not reach the reward service. Check your connection.");
  }

  let payload;
  try {
    payload = await response.json();
  } catch (_) {
    throw new Error("The reward service sent an unreadable response.");
  }

  if (!payload.success) {
    const message = payload.error || "Request failed.";
    // A dead session signs the console out instead of leaving stale buttons on screen.
    if (session.token && /session|unauthori[sz]ed/i.test(message) && !/coupon/i.test(message)) {
      signOut("Your session has ended. Please sign in again.");
    }
    throw new Error(message);
  }

  return payload.data;
}

// ---------- SIGN IN / OUT ----------
async function signIn() {
  const email = $("email").value.trim();
  const password = $("password").value;
  const chosen = $("role").value;

  if (!email || !password) {
    setStatus("loginStatus", "Enter your email and password.", true);
    return;
  }

  $("login").disabled = true;
  setStatus("loginStatus", "Signing in…");

  try {
    const result = await api("login", { email, password });

    if (chosen && result.role !== chosen) {
      await api("logout", { token: result.token }).catch(() => {});
      throw new Error("This account does not match the selected access type.");
    }

    session = { token: result.token, role: result.role, email: result.email || email };
    $("password").value = "";
    showConsole();
    await refreshAll();
  } catch (err) {
    setStatus("loginStatus", err.message, true);
  } finally {
    $("login").disabled = false;
  }
}

function showConsole() {
  const owner = session.role === "owner";
  $("loginView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  $("logout").classList.remove("hidden");
  $("roleBadge").classList.remove("hidden");
  $("roleBadge").textContent = session.role.toUpperCase();
  $("accountLine").textContent = session.email + " · " + session.role.toUpperCase();
  document.querySelectorAll(".side-nav .owner-only").forEach(el => el.classList.toggle("hidden", !owner));
  setStatus("loginStatus", "");
  route();
}

function signOut(message = "") {
  session = { token: "", role: "", email: "" };
  records = [];
  pendingRedeem = "";
  $("appView").classList.add("hidden");
  $("loginView").classList.remove("hidden");
  $("logout").classList.add("hidden");
  $("roleBadge").classList.add("hidden");
  $("password").value = "";
  setStatus("loginStatus", message);
  window.scrollTo(0, 0);
}

// ---------- ROUTING ----------
function route() {
  if (!session.token) return;

  let name = location.hash.replace("#", "");
  if (!SECTIONS.includes(name)) name = "overview";
  if (OWNER_SECTIONS.includes(name) && session.role !== "owner") name = "overview";

  document.querySelectorAll("[data-section]").forEach(sec => {
    sec.classList.toggle("hidden", sec.dataset.section !== name);
  });
  document.querySelectorAll(".side-nav a").forEach(a => {
    if (a.dataset.view === name) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  $("pageTitle").textContent = TITLES[name];
}

// ---------- DATA ----------
async function refreshAll() {
  await Promise.all([
    loadStats(),
    loadRecords(),
    session.role === "owner" ? loadValidity() : null
  ]);
}

async function loadStats() {
  try {
    const s = await api("dashboard", { token: session.token });
    const total = Number(s.total) || 0;
    const redeemed = Number(s.redeemed) || 0;
    $("statTotal").textContent = total;
    $("statRedeemed").textContent = redeemed;
    $("statPending").textContent = Number(s.pending) || 0;
    $("statRate").textContent = total ? Math.round((redeemed / total) * 100) + "%" : "0%";
  } catch (err) {
    toast(err.message);
  }
}

// Turns the sheet rows into records. Row 0 is the header.
function mapRecords(rows) {
  if (!Array.isArray(rows) || rows.length < 2 || !Array.isArray(rows[0])) return [];

  const header = rows[0].map(h => String(h ?? "").trim().toLowerCase());
  const pick = (row, key) => {
    const named = header.indexOf(HEADER_NAMES[key]);
    const i = named >= 0 ? named : COLUMN_FALLBACK[key];
    return String(row[i] ?? "");
  };

  return rows.slice(1).map(row => ({
    phone: pick(row, "phone"),
    code: pick(row, "code"),
    discount: pick(row, "discount"),
    status: pick(row, "status"),
    created: pick(row, "created"),
    redeemedAt: pick(row, "redeemedAt"),
    redeemedBy: pick(row, "redeemedBy")
  }));
}

async function loadRecords() {
  setStatus("recordsStatus", "Loading records…");
  try {
    const rows = await api("listCoupons", { token: session.token });
    records = mapRecords(rows);
    fillStatusFilter();
    renderAll();
    setStatus("recordsStatus", records.length + " records loaded.");
  } catch (err) {
    setStatus("recordsStatus", err.message, true);
  }
}

function renderAll() {
  renderCoupons();
  renderRedemptions();
  renderRecent();
}

function fillStatusFilter() {
  const select = $("statusFilter");
  const current = select.value;
  const statuses = [...new Set(records.map(r => r.status).filter(Boolean))].sort();
  select.innerHTML = '<option value="">All statuses</option>' +
    statuses.map(s => '<option value="' + esc(s) + '">' + esc(s) + "</option>").join("");
  select.value = statuses.includes(current) ? current : "";
}

function renderCoupons() {
  const q = $("search").value.trim().toLowerCase();
  const status = $("statusFilter").value;
  const list = records.filter(r =>
    (!q || r.phone.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)) &&
    (!status || r.status === status)
  );

  if (!list.length) {
    $("couponRows").innerHTML = '<tr><td colspan="6" class="muted">No matching records.</td></tr>';
    setStatus("couponCount", "");
    return;
  }

  $("couponRows").innerHTML = list.slice(0, MAX_ROWS).map(r => {
    let action = '<span class="muted">—</span>';
    if (isOpen(r.status)) {
      action = pendingRedeem === r.code
        ? '<div class="act">' +
            '<button class="small-btn danger sm" type="button" data-confirm="' + esc(r.code) + '">Confirm</button>' +
            '<button class="small-btn ghost sm" type="button" data-keep>Keep</button>' +
          "</div>"
        : '<button class="small-btn sm" type="button" data-ask="' + esc(r.code) + '">Redeem</button>';
    }
    return "<tr>" +
      "<td>" + esc(mask(r.phone)) + "</td>" +
      '<td class="code">' + esc(r.code) + "</td>" +
      "<td>" + esc(pctText(r.discount)) + "</td>" +
      "<td>" + pill(r.status) + "</td>" +
      "<td>" + esc(fmtDate(r.created)) + "</td>" +
      "<td>" + action + "</td>" +
      "</tr>";
  }).join("");

  setStatus("couponCount", list.length > MAX_ROWS
    ? "Showing the first " + MAX_ROWS + " of " + list.length + ". Search to narrow it down."
    : list.length + " matching records.");
}

function renderRedemptions() {
  const rows = records
    .filter(r => isRedeemed(r.status))
    .sort((a, b) => ts(b.redeemedAt) - ts(a.redeemedAt));

  $("redemptionRows").innerHTML = rows.length
    ? rows.map(r =>
        "<tr>" +
        '<td class="code">' + esc(r.code) + "</td>" +
        "<td>" + esc(mask(r.phone)) + "</td>" +
        "<td>" + esc(pctText(r.discount)) + "</td>" +
        "<td>" + esc(fmtDate(r.redeemedAt)) + "</td>" +
        "<td>" + esc(r.redeemedBy || "—") + "</td>" +
        "</tr>"
      ).join("")
    : '<tr><td colspan="5" class="muted">No redemptions yet.</td></tr>';

  setStatus("redemptionNote", rows.length ? rows.length + " redemptions in total." : "");
}

function renderRecent() {
  const rows = [...records].sort((a, b) => ts(b.created) - ts(a.created)).slice(0, 5);
  $("recentRows").innerHTML = rows.length
    ? rows.map(r =>
        "<tr>" +
        "<td>" + esc(mask(r.phone)) + "</td>" +
        '<td class="code">' + esc(r.code) + "</td>" +
        "<td>" + esc(pctText(r.discount)) + "</td>" +
        "<td>" + pill(r.status) + "</td>" +
        "<td>" + esc(fmtDate(r.created)) + "</td>" +
        "</tr>"
      ).join("")
    : '<tr><td colspan="5" class="muted">No coupons yet.</td></tr>';
}

// ---------- REDEEM (two clicks, no popup) ----------
async function redeem(code, btn) {
  btn.disabled = true;
  try {
    const result = await api("redeemCoupon", { code, token: session.token });
    pendingRedeem = "";
    toast(result.message || "Coupon redeemed.");
    await refreshAll();
  } catch (err) {
    pendingRedeem = "";
    toast(err.message);
    renderCoupons();
  }
}

// ---------- OWNER: VALIDITY ----------
async function loadValidity() {
  setStatus("validityStatus", "Loading…");
  try {
    const r = await api("getCouponValidity", { token: session.token });
    $("validityDays").value = String(r.days);
    setStatus("validityStatus", "Current validity: " + r.days + " days.");
  } catch (err) {
    setStatus("validityStatus", err.message, true);
  }
}

$("saveValidity").addEventListener("click", async () => {
  const days = Number($("validityDays").value);
  if (!VALID_DAYS.includes(days)) {
    setStatus("validityStatus", "Choose a valid number of days.", true);
    return;
  }

  const btn = $("saveValidity");
  btn.disabled = true;
  setStatus("validityStatus", "Saving…");
  try {
    const r = await api("setCouponValidity", { token: session.token, days });
    setStatus("validityStatus", "Saved. New coupons will be valid for " + r.days + " days.");
    toast("Coupon validity saved.");
  } catch (err) {
    setStatus("validityStatus", err.message, true);
  } finally {
    btn.disabled = false;
  }
});

// ---------- OWNER: STAFF ----------
$("addStaff").addEventListener("click", async () => {
  const email = $("staffEmail").value.trim();
  const password = $("staffPassword").value;

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    setStatus("staffStatus", "Enter a valid staff email.", true);
    return;
  }
  if (password.length < 10) {
    setStatus("staffStatus", "Use a password of at least 10 characters.", true);
    return;
  }

  const btn = $("addStaff");
  btn.disabled = true;
  setStatus("staffStatus", "Creating staff account…");
  try {
    await api("createStaff", { token: session.token, email, password });
    $("staffEmail").value = "";
    $("staffPassword").value = "";
    setStatus("staffStatus", "Staff account created. Share the login details privately.");
  } catch (err) {
    setStatus("staffStatus", err.message, true);
  } finally {
    btn.disabled = false;
  }
});

// ---------- EVENTS ----------
$("login").addEventListener("click", signIn);
$("password").addEventListener("keydown", e => {
  if (e.key === "Enter") signIn();
});

$("couponRows").addEventListener("click", async e => {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.dataset.ask) {
    pendingRedeem = btn.dataset.ask;
    renderCoupons();
  } else if (btn.hasAttribute("data-keep")) {
    pendingRedeem = "";
    renderCoupons();
  } else if (btn.dataset.confirm) {
    await redeem(btn.dataset.confirm, btn);
  }
});

$("search").addEventListener("input", renderCoupons);
$("statusFilter").addEventListener("change", renderCoupons);
$("refresh").addEventListener("click", refreshAll);

$("export").addEventListener("click", () => {
  if (!records.length) {
    toast("No records to export yet.");
    return;
  }
  const header = ["Phone", "Coupon Code", "Discount", "Status", "Created At", "Redeemed At", "Redeemed By"];
  const body = records.map(r => [r.phone, r.code, r.discount, r.status, r.created, r.redeemedAt, r.redeemedBy]);
  const csv = [header, ...body]
    .map(row => row.map(v => '"' + String(v ?? "").replace(/"/g, '""') + '"').join(","))
    .join("\n");

  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "scan-get-reward-coupons.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$("logout").addEventListener("click", async () => {
  if (session.token) await api("logout", { token: session.token }).catch(() => {});
  signOut("You have signed out.");
});

window.addEventListener("hashchange", route);
