const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;
const requestBuckets = new Map();

function allowRequest(ip, routeKey) {
  const key = `${routeKey}:${ip}`;
  const now = Date.now();
  const current = requestBuckets.get(key) || [];
  const fresh = current.filter((timestamp) => now - timestamp < WINDOW_MS);
  if (fresh.length >= MAX_REQUESTS_PER_WINDOW) {
    requestBuckets.set(key, fresh);
    return false;
  }
  fresh.push(now);
  requestBuckets.set(key, fresh);
  return true;
}

function getClientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown")
    .split(",")[0].trim().slice(0, 100);
}

function setSecurityHeaders(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
}

export default async function proxy(req, res, { routeKey, endpoint, validate }) {
  setSecurityHeaders(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ status: false, success: false, message: "Method not allowed." });
  }

  const apiKey = process.env.JAKY_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      status: false,
      success: false,
      message: "JAKY_API_KEY belum diatur di Vercel Environment Variables."
    });
  }

  if (!allowRequest(getClientIp(req), routeKey)) {
    return res.status(429).json({
      status: false,
      success: false,
      message: "Terlalu banyak request. Tunggu satu menit sebelum mencoba lagi."
    });
  }

  const validation = validate(req.body || {});
  if (validation.error) {
    return res.status(400).json({ status: false, success: false, message: validation.error });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const upstream = await fetch(`https://api.jaky.dev/v1/alight-motion/${endpoint}`, {
      method: "POST",
      headers: {
        "x-jaky-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(validation.body),
      signal: controller.signal
    });

    const raw = await upstream.text();
    let payload;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { status: false, success: false, message: "Layanan API mengembalikan respons yang tidak valid." };
    }

    if (!upstream.ok) {
      const status = upstream.status === 429 ? 429 : upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502;
      return res.status(status).json({
        ...payload,
        status: false,
        success: false,
        message: payload.message || payload.msg || (upstream.status === 401 || upstream.status === 403
          ? "API menolak API key. Periksa JAKY_API_KEY di Vercel."
          : upstream.status === 429
            ? "Batas request API tercapai. Coba lagi nanti."
            : "Layanan API mengembalikan error.")
      });
    }

    // Preserve the upstream response shape for the existing AM Prem frontend.
    return res.status(200).json(payload);
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    return res.status(timedOut ? 504 : 502).json({
      status: false,
      success: false,
      message: timedOut ? "API timeout. Coba lagi nanti." : "Tidak dapat menghubungi layanan API."
    });
  } finally {
    clearTimeout(timeout);
  }
}
