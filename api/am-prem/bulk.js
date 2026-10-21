import proxy from "../_lib/jaky-proxy.js";

export default function handler(req, res) {
  return proxy(req, res, {
    routeKey: "am-prem-bulk",
    endpoint: "bulk",
    validate(body) {
      const count = Number(body.count);
      if (!Number.isInteger(count) || count < 1 || count > 20) {
        return { error: "Jumlah akun harus bilangan bulat antara 1 sampai 20." };
      }
      // The upstream API example accepts count as a string.
      return { body: { count: String(count) } };
    }
  });
}
