const API_URL = "https://script.google.com/macros/s/AKfycbzesiP83l5SkdKDFTEhzXlwhFNKg47Bnl8MIQP5k2uHsqsTnKdgm3rY197ReEoPPwld7g/exec";
let sessionToken = "";
let currentRole = "";
let currentEmail = "";
let couponRecords = [];

const $ = (id) => document.getElementById(id);
async function api(action, values = {}) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...values })
  });
  const payload = await response.json();
  if (!payload.success) throw new Error(payload.error || "Request failed.");
  return payload.data;
}

$("login").addEventListener("click", async () => {
  const email = $("email").value.trim();
  const password = $("password").value;
  const selectedRole = $("role").value;
  $("loginStatus").textContent = "Signing in...";
  $("login").disabled = true;
  try {
    const result = await api("login", { email, password });
    if (selectedRole && result.role !== selectedRole) {
      await api("logout", { token: result.token });
      throw new Error("Selected access type does not match this account.");
    }
    sessionToken = result.token;
    currentRole = result.role;
    currentEmail = result.email;
    $("loginPanel").classList.add("hidden");
    $("dashboard").classList.remove("hidden");
    $("welcome").textContent = "Welcome to your workspace.";
    $("accountRole").textContent = `${currentEmail} · ${currentRole.toUpperCase()}`;
    $("staffPanel").classList.toggle("hidden", currentRole !== "owner");
    await loadDashboard();
    await loadCoupons();
  } catch (error) {
    $("loginStatus").textContent = error.message;
  } finally {
    $("login").disabled = false;
  }
});

async function loadDashboard() {
  const stats = await api("dashboard", { token: sessionToken });
  $("totalCount").textContent = stats.total;
  $("redeemedCount").textContent = stats.redeemed;
  $("remainingCount").textContent = stats.pending;
}

async function loadCoupons() {
  $("recordsStatus").textContent = "Loading records...";
  try {
    const rows = await api("listCoupons", { token: sessionToken });
    couponRecords = rows.slice(1).map(row => ({
      phone: String(row[0] ?? ""), code: String(row[1] ?? ""),
      discount: row[2], status: String(row[3] ?? ""),
      created: row[4] ? new Date(row[4]).toLocaleString() : ""
    }));
    renderCoupons();
    $("recordsStatus").textContent = `${couponRecords.length} records loaded.`;
  } catch (error) { $("recordsStatus").textContent = error.message; }
}

function renderCoupons() {
  const q = $("search").value.trim().toLowerCase();
  const filtered = couponRecords.filter(r => r.phone.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
  $("couponRows").innerHTML = filtered.length ? filtered.map(r => `
    <tr><td>${escapeHtml(r.phone)}</td><td class="tag">${escapeHtml(r.code)}</td>
    <td>${escapeHtml(r.discount)}%</td><td>${escapeHtml(r.status)}</td>
    <td>${escapeHtml(r.created)}</td><td>${r.status === "Redeemed" ? "—" : `<button data-code="${escapeHtml(r.code)}" class="redeem">Redeem</button>`}</td></tr>`).join("") : '<tr><td colspan="6">No matching records.</td></tr>';
  document.querySelectorAll(".redeem").forEach(button => button.addEventListener("click", async () => {
    if (!confirm(`Redeem coupon ${button.dataset.code}?`)) return;
    button.disabled = true;
    try {
      const result = await api("redeemCoupon", { code: button.dataset.code, token: sessionToken });
      alert(result.message);
      await loadDashboard(); await loadCoupons();
    } catch (error) { alert(error.message); button.disabled = false; }
  }));
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
$("search").addEventListener("input", renderCoupons);
$("refresh").addEventListener("click", async () => { await loadDashboard(); await loadCoupons(); });
$("addStaff").addEventListener("click", async () => {
  $("staffStatus").textContent = "Creating staff account...";
  $("addStaff").disabled = true;
  try {
    await api("createStaff", { token: sessionToken, email: $("staffEmail").value.trim(), password: $("staffPassword").value });
    $("staffStatus").textContent = "Staff account created. Share the login details privately.";
    $("staffEmail").value = ""; $("staffPassword").value = "";
  } catch (error) { $("staffStatus").textContent = error.message; }
  finally { $("addStaff").disabled = false; }
});
$("export").addEventListener("click", () => {
  const header = ["Phone","Coupon Code","Discount","Status","Created At"];
  const lines = [header, ...couponRecords.map(r => [r.phone,r.code,r.discount,r.status,r.created])]
    .map(row => row.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\\n");
  const blob = new Blob([lines], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = "scan-get-reward-coupons.csv"; a.click(); URL.revokeObjectURL(url);
});
$("logout").addEventListener("click", async () => {
  try { await api("logout", { token: sessionToken }); } catch (_) {}
  sessionToken = ""; currentRole = ""; currentEmail = ""; couponRecords = [];
  $("dashboard").classList.add("hidden"); $("loginPanel").classList.remove("hidden");
  $("password").value = ""; $("loginStatus").textContent = "You have signed out.";
});
