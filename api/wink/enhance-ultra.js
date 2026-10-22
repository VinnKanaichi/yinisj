
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;
const requests = new Map();

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      status: false,
      message: "Method not allowed."
    });
  }

  const apiKey = process.env.JAKY_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      status: false,
      message: "JAKY_API_KEY belum diatur di Vercel."
    });
  }

  const ip = String(req.headers["x-forwarded-for"] || "unknown")
    .split(",")[0].trim().slice(0, 100);

  const now = Date.now();
  const recent = (requests.get(ip) || [])
    .filter(time => now - time < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    requests.set(ip, recent);
    return res.status(429).json({
      status: false,
      message: "Batas 5 permintaan per menit tercapai."
    });
  }

  recent.push(now);
  requests.set(ip, recent);

  const body = req.body || {};
  const mediaUrl = typeof body.url === "string"
    ? body.url.trim()
    : "";
  const token = typeof body.token === "string"
    ? body.token.trim()
    : "";

  try {
    const parsed = new URL(mediaUrl);

    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== "raw.githubusercontent.com" ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error("invalid URL");
    }
  } catch {
    return res.status(400).json({
      status: false,
      message: "URL foto GitHub tidak valid."
    });
  }

  if (mediaUrl.length > 2048 || token.length > 4096) {
    return res.status(400).json({
      status: false,
      message: "Data permintaan terlalu panjang."
    });
  }

  const endpoint = new URL(
    "https://api.jaky.dev/v1/wink/enhance-ultra"
  );

  endpoint.searchParams.set("url", mediaUrl);
  endpoint.searchParams.set("wait", "true");

  if (token) {
    endpoint.searchParams.set("token", token);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  try {
    const upstream = await fetch(endpoint, {
      method: "GET",
      headers: {
        "x-jaky-key": apiKey,
        Accept: "application/json"
      },
      signal: controller.signal
    });

    const raw = await upstream.text();

    let payload;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = {};
    }

    if (!upstream.ok) {
      return res.status(
        upstream.status === 429 ? 429 : 502
      ).json({
        status: false,
        message: payload.message ||
          payload.msg ||
          "API Wink Ultra HD mengembalikan error."
      });
    }

    const resultUrl = payload?.result?.url;

    // Jangan meneruskan respons yang tidak mempunyai URL hasil.
    if (
      payload?.status === true &&
      typeof resultUrl === "string"
    ) {
      try {
        const parsed = new URL(resultUrl);

        if (
          parsed.protocol !== "https:" ||
          parsed.hostname !== "mt-wink-storage.meitudata.com"
        ) {
          throw new Error("Invalid result host");
        }
      } catch {
        return res.status(502).json({
          status: false,
          message: "URL hasil dari Wink tidak valid."
        });
      }

      // Token respons upstream tidak diteruskan ke browser.
      return res.status(200).json({
        status: true,
        msg: payload.msg || "Process completed.",
        result: {
          taskId: payload.result.taskId,
          status: payload.result.status,
          statusText: payload.result.statusText,
          url: resultUrl
        }
      });
    }

    return res.status(502).json({
      status: false,
      message: payload?.msg ||
        payload?.message ||
        "Wink belum mengembalikan hasil gambar."
    });
  } catch (error) {
    const timedOut = error?.name === "AbortError";

    return res.status(timedOut ? 504 : 502).json({
      status: false,
      message: timedOut
        ? "Proses terlalu lama. Coba lagi beberapa saat."
        : "Tidak dapat menghubungi API Wink Ultra HD."
    });
  } finally {
    clearTimeout(timeout);
  }
}
