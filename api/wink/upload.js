
import { randomUUID } from "node:crypto";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      status: false,
      message: "Method not allowed."
    });
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";
  const folder = (process.env.GITHUB_FOLDER || "uploader")
    .replace(/^\/+|\/+$/g, "");
  const token = process.env.GITHUB_TOKEN;

  if (!owner || !repo || !token) {
    return res.status(503).json({
      status: false,
      message: "Konfigurasi GitHub belum lengkap di Vercel."
    });
  }

  try {
    const body = req.body || {};
    const mime = String(body.mime || "").toLowerCase();
    const base64 = String(body.base64 || "");

    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowed.includes(mime)) {
      return res.status(400).json({
        status: false,
        message: "Format foto harus JPG, PNG, atau WebP."
      });
    }

    // Maksimum sekitar 3 MB sebelum encoding Base64.
    if (
      !base64 ||
      base64.length > 4_200_000 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) ||
      base64.length % 4 !== 0
    ) {
      return res.status(400).json({
        status: false,
        message: "Foto kosong atau terlalu besar. Maksimum 3 MB."
      });
    }

    const bytes = Buffer.from(base64, "base64");

    if (!bytes.length || bytes.length > 3 * 1024 * 1024) {
      return res.status(400).json({
        status: false,
        message: "Ukuran foto maksimal 3 MB."
      });
    }

    // Periksa signature file, bukan hanya MIME dari browser.
    const signatures = {
      "image/jpeg": bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
      "image/png": bytes.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      ),
      "image/webp": bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP"
    };

    if (!signatures[mime]) {
      return res.status(400).json({
        status: false,
        message: "Isi file tidak cocok dengan format gambar."
      });
    }

    const extension = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp"
    }[mime];

    const filename = `${randomUUID()}.${extension}`;
    const path = [folder, filename].filter(Boolean).join("/");

    const githubResponse = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `Upload image ${filename}`,
          content: bytes.toString("base64"),
          branch
        })
      }
    );

    const result = await githubResponse.json().catch(() => ({}));

    if (!githubResponse.ok) {
      console.error("GitHub upload failed:", githubResponse.status);

      return res.status(502).json({
        status: false,
        message: githubResponse.status === 401 ||
          githubResponse.status === 403
          ? "GitHub menolak token atau izin upload."
          : "Gagal mengunggah foto ke GitHub."
      });
    }

    const downloadUrl = result.content?.download_url;

    if (!downloadUrl) {
      return res.status(502).json({
        status: false,
        message: "GitHub tidak mengembalikan URL foto."
      });
    }

    return res.status(200).json({
      status: true,
      url: downloadUrl,
      filename
    });
  } catch (error) {
    console.error("Upload error:", error?.message);

    return res.status(500).json({
      status: false,
      message: "Terjadi kesalahan saat mengunggah foto."
    });
  }
}
