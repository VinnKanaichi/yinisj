# Create Wink | Vinn Dev v2 — Create Wink

Website responsif dengan animasi scroll reveal, floating UI elements, marquee, loading progress, theme toggle, hasil akun, dan riwayat pada browser.

## Deploy ke Vercel

1. Upload isi folder ini ke repository GitHub.
2. Import repository di Vercel.
3. Tambahkan Environment Variable:
   - `JAKY_API_KEY` = API key yang sah untuk endpoint yang kamu gunakan.
4. Redeploy setelah mengatur variable.

API key hanya dipakai di serverless function `api/create-wink.js`, bukan di browser.

## Endpoint

Server memanggil:
`https://api.jaky.dev/v1/wink/create-account?apikey=...&count=1`

Endpoint upstream menerima API key dari Environment Variable. Website membatasi satu akun per request dan ada rate limit dasar per IP pada fungsi serverless. Untuk situs publik dengan trafik nyata, gunakan rate limiter persisten/WAF karena memori fungsi serverless tidak dijamin konsisten antar instance.

## Schema respons

Frontend menerima struktur `data[]` dengan field berbahasa Inggris atau nama terlokalisasi, seperti `kata sandi`, `kredit`, dan `pengguna`. Respons JSON mentah harus valid JSON; boolean JSON adalah `true`/`false`, bukan `benar`/`salah`. Jika contoh respons berasal dari terjemahan otomatis, API aslinya mungkin masih memakai nama field Inggris.

## Riwayat dan privasi

Riwayat tersimpan di `localStorage` browser perangkat yang digunakan dan mencakup data akun (termasuk token/password) agar bisa dibuka lagi dari daftar. Jangan gunakan komputer umum; gunakan tombol Clear history jika perangkat akan dipinjam orang lain. Riwayat tidak disinkronkan ke server dan tidak muncul otomatis di perangkat lain.

Gunakan API sesuai izin dan ketentuan penyedia layanan.
\n\n## Branding and social links\nThe landing page footer links currently point to the official GitHub, Discord, Telegram, and WhatsApp entry pages. Replace these URLs with your own profile/community invite links before publishing.\n