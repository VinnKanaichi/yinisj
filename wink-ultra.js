
const form = document.getElementById("uhForm");
const fileInput = document.getElementById("uhFile");
const tokenInput = document.getElementById("uhToken");
const submitButton = document.getElementById("uhSubmit");

const preview = document.getElementById("uhPreview");
const previewImg = document.getElementById("uhPreviewImg");
const previewName = document.getElementById("uhPreviewName");
const previewSize = document.getElementById("uhPreviewSize");
const removeButton = document.getElementById("uhRemove");

const resultBox = document.getElementById("uhResult");
const resultTitle = document.getElementById("uhResultTitle");
const statusText = document.getElementById("uhStatus");
const resultImage = document.getElementById("uhResultImage");
const downloadButton = document.getElementById("uhDownload");
const output = document.getElementById("uhOutput");

const MAX_FILE_SIZE = 3 * 1024 * 1024;
let previewObjectUrl = null;

const year = document.getElementById("uhYear");
if (year) year.textContent = new Date().getFullYear();

function showMessage(title, message, isError = false) {
  resultBox.classList.add("show");
  resultTitle.textContent = title;
  statusText.textContent = message;
  statusText.classList.toggle("uh-error", isError);
  output.textContent = "";
  resultImage.hidden = true;
  resultImage.removeAttribute("src");
  downloadButton.hidden = true;
  downloadButton.removeAttribute("href");
}

function getAllowedMime(file) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  return allowed.includes(file.type);
}

function clearPreview() {
  fileInput.value = "";

  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }

  preview.hidden = true;
  previewImg.removeAttribute("src");
  previewName.textContent = "";
  previewSize.textContent = "";
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];

  if (!file) {
    clearPreview();
    return;
  }

  if (!getAllowedMime(file) || file.size > MAX_FILE_SIZE) {
    clearPreview();
    showMessage(
      "Foto tidak valid",
      "Pilih foto JPG, PNG, atau WebP dengan ukuran maksimal 3 MB.",
      true
    );
    return;
  }

  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = URL.createObjectURL(file);

  previewImg.src = previewObjectUrl;
  previewName.textContent = file.name;
  previewSize.textContent = `${(file.size / 1024).toFixed(0)} KB`;
  preview.hidden = false;
});

removeButton.addEventListener("click", clearPreview);

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const comma = dataUrl.indexOf(",");

      if (comma < 0) {
        reject(new Error("Gagal membaca foto."));
        return;
      }

      resolve(dataUrl.slice(comma + 1));
    };

    reader.onerror = () => reject(new Error("Gagal membaca foto."));
    reader.readAsDataURL(file);
  });
}

async function postJson(endpoint, body) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.status === false) {
    throw new Error(
      data.message || `Permintaan gagal (${response.status}).`
    );
  }

  return data;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = fileInput.files?.[0];

  if (!file) {
    showMessage("Pilih foto dahulu", "Pilih satu foto dari galeri.", true);
    return;
  }

  if (!getAllowedMime(file) || file.size > MAX_FILE_SIZE) {
    showMessage(
      "Foto tidak valid",
      "Format harus JPG, PNG, atau WebP dengan ukuran maksimal 3 MB.",
      true
    );
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "MEMPROSES...";
  showMessage("Mengunggah foto", "Mengunggah foto ke GitHub...");

  try {
    const base64 = await fileToBase64(file);

    const uploaded = await postJson("/api/wink/upload", {
      mime: file.type,
      base64
    });

    if (!uploaded.url) {
      throw new Error("URL foto yang diunggah tidak ditemukan.");
    }

    showMessage(
      "Memproses foto",
      "Foto berhasil diunggah. Wink sedang meningkatkan kualitas gambar..."
    );

    const data = await postJson("/api/wink/enhance-ultra", {
      url: uploaded.url,
      token: tokenInput.value.trim()
    });

    const resultUrl = data?.result?.url;

    if (!resultUrl) {
      throw new Error("Wink belum memberikan URL hasil gambar.");
    }

    // Validasi tambahan di sisi browser.
    const parsed = new URL(resultUrl);

    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== "mt-wink-storage.meitudata.com"
    ) {
      throw new Error("URL hasil gambar tidak valid.");
    }

    resultTitle.textContent = "Enhancement berhasil";
    statusText.textContent = "Foto berhasil diproses. Kamu bisa melihat atau mengunduh hasilnya.";
    statusText.classList.remove("uh-error");
    resultBox.classList.add("show");

    resultImage.onload = () => {
      resultImage.hidden = false;
    };

    resultImage.onerror = () => {
      resultImage.hidden = true;
      statusText.textContent =
        "Proses berhasil, tetapi preview gagal dimuat. Coba unduh hasilnya.";
    };

    resultImage.src = resultUrl;

    downloadButton.href =
      "/api/wink/download?url=" + encodeURIComponent(resultUrl);
    downloadButton.hidden = false;
    output.textContent = "";
  } catch (error) {
    showMessage(
      "Terjadi kesalahan",
      error.message || "Permintaan gagal. Coba lagi nanti.",
      true
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "✦ MULAI ENHANCEMENT";
  }
});
