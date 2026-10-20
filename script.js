const $ = (s) => document.querySelector(s);
const STORAGE_KEY = "winkStudioHistoryV2";
let toastTimer;
let activeAccountId = null;
let loadingTimer = null;

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}
function safeText(value) { return String(value ?? ""); }
function esc(value) {
  return safeText(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function safeHttpUrl(value) {
  try { const url = new URL(String(value)); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; }
  catch { return ""; }
}
function getHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveHistory(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 30)));
    return true;
  } catch { showToast("Penyimpanan browser penuh atau diblokir."); return false; }
}
function updateStats() {
  const items = getHistory();
  const succeeded = items.filter(x => x.success).length;
  $("#heroCreated").textContent = String(succeeded);
  $("#heroSessions").textContent = String(items.length);
  $("#historySummary").textContent = items.length ? `${items.length} aktivitas tersimpan di perangkat ini` : "Belum ada aktivitas";
}
function normalizeAccount(raw, response = {}) {
  const user = raw?.user || raw?.pengguna || raw?.profile || {};
  const pick = (...values) => values.find(v => v !== undefined && v !== null && v !== "");
  return {
    email: pick(raw?.email, raw?.mail, raw?.["alamat email"], ""),
    password: pick(raw?.password, raw?.["kata sandi"], raw?.pass, ""),
    token: pick(raw?.token, raw?.accessToken, ""),
    uid: pick(raw?.uid, user?.uid, ""),
    credits: pick(raw?.credits, raw?.credit, raw?.kredit, raw?.["jumlah kredit"], ""),
    screenName: pick(user?.screen_name, user?.nama_layar, user?.name, user?.nickname, ""),
    avatarUrl: pick(user?.avatar_url, user?.["avatar_ur l"], user?.avatarUrl, user?.avatar, ""),
    gender: pick(user?.gender, user?.["jenis kelamin"], ""),
    followerCount: pick(user?.follower_count, user?.jumlah_pengikut, ""),
    fanCount: pick(user?.fan_count, user?.jumlah_penggemar, ""),
    likeCount: pick(user?.be_like_count, user?.jumlah_kemiripan, ""),
    vipType: pick(user?.vip_type, ""),
    profileUrl: pick(user?.url, user?.profile_url, ""),
    mailAccessUrl: pick(raw?.mailAccessUrl, raw?.mail_access_url, response?.mailAccessUrl, "https://mail.tm"),
    instructions: pick(raw?.instructions, response?.instructions, "Buka layanan email yang disediakan API untuk memeriksa pesan verifikasi."),
    createdAt: pick(raw?.createdAt, raw?.["dibuat pada"], raw?.dibuat_pada, new Date().toISOString()),
    lastUsed: pick(raw?.lastUsed, raw?.saat_ini_di, "")
  };
}
function isTrue(value) { return value === true || value === 1 || value === "true" || value === "benar"; }
function getAccounts(response) {
  const list = response?.data || response?.result?.accounts || response?.result?.data || response?.accounts;
  return Array.isArray(list) ? list : [];
}
function renderAccount(account, id = null) {
  activeAccountId = id;
  const avatar = safeHttpUrl(account.avatarUrl);
  const mailUrl = safeHttpUrl(account.mailAccessUrl);
  const profileUrl = safeHttpUrl(account.profileUrl);
  const displayName = account.screenName || account.uid || "Wink account";
  const fields = [
    ["EMAIL", account.email, false],
    ["PASSWORD", account.password, false],
    ["TOKEN", account.token, true],
    ["UID", account.uid, false],
    ["CREDITS", account.credits, false]
  ];
  $("#resultCount").textContent = "1 ACCOUNT";
  $("#latestResult").innerHTML = `<article class="account-result">
    <div class="account-head">
      ${avatar ? `<img class="account-avatar" src="${esc(avatar)}" alt="" referrerpolicy="no-referrer">` : `<div class="account-avatar account-avatar-fallback">w.</div>`}
      <div class="account-person"><strong>${esc(displayName)}</strong><span>${esc(account.email || "Email tidak tersedia")}</span></div>
      <span class="success-badge">✓ SUCCESS</span>
    </div>
    <div class="account-grid">${fields.map(([label, value, wide]) => `<div class="account-field ${wide ? "wide" : ""}"><div class="field-head"><span>${esc(label)}</span><button class="copy-btn" type="button" data-copy="${encodeURIComponent(safeText(value))}">COPY ↗</button></div><div class="field-value">${esc(value || "—")}</div></div>`).join("")}</div>
    <div class="account-foot">
      ${account.gender ? `<span class="account-pill">Gender · ${esc(account.gender)}</span>` : ""}
      ${account.followerCount !== "" ? `<span class="account-pill">Followers · ${esc(account.followerCount)}</span>` : ""}
      ${account.fanCount !== "" ? `<span class="account-pill">Fans · ${esc(account.fanCount)}</span>` : ""}
      ${account.likeCount !== "" ? `<span class="account-pill">Likes · ${esc(account.likeCount)}</span>` : ""}
      ${account.vipType !== "" ? `<span class="account-pill">VIP · ${esc(account.vipType)}</span>` : ""}
      ${mailUrl ? `<a class="account-pill" href="${esc(mailUrl)}" target="_blank" rel="noopener noreferrer">Open mail inbox ↗</a>` : ""}
      ${profileUrl ? `<a class="account-pill" href="${esc(profileUrl)}" target="_blank" rel="noopener noreferrer">Open profile ↗</a>` : ""}
    </div>
    <div class="account-instructions">${esc(account.instructions)} ${mailUrl ? `<a href="${esc(mailUrl)}" target="_blank" rel="noopener noreferrer">Open mail.tm ↗</a>` : ""}</div>
  </article>`;
  $("#latestResult").querySelectorAll("[data-copy]").forEach(btn => btn.addEventListener("click", () => {
    let value = "";
    try { value = decodeURIComponent(btn.dataset.copy); } catch {}
    if (!value || value === "—") return showToast("Tidak ada data untuk disalin.");
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(value).then(() => showToast("Berhasil disalin.")).catch(() => fallbackCopy(value));
    else fallbackCopy(value);
  }));
  const bubble = $("#accountBubbleContent");
  if (bubble) { bubble.innerHTML = $("#latestResult").innerHTML; if (typeof window.openModal === "function") window.openModal("accountModal"); else { const modal=$("#accountModal"); if(modal){modal.classList.add("show");modal.setAttribute("aria-hidden","false");document.body.classList.add("modal-open");} } }
}
function fallbackCopy(value) {
  const input = document.createElement("textarea");
  input.value = value; input.style.position = "fixed"; input.style.opacity = "0";
  document.body.appendChild(input); input.select();
  try { document.execCommand("copy"); showToast("Berhasil disalin."); } catch { showToast("Clipboard tidak tersedia."); }
  input.remove();
}
function renderHistory() {
  const items = getHistory();
  updateStats();
  if (!items.length) {
    $("#historyList").innerHTML = '<div class="history-empty">Belum ada riwayat. Buat akun pertama kamu dulu.</div>';
    if ($("#historyListBubble")) $("#historyListBubble").innerHTML = $("#historyList").innerHTML;
    if ($("#historyButtonCount")) $("#historyButtonCount").textContent = "(0)";
    if ($("#historySummaryModal")) $("#historySummaryModal").textContent = "Riwayat masih kosong";
    return;
  }
  $("#historyList").innerHTML = items.map(item => `<div class="history-item" data-id="${esc(item.id)}">
    <div class="history-mark">${item.success ? "✓" : "!"}</div>
    <div class="history-copy"><strong>${esc(item.account?.screenName || item.account?.email || "Create Wink request")}</strong><span>${esc(item.account?.email || item.message || "Request gagal")} · ${esc(new Date(item.timestamp).toLocaleString("id-ID", {dateStyle:"medium",timeStyle:"short"}))}</span></div>
    <span class="history-state">${item.success ? "SUCCESS" : "FAILED"}</span>
    <div class="history-actions">${item.success ? `<button class="history-open" data-open="${esc(item.id)}">View</button>` : ""}<button class="history-delete" data-delete="${esc(item.id)}" aria-label="Delete history item">×</button></div>
  </div>`).join("");
  $("#historyList").querySelectorAll("[data-open]").forEach(btn => btn.addEventListener("click", () => {
    const item = getHistory().find(x => x.id === btn.dataset.open);
    if (item?.account) {
      renderAccount(item.account, item.id);
      const modal = $("#accountModal"); if (modal) { modal.classList.add("show"); modal.setAttribute("aria-hidden","false"); document.body.classList.add("modal-open"); }
      const historyModal = $("#historyModal"); if (historyModal) { historyModal.classList.remove("show"); historyModal.setAttribute("aria-hidden","true"); }
    }
  }));
  $("#historyList").querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => {
    const items = getHistory().filter(x => x.id !== btn.dataset.delete);
    saveHistory(items); renderHistory(); showToast("Riwayat dihapus dari perangkat ini.");
  }));
  const bubbleList = $("#historyListBubble");
  if (bubbleList) bubbleList.innerHTML = $("#historyList").innerHTML;
  const count = $("#historyButtonCount"); if (count) count.textContent = `(${items.length})`;
  const summaryModal = $("#historySummaryModal"); if (summaryModal) summaryModal.textContent = items.length ? `${items.length} aktivitas tersimpan di perangkat ini` : "Riwayat masih kosong";
}
function setApiState(state, text) {
  $("#apiStatusText").textContent = text;
  const dot = $("#apiDot");
  dot.style.background = state === "error" ? "#b84a4a" : state === "busy" ? "#b08a43" : "#6f9b7c";
}
function setLoading(on) {
  $("#loadingWrap").classList.toggle("hidden", !on);
  $("#createButton").classList.toggle("hidden", on);
  $("#notice").classList.add("hidden");
  if (on) {
    let progress = 0;
    const texts = ["Menghubungi API...", "Memproses permintaan...", "Menyiapkan detail hasil..."];
    const steps = [$("#step1"), $("#step2"), $("#step3")];
    steps.forEach((s, i) => s.classList.toggle("active", i === 0));
    $("#loadingPercent").textContent = "0%";
    $("#loadingText").textContent = texts[0];
    clearInterval(loadingTimer);
    loadingTimer = setInterval(() => {
      progress = Math.min(92, progress + (progress < 30 ? 7 : progress < 65 ? 3 : 1));
      $("#loadingPercent").textContent = `${progress}%`;
      const idx = progress < 30 ? 0 : progress < 68 ? 1 : 2;
      $("#loadingText").textContent = texts[idx];
      steps.forEach((s, i) => s.classList.toggle("active", i <= idx));
    }, 420);
  } else {
    clearInterval(loadingTimer);
    loadingTimer = null;
  }
}
function showNotice(message, type = "error") {
  const el = $("#notice");
  el.textContent = message;
  el.className = `notice ${type}`;
  el.classList.remove("hidden");
}
function normalizeApiResponse(payload) {
  // API may return the current English schema or a localized equivalent.
  const success = isTrue(payload?.status) || isTrue(payload?.success);
  const accounts = getAccounts(payload);
  const account = accounts.length ? normalizeAccount(accounts[0], payload) : null;
  const accountSuccess = account && (isTrue(accounts[0]?.sukses) || isTrue(accounts[0]?.success) || success);
  return {success: success && !!account && accountSuccess, account, payload, count: accounts.length};
}
$("#createButton").addEventListener("click", async () => {
  const last = Number(sessionStorage.getItem("winkLastRequest") || "0");
  const wait = 10000 - (Date.now() - last);
  if (wait > 0) return showToast(`Tunggu ${Math.ceil(wait / 1000)} detik sebelum request berikutnya.`);
  sessionStorage.setItem("winkLastRequest", String(Date.now()));
  $("#createButton").disabled = true;
  setApiState("busy", "Working...");
  setLoading(true);
  try {
    const response = await fetch("/api/create-wink", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({count:1})});
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `Request gagal (HTTP ${response.status}).`);
    const normalized = normalizeApiResponse(payload);
    if (!normalized.success) {
      const detail = payload.message || payload.msg || "Format respons API tidak sesuai atau API tidak mengembalikan akun sukses.";
      throw new Error(detail);
    }
    const item = {
      id: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
      timestamp: new Date().toISOString(),
      success: true,
      account: normalized.account,
      message: "Create Wink berhasil"
    };
    const history = getHistory();
    history.unshift(item);
    saveHistory(history);
    $("#loadingPercent").textContent = "100%";
    $("#loadingText").textContent = "Selesai — hasil sudah siap.";
    renderAccount(normalized.account, item.id);
    renderHistory();
    $("#latest").scrollIntoView({behavior:"smooth",block:"start"});
    setApiState("ready", "API connected");
    showNotice("Akun berhasil dibuat dan otomatis ditambahkan ke riwayat perangkat ini.", "success");
    showToast("Create Wink berhasil.");
  } catch (error) {
    setApiState("error", "Request failed");
    showNotice(error.message || "Terjadi kesalahan saat menghubungi API.", "error");
    showToast(error.message || "Request gagal.");
  } finally {
    setTimeout(() => {
      setLoading(false);
      $("#createButton").disabled = false;
      if ($("#apiStatusText").textContent === "Working...") setApiState("ready", "API ready");
    }, 650);
  }
});
$("#clearHistory").addEventListener("click", () => {
  if (!getHistory().length) return showToast("Riwayat masih kosong.");
  if (!confirm("Hapus seluruh riwayat dari perangkat ini?")) return;
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
  $("#resultCount").textContent = "NO RESULT YET";
  $("#latestResult").innerHTML = '<div class="empty-result"><div class="empty-icon"><span>✳</span></div><strong>Nothing here yet</strong><p>Hasil akun yang berhasil dibuat akan tampil di sini.</p></div>';
  showToast("Riwayat perangkat sudah dibersihkan.");
});
renderHistory();
