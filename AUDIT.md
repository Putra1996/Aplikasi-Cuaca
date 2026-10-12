# AUDIT — CuacaKu (Klumprit, Jawa Tengah)

Tanggal audit: 12 Oktober 2026 · Branch `arena/94271b44-aplikasi-cuaca`

## Ringkasan status

| Aspek | Status |
| --- | --- |
| Sumber data live | ✅ OpenWeather via proxy `server.js` (One Call 4.0 + Current + 5-day/3-hour + Air Pollution) |
| Keamanan API key | ✅ Environment variable server-side; key tidak pernah masuk HTML/JS/JSON publik; `.env` di-gitignore |
| Interval refresh | ✅ Cache server 10 menit + polling UI setelahnya — sesuai anjuran update model OpenWeather |
| Fallback offline | ✅ `js/data.js` snapshot lokal yang ditandai jelas "fallback lokal · bukan live" |
| Fitur 10 Hari / Per Jam / Minute / Udara / Aktivitas | ✅ Live dengan degradasi jujur per modul |
| Radar | ⚠️ Tetap simulasi — Weather Maps/Global Precipitation Maps butuh produk terpisah |
| Per Bulan | ⚠️ Data contoh lokal Oktober 2026; timeline per bulan butuh One Call 4.0 |
| Responsivitas | ✅ Breakpoint 1200/900/768/480/360px, wrapping, scroll lokal, safe-area iPhone; belum uji fisik |

## Alur sinkronisasi

1. `server.js` memuat `OPENWEATHER_API_KEY` dari environment (via `.env` lokal atau secret platform).
2. Setiap permintaan `/api/weather`, server mengambil:
   - `GET /data/4.0/onecall/current` (1 record)
   - `GET /data/4.0/onecall/timeline/1min` (≤60 record)
   - `GET /data/4.0/onecall/timeline/1h` (≤20 record/halaman, maks. 3 halaman)
   - `GET /data/4.0/onecall/timeline/1day` (≤10 record)
   - `GET /data/2.5/air_pollution`
3. Hasil dinormalkan ke payload tunggal (suhu imperial dari API → UI memformat Celsius/Fahrenheit) dan di-cache **10 menit** untuk semua klien.
4. Bila One Call ditolak (401/403 = belum subscribe), server otomatis turun ke `GET /data/2.5/weather` + `GET /data/2.5/forecast` (5 hari / langkah 3 jam). Modul yang tidak tersedia **tidak dipalsukan** — `provider.modules.<modul>.live=false` + `error`.
5. UI (`js/app.js`) memanggil `/api/weather` saat load dan saat tombol refresh, menggabungkan payload ke `WEATHER_DATA` tanpa menyentuh data bulanan/radar lokal, lalu memperbarui banner status.

Catatan interval: model One Call 4.0 diperbarui setiap 10 menit; polling tiap beberapa detik tidak menambah kesegaran dan memboroskan kuota (1.000 call/hari gratis untuk One Call). Keputusan: cache 600 detik.

## Keamanan key

- Kunci yang diberikan pengguna **tidak ditulis ke file mana pun di repo**; hanya dipakai sebagai environment variable saat menjalankan server.
- `server.js` tidak meminta/mengembalikan URL berisi `appid` ke klien (body error provider tidak diteruskan; URL `next` disaring ke host `api.openweathermap.org` saja dan `appid` ditulis ulang dari env).
- Tes statis memastikan string key dan `appid=` tidak muncul di `index.html`, `js/*.js`, atau respons `/api/health`.
- Traversal path (`/../.env`, file titik) ditolak oleh static handler.
- Rekomendasi produksi: **rotate key** bila key pernah tampil di chat/log publik, lalu simpan hanya di secret manager platform deploy.

## Hasil verifikasi (12 Okt 2026)

- `node --test tests/*.test.js` — **23/23 lulus** (10 tes data/responsif + 11 tes server/keamanan + 2 tes e2e proxy dengan mock OpenWeather).
- `node --check` untuk `server.js`, `js/data.js`, `js/app.js`, `js/charts.js`, `js/radar.js` lulus.
- E2E membuktikan: payload One Call 4.0 → live UI shape (suhu, 10 hari, minutely, AQI 1–5); dan jalur degradasi tanpa One Call → `Current Weather Data API` + `5-day/3-hour` dengan `minuteCast.live=false`, `airQuality.error`, tanpa data rekaan.
- `git diff --check` lulus; HTML: ID unik, aset lokal tersedia, tautan eksternal `rel="noopener noreferrer"`.

## Batasan yang tersisa

1. **Radar live** belum ada: butuh langganan Weather Maps / Global Precipitation Maps (produk terpisah, sebagian di paket Developer+). UI tetap menandai simulasi.
2. **Timeline per bulan** otomatis butuh paginasi One Call 4.0 (`/data/4.0/onecall/timeline/1day?start=…&cnt=…` per bulan) — belum diminta per bulan untuk menghemat kuota; kalender memakai contoh lokal.
3. **AQI ≠ ISPU**: skala OpenWeather 1–5; untuk konteks Indonesia tetap rujuk ISPU KLHK.
4. **Uji visual perangkat fisik** (HP/iPhone/tablet) belum dilakukan; aturan responsif diverifikasi statis + smoke DOM.
5. Akses jaringan sandbox pengembangan ini memblokir `api.openweathermap.org`, sehingga uji live dilakukan terhadap mock provider lokal; jalur kode identik dengan produksi.

## Prasyarat publikasi

- Host Node.js (Railway/Render/Fly.io/VPS) dengan `OPENWEATHER_API_KEY` sebagai secret dan perintah `node server.js`.
- Subscribe "One Call by Call" di akun OpenWeather (1.000 call/hari gratis) untuk minute forecast, UV, dan prakiraan 10 hari; endpoint dasar tetap jalan tanpa subscribe.
- Setelah deploy, verifikasi `/api/health` (`configured: true`) dan `/api/weather` (`meta.live: true`) sebelum mengumumkan fitur live.
