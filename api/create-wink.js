const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;
const requestBuckets = new Map();

function allowRequest(ip) {
  const now = Date.now();
  const current = requestBuckets.get(ip) || [];
  const fresh = current.filter(timestamp => now - timestamp < WINDOW_MS);
  if (fresh.length >= MAX_REQUESTS_PER_WINDOW) {
    requestBuckets.set(ip, fresh);
    return false;
  }
  fresh.push(now);
  requestBuckets.set(ip, fresh);
  return true;
}

function isTrue(value) {
  return value === true || value === 1 || value === "true" || value === "benar";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({status:false, message:"Method not allowed."});
  }

  const apiKey = process.env.JAKY_API_KEY;
  if (!apiKey) {
    return res.status(503).json({status:false, message:"JAKY_API_KEY belum diatur di Vercel Environment Variables."});
  }

  const ip = String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown").split(",")[0].trim();
  if (!allowRequest(ip)) {
    return res.status(429).json({status:false, message:"Terlalu banyak request. Tunggu satu menit sebelum mencoba lagi."});
  }

  const count = Number(req.body?.count ?? 1);
  if (count !== 1) {
    return res.status(400).json({status:false, message:"Jumlah per request dibatasi satu akun."});
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 110000);
  try {
    const endpoint = new URL("https://api.jaky.dev/v1/wink/create-account");
    endpoint.searchParams.set("apikey", apiKey);
    endpoint.searchParams.set("count", "1");

    const upstream = await fetch(endpoint.toString(), {
      method:"GET",
      headers:{"Accept":"application/json","User-Agent":"WinkStudio/2.0"},
      signal:controller.signal
    });
    const payload = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      const message = upstream.status === 401 || upstream.status === 403
        ? "API menolak API key. Periksa JAKY_API_KEY."
        : upstream.status === 429
          ? "Batas request API tercapai. Coba lagi nanti."
          : "Layanan API mengembalikan error.";
      return res.status(upstream.status === 429 ? 429 : 502).json({status:false,message,upstreamStatus:upstream.status});
    }
    if (!payload || typeof payload !== "object") {
      return res.status(502).json({status:false,message:"API tidak mengembalikan JSON yang valid."});
    }

    const statusOk = isTrue(payload.status) || isTrue(payload.success);
    const accounts = Array.isArray(payload.data) ? payload.data
      : Array.isArray(payload.result?.accounts) ? payload.result.accounts
      : Array.isArray(payload.result?.data) ? payload.result.data
      : Array.isArray(payload.accounts) ? payload.accounts : [];

    if (!statusOk || accounts.length === 0) {
      return res.status(502).json({
        status:false,
        message:payload.message || payload.msg || "API belum mengembalikan akun sukses.",
        upstreamStatus:upstream.status
      });
    }
    const first = accounts[0];
    if (!(isTrue(first.sukses) || isTrue(first.success) || statusOk)) {
      return res.status(502).json({status:false,message:"API mengembalikan akun dengan status gagal."});
    }
    // Keep the upstream schema intact so the frontend can handle both English
    // and localized field names without losing any metadata.
    return res.status(200).json(payload);
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    return res.status(timedOut ? 504 : 502).json({
      status:false,
      message:timedOut ? "API timeout. Coba lagi nanti." : "Tidak dapat menghubungi layanan API."
    });
  } finally {
    clearTimeout(timeout);
  }
}
