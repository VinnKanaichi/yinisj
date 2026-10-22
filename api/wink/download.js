
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method not allowed");
  }

  let url;

  try {
    url = new URL(String(req.query?.url || ""));

    if (
      url.protocol !== "https:" ||
      url.hostname !== "mt-wink-storage.meitudata.com" ||
      url.username ||
      url.password
    ) {
      throw new Error("Invalid URL");
    }
  } catch {
    return res.status(400).json({
      status: false,
      message: "URL hasil tidak valid."
    });
  }

  try {
    const upstream = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(20_000)
    });

    if (!upstream.ok) {
      return res.status(502).json({
        status: false,
        message: "Gambar hasil tidak dapat diunduh."
      });
    }

    const mime = (upstream.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();

    const extensions = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp"
    };

    if (!extensions[mime]) {
      return res.status(415).json({
        status: false,
        message: "Format hasil tidak didukung."
      });
    }

    const length = Number(upstream.headers.get("content-length") || 0);

    if (length > 20 * 1024 * 1024) {
      return res.status(413).json({
        status: false,
        message: "Ukuran gambar terlalu besar."
      });
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());

    if (!bytes.length || bytes.length > 20 * 1024 * 1024) {
      return res.status(413).json({
        status: false,
        message: "Ukuran gambar terlalu besar."
      });
    }

    res.setHeader("Content-Type", mime);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="create-wink-result.${extensions[mime]}"`
    );
    res.setHeader("Content-Length", String(bytes.length));

    return res.status(200).send(bytes);
  } catch {
    return res.status(502).json({
      status: false,
      message: "Gagal mengambil gambar hasil dari Wink."
    });
  }
}
