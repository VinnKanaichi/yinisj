import proxy from "../_lib/jaky-proxy.js";

export default function handler(req, res) {
return proxy(req, res, {
routeKey: "am-prem-verify",
endpoint: "verify",
validate(body) {
const email =
typeof body.email === "string" ? body.email.trim() : "";
const link =
typeof body.link === "string" ? body.link.trim() : "";

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return { error: "Masukkan alamat email yang valid." };
  }

  if (!link || link.length > 4096) {
    return {
      error: "Magic link wajib diisi dan tidak boleh terlalu panjang."
    };
  }

  try {
    const parsed = new URL(link);

    if (parsed.protocol !== "https:") {
      return { error: "Magic link harus menggunakan HTTPS." };
    }

    let target;

    if (
      parsed.hostname.toLowerCase() ===
        "alight-creative.firebaseapp.com" &&
      parsed.pathname === "/__/auth/links"
    ) {
      const innerLink = parsed.searchParams.get("link");

      if (!innerLink) {
        return { error: "URL tujuan autentikasi tidak ditemukan." };
      }

      target = new URL(innerLink);
    } else if (
      parsed.hostname.toLowerCase() === "alightcreative.com"
    ) {
      target = parsed;
    } else {
      return { error: "Domain magic link tidak diizinkan." };
    }

    if (
      target.protocol !== "https:" ||
      target.hostname.toLowerCase() !== "alightcreative.com" ||
      target.pathname !== "/auth_action/"
    ) {
      return { error: "URL tujuan autentikasi tidak valid." };
    }
  } catch {
    return { error: "Format magic link tidak valid." };
  }

  return { body: { email, link } };
}

});
}
