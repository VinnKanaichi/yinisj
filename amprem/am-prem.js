(() => {
  "use strict";

  // API requests go through your server-side proxy routes.
  // Do not put a private API key in this browser-side file.
  const ROUTES = {
    send: "/api/am-prem/send",
    verify: "/api/am-prem/verify",
    bulk: "/api/am-prem/bulk"
  };

  // Replace this URL with the raw URL of your TXT file in GitHub.
  const GITHUB_CODES_URL = "https://raw.githubusercontent.com/VinnKanaichi/yinisj/main/am-prem-codes.txt";
  const ACCESS_STORAGE_KEY = "createwink_am_prem_unlocked_v1";

  const $ = (selector) => document.querySelector(selector);
  const guideOverlay = $("#guideOverlay");

  $("#copyrightYear").textContent = new Date().getFullYear();

  function setNotice(selector, message, type = "info") {
    const el = $(selector);
    if (!el) return;
    el.textContent = message;
    el.className = `notice amprem-notice-${type}`;
    el.classList.remove("hidden");
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      button.dataset.originalText = button.innerHTML;
      button.disabled = true;
      button.innerHTML = "MEMPROSES...";
    } else {
      button.disabled = false;
      if (button.dataset.originalText) button.innerHTML = button.dataset.originalText;
    }
  }

  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    let data;
    const raw = await response.text();
    try { data = raw ? JSON.parse(raw) : {}; }
    catch { data = { message: raw }; }

    if (!response.ok) {
      const error = new Error(data.message || data.msg || data.error || `Request gagal (${response.status})`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function apiSucceeded(data) {
    return data?.status === true || data?.success === true || data?.ok === true;
  }

  function messageFrom(data, fallback) {
    return data?.message || data?.msg || data?.note || data?.statusText || fallback;
  }

  function showJson(selector, data) {
    const el = $(selector);
    if (!el) return;
    // Avoid rendering Firebase bearer tokens in the page/log output.
    const safe = JSON.parse(JSON.stringify(data ?? {}));
    if (safe?.data?.idToken) safe.data.idToken = "[disembunyikan]";
    el.textContent = JSON.stringify(safe, null, 2);
    el.classList.remove("hidden");
  }

  function verifySummary(data) {
    const premium = data?.data?.premium?.result;
    const user = data?.data?.user?.users?.[0];
    if (!apiSucceeded(data)) return messageFrom(data, "Verifikasi tidak berhasil.");
    if (premium) {
      const valid = premium.valid === true;
      const expiry = Number(premium.expiryTimeMillis);
      const expiryText = Number.isFinite(expiry) && expiry > 0
        ? new Date(expiry).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })
        : "tidak tersedia";
      return `Verifikasi berhasil. Status premium: ${valid ? "VALID" : "TIDAK VALID"}. ${user?.email ? `Email: ${user.email}. ` : ""}Masa berlaku sampai: ${expiryText}.`;
    }
    return messageFrom(data, "Verifikasi selesai diproses oleh API.");
  }

  function bulkSummary(data) {
    const total = Number(data?.total ?? 0);
    const successful = Number(data?.successful ?? 0);
    const failed = Number(data?.failed ?? 0);
    if (Number.isFinite(total) && total > 0) {
      const parts = [`Bulk API selesai: ${successful} berhasil, ${failed} gagal dari ${total}.`];
      if (data?.costDeducted !== undefined) parts.push(`Kuota terpotong: ${data.costDeducted}.`);
      const firstError = Array.isArray(data?.data) ? data.data.find(item => item?.success === false && item?.error)?.error : "";
      if (firstError) parts.push(`Detail: ${firstError}`);
      return parts.join(" ");
    }
    return messageFrom(data, apiSucceeded(data) ? "Bulk request selesai diproses." : "API bulk mengembalikan status gagal.");
  }

  $("#openGuide")?.addEventListener("click", () => {
    guideOverlay.classList.add("show");
  });
  $("#closeGuide")?.addEventListener("click", () => {
    guideOverlay.classList.remove("show");
  });
  guideOverlay?.addEventListener("click", (event) => {
    if (event.target === guideOverlay) guideOverlay.classList.remove("show");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") guideOverlay?.classList.remove("show");
  });

  $("#sendForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("#sendEmail").value.trim();
    const button = $("#sendButton");
    if (!email) return;
    setBusy(button, true);
    try {
      const data = await postJson(ROUTES.send, { email });
      if (!apiSucceeded(data)) throw new Error(messageFrom(data, "API gagal mengirim magic link."));
      $("#verifyEmail").value = email;
      setNotice("#sendNotice", messageFrom(data, "Permintaan magic link berhasil dikirim. Cek Inbox dan folder Spam."), "success");
    } catch (error) {
      setNotice("#sendNotice", error.message || "Gagal mengirim magic link. Coba lagi nanti.", "error");
    } finally {
      setBusy(button, false);
    }
  });

  $("#verifyForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("#verifyEmail").value.trim();
    const link = $("#magicLink").value.trim();
    const button = $("#verifyButton");
    if (!email || !link) return;

    let parsed;
    try {
      parsed = new URL(link);
      if (parsed.protocol !== "https:" || !parsed.hostname) throw new Error();
    } catch {
      setNotice("#verifyNotice", "Link tidak valid. Tempel URL lengkap yang dimulai dengan https:// dari email Alight Creative.", "error");
      return;
    }

    setBusy(button, true);
    try {
      const data = await postJson(ROUTES.verify, { email, link });
      if (!apiSucceeded(data)) throw new Error(messageFrom(data, "Verifikasi tidak berhasil."));
      setNotice("#verifyNotice", verifySummary(data), "success");
    } catch (error) {
      setNotice("#verifyNotice", error.message || "Verifikasi gagal. Periksa Gmail dan link yang ditempel.", "error");
    } finally {
      setBusy(button, false);
    }
  });

  async function validatePremiumCode(code) {
    if (!GITHUB_CODES_URL || GITHUB_CODES_URL.includes("USERNAME/REPO/BRANCH")) {
      throw new Error("Atur GITHUB_CODES_URL di am-prem.js ke raw URL file TXT GitHub milikmu terlebih dahulu.");
    }
    const response = await fetch(GITHUB_CODES_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("File kode premium tidak bisa dibaca. Periksa URL TXT GitHub.");
    const text = await response.text();
    const allowedCodes = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#"));
    return allowedCodes.includes(code.trim());
  }

  function unlockBulk() {
    $("#bulkLockPanel").classList.add("hidden");
    $("#bulkContent").classList.remove("hidden");
    $("#bulkStatusStat").textContent = "UNLOCKED";
    $("#bulkIcon").textContent = "✓";
    $("#bulkCard").classList.add("is-unlocked");
  }

  function lockBulk() {
    $("#bulkLockPanel").classList.remove("hidden");
    $("#bulkContent").classList.add("hidden");
    $("#bulkStatusStat").textContent = "LOCKED";
    $("#bulkIcon").textContent = "⌑";
    $("#bulkCard").classList.remove("is-unlocked");
  }

  $("#unlockForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = $("#premiumCode").value.trim();
    const button = $("#unlockButton");
    if (!code) return;
    setBusy(button, true);
    try {
      const valid = await validatePremiumCode(code);
      if (!valid) {
        setNotice("#unlockNotice", "Kode tidak valid. Periksa kembali kode premium kamu.", "error");
        return;
      }
      localStorage.setItem(ACCESS_STORAGE_KEY, "true");
      unlockBulk();
      setNotice("#unlockNotice", "Kode valid. Bulk Generator terbuka di browser ini.", "success");
    } catch (error) {
      setNotice("#unlockNotice", error.message || "Validasi kode gagal.", "error");
    } finally {
      setBusy(button, false);
    }
  });

  $("#bulkForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (localStorage.getItem(ACCESS_STORAGE_KEY) !== "true") {
      lockBulk();
      setNotice("#bulkNotice", "Validasi kode premium terlebih dahulu.", "error");
      return;
    }
    const count = Number($("#bulkCount").value);
    if (!Number.isInteger(count) || count < 1 || count > 20) {
      setNotice("#bulkNotice", "Jumlah request harus bilangan bulat antara 1 sampai 20.", "error");
      return;
    }

    const button = $("#bulkButton");
    setBusy(button, true);
    $("#bulkOutput").classList.add("hidden");
    try {
      const data = await postJson(ROUTES.bulk, { count });
      showJson("#bulkOutput", data);
      const allSucceeded = apiSucceeded(data) && Number(data?.failed ?? 0) === 0;
      setNotice("#bulkNotice", bulkSummary(data), allSucceeded ? "success" : "error");
    } catch (error) {
      if (error.data) showJson("#bulkOutput", error.data);
      setNotice("#bulkNotice", error.message || "Bulk request gagal.", "error");
    } finally {
      setBusy(button, false);
    }
  });

  $("#relockButton")?.addEventListener("click", () => {
    localStorage.removeItem(ACCESS_STORAGE_KEY);
    lockBulk();
    setNotice("#unlockNotice", "Akses Bulk dikunci kembali di browser ini.", "info");
  });

  // Restore the convenience unlock state after refresh.
  // This is a client-side gate only; enforce premium authorization on the server too.
  try {
    if (localStorage.getItem(ACCESS_STORAGE_KEY) === "true") unlockBulk();
    else lockBulk();
  } catch {
    lockBulk();
  }
})();
