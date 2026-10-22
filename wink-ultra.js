
const form = document.getElementById("uhForm");
const urlInput = document.getElementById("uhUrl");
const tokenInput = document.getElementById("uhToken");
const waitInput = document.getElementById("uhWait");
const submitButton = document.getElementById("uhSubmit");
const resultBox = document.getElementById("uhResult");
const resultTitle = document.getElementById("uhResultTitle");
const output = document.getElementById("uhOutput");

document.getElementById("uhYear").textContent =
  new Date().getFullYear();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const url = urlInput.value.trim();
  const token = tokenInput.value.trim();

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:") {
      throw new Error("Gunakan URL HTTPS.");
    }
  } catch {
    showResult("URL tidak valid", {
      message: "Masukkan URL gambar atau video HTTPS yang valid."
    }, true);
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "MEMPROSES...";
  resultBox.classList.add("show");
  resultTitle.textContent = "Menghubungi Wink AI";
  output.classList.remove("uh-error");
  output.textContent =
    "Mengirim permintaan ke server. Tunggu sebentar...";

  try {
    const response = await fetch("/api/wink/enhance-ultra", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url,
        wait: waitInput.checked,
        token
      })
    });

    const raw = await response.text();
    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      data = { response: raw.slice(0, 12000) };
    }

    if (!response.ok) {
      throw new Error(
        data.message || `Request gagal (${response.status}).`
      );
    }

    showResult("Respons Wink Ultra HD", data);
  } catch (error) {
    showResult("Terjadi kesalahan", {
      message: error.message || "Permintaan gagal."
    }, true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "✦ MULAI ENHANCEMENT";
  }
});

function showResult(title, data, isError = false) {
  resultBox.classList.add("show");
  resultTitle.textContent = title;
  output.classList.toggle("uh-error", isError);

  output.textContent = JSON.stringify(data, null, 2);
}
