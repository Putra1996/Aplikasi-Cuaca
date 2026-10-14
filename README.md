# CuacaKu × Sekitarku — Dashboard Cuaca, AQI, Gempa BMKG & Gunung Api 500+ Kota Indonesia

Dashboard terbuka pemantauan **Kualitas Udara (AQI US-EPA & OpenWeather)**, **Cuaca BMKG & Open-Meteo**, **Skor Lingkungan & Kesiapan Aktivitas Outdoor (Eco-Health 0–100)**, **Konversi Polusi Setara Rokok Pasif**, **Info Auto-Gempa BMKG & Potensi Tsunami**, serta **Status Gunung Api Terdekat (PVMBG/MAGMA)** di **516 Kota & Kabupaten (38 Provinsi) Indonesia** + **Deteksi Lokasi GPS Real-Time**.

Dibangun ringan dan **PWA-ready** menggunakan HTML5, CSS3, dan Vanilla JavaScript plus fungsi serverless Vercel (`api/*.js`) dan server lokal (`scripts/dev-server.js`).

## Fitur Utama

- **Nasional 516 Kota/Kabupaten (38 Provinsi) + Lokasi GPS Real-Time**: Cari dan pilih dari 516 wilayah administratif Indonesia (termasuk Klumprit, Jakarta, Surabaya, Nusantara IKN, dll.) dengan prefetching instan, atau gunakan tombol **🎯 GPS** untuk deteksi koordinat otomatis via Haversine proximity.
- **Integrasi Multi-Sumber Resmi (BMKG + Open-Meteo + PVMBG + OpenWeather)**:
  - **Open-Meteo Weather & Air Quality API**: Suhu, kelembapan, indeks UV, prakiraan 7 hari & per jam (dengan kalibrasi virga WMO-BMKG), serta **US-EPA AQI (0–500)** dan rincian polutan mikro (**PM2.5, PM10, NO₂, SO₂, CO, O₃, Debu**) disertai jarum spektrum dinamis.
  - **BMKG InaTEWS API**: **Auto-Gempa Terkini** (`autogempa.json`) & **15 Gempa Terkini** (`gempaterkini.json`), magnitudo, kedalaman, jarak episenter dari lokasi Anda, peta guncangan (*Shakemap*), dan **Status Potensi Tsunami**.
  - **PVMBG / MAGMA ESDM**: Pemantauan **29 Gunung Api Aktif Indonesia** dengan deteksi jarak kawah terdekat otomatis, **Status 4 Level Resmi PVMBG** (*Level I Normal, Level II Waspada, Level III Siaga, Level IV Awas*), dan radius bahaya steril kawah.
  - **FDRS BMKG & Pantauan Karhutla (KLHK SiPongi+ / NASA FIRMS)**: Tingkat kemudahan kebakaran hutan & lahan (*AMAN, SEDANG, TINGGI, EKSTREM*), 122 titik panas satelit, serta **Korelasi Cerdas Kabut Asap**.
  - **OpenWeather Proxy (`/api/weather`)**: Mendukung One Call API 4.0 (1-minute timeline MinuteCast, 10 hari, per jam) & Air Pollution API dengan API key yang aman di sisi server.
- **Skor Lingkungan & Kesiapan Aktivitas Outdoor (Eco-Health 0–100)**: Menggabungkan skor AQI (50%), kenyamanan termal (25%), dan sinar UV (25%) menjadi skor komposit 0–100 lengkap dengan matriks kesiapan *Jogging & Lari*, *Bersepeda*, *Anak & Lansia*, serta *Ventilasi Rumah*.
- **Konversi Polusi Setara Rokok Pasif (Formula Berkeley Earth)**: Menghitung estimasi paparan harian partikulat halus PM2.5 yang setara dengan hisapan batang rokok pasif (`1 batang rokok ≈ 22 µg/m³ PM2.5 per 24 jam`).
- **Share Infografis 9:16 HD ke IG / WA Story**: Generator kartu infografis vertikal resolusi tinggi (`1080 × 1920 px`) berbasis HTML5 Canvas 2D dengan *Live Preview*, **1-Tap Native Web Share API** (`navigator.share`), unduh PNG HD, dan salin teks laporan.
- **Panduan Tanggap Darurat & Hotline Nasional 112**: Panggilan cepat ke **112**, **Basarnas (115)**, **Ambulans (119)**, **Damkar (113)**, **Polri (110)**, dan **PLN (123)** beserta protokol keselamatan gempa, tsunami (aturan 20-20-20), erupsi gunung api, dan polusi udara.
- **Ringan & PWA-Ready**: Dilengkapi `manifest.webmanifest`, Service Worker (`sw.js`) dengan strategi cache cerdas + SWR `localStorage` (TTL 15 menit), dan endpoint widget `/api/widget`.

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
