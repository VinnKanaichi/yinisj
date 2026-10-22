
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
    .filter(t => now - t < WINDOW_MS);

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
  const mediaUrl = typeof body.url === "string" ? body.url.trim() : "";
  const wait = body.wait === true;
  const token = typeof body.token === "string" ? body.token.trim() : "";

  if (!mediaUrl || mediaUrl.length > 2048) {
    return res.status(400).json({
      status: false,
      message: "URL media wajib diisi."
    });
  }

  try {
    const parsed = new URL(mediaUrl);
    if (parsed.protocol !== "https:") {
      throw new Error("invalid URL");
    }
  } catch {
    return res.status(400).json({
      status: false,
      message: "Masukkan URL media HTTPS yang valid."
    });
  }

  if (token.length > 4096) {
    return res.status(400).json({
      status: false,
      message: "Token terlalu panjang."
    });
  }

  const endpoint = new URL(
    "https://api.jaky.dev/v1/wink/enhance-ultra"
  );

  endpoint.searchParams.set("url", mediaUrl);
  endpoint.searchParams.set("wait", String(wait));

  if (token) {
    endpoint.searchParams.set("token", token);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const upstream = await fetch(endpoint.toString(), {
      method: "GET",
      headers: {
        "x-jaky-key": apiKey,
        "Accept": "application/json"
      },
      signal: controller.signal
    });

    const raw = await upstream.text();
    let payload;

    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { response: raw.slice(0, 12000) };
    }

    if (!upstream.ok) {
      return res.status(
        upstream.status === 429 ? 429 : 502
      ).json({
        status: false,
        message: payload.message || payload.msg ||
          "API Wink Ultra HD mengembalikan error.",
        upstreamStatus: upstream.status
      });
    }

    return res.status(200).json(payload);
  } catch (error) {
    const timeoutError = error?.name === "AbortError";

    return res.status(timeoutError ? 504 : 502).json({
      status: false,
      message: timeoutError
        ? "API timeout. Coba gunakan mode tanpa menunggu."
        : "Tidak dapat menghubungi API Wink Ultra HD."
    });
  } finally {
    clearTimeout(timeout);
  }
}
