import proxy from "../_lib/jaky-proxy.js";

export default function handler(req, res) {
  return proxy(req, res, {
    routeKey: "am-prem-verify",
    endpoint: "verify",
    validate(body) {
      const email = typeof body.email === "string" ? body.email.trim() : "";
      const link = typeof body.link === "string" ? body.link.trim() : "";
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { error: "Masukkan alamat email yang valid." };
      }
      if (!link || link.length > 4096) return { error: "Magic link wajib diisi dan tidak boleh terlalu panjang." };
      try {
        const parsed = new URL(link);
        if (parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== "alightcreative.com") {
          return { error: "Link harus menggunakan HTTPS dari alightcreative.com." };
        }
      } catch {
        return { error: "Format magic link tidak valid." };
      }
      return { body: { email, link } };
    }
  });
}
