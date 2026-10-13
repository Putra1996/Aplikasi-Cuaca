# CuacaKu — Dashboard Cuaca Klumprit

Dashboard cuaca responsif untuk Klumprit, Jawa Tengah: HTML, CSS, dan JavaScript vanilla plus satu file server Node.js kecil sebagai **proxy OpenWeather**. API key hanya hidup di environment variable server; browser hanya bicara dengan endpoint same-origin `/api/weather`.

## Fitur

- Kondisi saat ini, peringatan, dan prakiraan ringkas 5 hari.
- **Prakiraan 10 Hari** dengan detail harian, rentang suhu, hujan, angin, kelembapan, dan UV yang tersedia.
- Prakiraan per jam (48 jam ke depan saat One Call 4.0 aktif; fallback 5 hari/3 jam tanpa One Call).
- **MinuteCast / 1-minute timeline** (60 menit ke depan saat One Call 4.0 aktif).
- **Kualitas Udara** dengan AQI OpenWeather (skala 1–5), konsentrasi PM2.5, PM10, NO₂, O₃, SO₂, CO, dan saran kehati-hatian.
- **Kesehatan & Aktivitas** dengan faktor cuaca/AQI dan skor heuristik; data UV yang hilang tidak diperlakukan sebagai UV nol.
- **Radar** skematis dengan timeline, play/pause, layer, drag, zoom, dan reset (tetap simulasi — lihat batasan).
- **Per Bulan** dengan kalender, ringkasan, tabel, dan grafik (data contoh lokal).
- Satuan **Celsius sebagai default**; pengguna dapat beralih ke Fahrenheit dan preferensi disimpan di `localStorage`.
- Navigasi dan kontrol responsif untuk laptop, PC, HP, tablet, dan iPhone (hingga 360px + safe area).

## Arsitektur data

```
Browser (app.js) ── same-origin ──> /api/weather ── HTTPS + API key ──> OpenWeather API
                                        │
                                        ├─ Vercel: fungsi serverless api/weather.js + api/health.js
                                        ├─ Lokal/VPS: scripts/dev-server.js (statis + proxy)
                                        └─ Logika bersama: lib/openweather.js · cache 10 menit
```

- **Live:** proxy server-side (`lib/openweather.js`) mengambil Current Weather, One Call 4.0 (current/1min/1h/1day), dan Air Pollution API, lalu menormalkannya ke payload tunggal `/api/weather`. UI melakukan polling ringan sekitar **setiap 10 menit** — mengikuti periode update model OpenWeather, bukan setiap detik. Kunci API **tidak pernah** dikirim ke browser.
- **Fallback:** bila key belum dikonfigurasi / langganan belum aktif / jaringan bermasalah, UI menampilkan `js/data.js` (snapshot lokal 12 Okt 2026 yang ditandai jelas sebagai *fallback lokal · bukan live*), lengkap dengan banner status. Tidak ada angka palsu yang diklaim live.
- **Produk yang butuh langganan terpisah** dilaporkan apa adanya di `payload.provider.modules`: One Call 4.0 (minute forecast, UV, 10 hari, timeline per bulan) dan Weather Maps/Global Precipitation Maps (peta hujan) — endpoint dasar tetap hidup tanpa One Call.

## Menjalankan lokal

Prasyarat: Node.js 20+ dan sebuah API key OpenWeather (free tier 1.000 panggilan/hari untuk One Call 4.0 setelah subscribe "One Call by Call" — tanpa subscribe, endpoint dasar tetap berfungsi).

```sh
cp .env.example .env      # isi OPENWEATHER_API_KEY=...
npm start                  # = node --env-file=.env scripts/dev-server.js
# atau: OPENWEATHER_API_KEY=kunci-anda node scripts/dev-server.js
```

Lalu buka `http://localhost:8000`. Tanpa `.env`, server tetap berjalan dan UI memakai fallback lokal yang ditandai jelas.

## Variabel lingkungan

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `OPENWEATHER_API_KEY` | *(kosong)* | Kunci OpenWeather. **Wajib rahasia** — jangan commit, jangan taruh di client. |
| `OPENWEATHER_LAT` / `OPENWEATHER_LON` | `-7.42` / `109.24` | Koordinat Klumprit. |
| `OPENWEATHER_REFRESH_SECONDS` | `600` | Interval cache server (minimum 600 detik). |
| `OPENWEATHER_ONE_CALL_ENABLED` | `true` | Nonaktifkan bila tidak subscribe One Call. |
| `PORT` / `HOST` | `8000` / `0.0.0.0` | Bind server. |

## Deployment

### Vercel (disarankan, zero-config)

Repo ini sudah berbentuk **situs statis + fungsi serverless** yang dipahami Vercel tanpa konfigurasi tambahan:

1. Import repo di Vercel (framework preset otomatis **Other** — dipaksa oleh `"framework": null` di `vercel.json`).
2. Di **Project Settings → Environment Variables**, tambahkan `OPENWEATHER_API_KEY` (plus variabel opsional lain bila perlu).
3. Deploy. Verifikasi `https://<domain>/api/health` → `configured: true`, lalu `/api/weather` → `meta.live: true`.

> ⚠️ **Jangan membuat file `server.js`/`server.ts` di root repo.** Vercel akan otomatis mendeteksinya sebagai framework "Node" dan membungkus seluruh situs sebagai satu fungsi — inilah penyebab insiden `500 FUNCTION_INVOCATION_FAILED` (lihat `AUDIT.md`). Ada tes regresi yang menjaga hal ini.

### Host Node.js (Railway, Render, Fly.io, VPS)

Jalankan `node scripts/dev-server.js` dengan `OPENWEATHER_API_KEY` sebagai **secret** di platform tersebut — server ini menyajikan file statis sekaligus proxy `/api/*` yang sama. Repo ini tidak menyimpan key; `.env` masuk `.gitignore`. Catatan: GitHub Pages hanya melayani file statis — tanpa server Node, UI berjalan dalam mode fallback lokal.

## Pemeriksaan

```sh
node --test tests/*.test.js    # 26 tes: data, normalisasi, keamanan key, e2e proxy + fungsi Vercel
node --check js/data.js js/app.js js/charts.js js/radar.js lib/openweather.js scripts/dev-server.js api/weather.js api/health.js
git diff --check
```

## Batasan yang jujur

- **Radar** tetap simulasi skematis. Peta presipitasi OpenWeather (Weather Maps 1.0 / Global Precipitation Maps) membutuhkan produk/subscription yang terpisah; hingga tersedia, tampilan radar ditandai "Bukan radar live".
- **Kalender Per Bulan** memakai data contoh lokal untuk Oktober 2026 (ada 1 hari yang diketahui kosong). Timeline per bulan otomatis memerlukan akses One Call 4.0.
- Satuan internal mengikuti pipeline Fahrenheit dari API (units imperial) lalu diformat ke Celsius oleh UI; angin dikonversi ke km/jam.
- Skor kesehatan/aktivitas adalah heuristik antarmuka, bukan penilaian medis.
- AQI OpenWeather memakai skala 1–5 (Baik → Sangat Buruk); ini **bukan ISPU** Indonesia. Untuk keputusan kesehatan resmi gunakan ISPU KLHK/otoritas setempat.

Lihat [`AUDIT.md`](AUDIT.md) untuk temuan audit, hasil verifikasi, dan status integrasi live.
