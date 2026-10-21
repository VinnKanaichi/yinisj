import proxy from "../_lib/jaky-proxy.js";

export default function handler(req, res) {
  return proxy(req, res, {
    routeKey: "am-prem-send",
    endpoint: "send",
    validate(body) {
      const email = typeof body.email === "string" ? body.email.trim() : "";
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { error: "Masukkan alamat email yang valid." };
      }
      return { body: { email } };
    }
  });
}
