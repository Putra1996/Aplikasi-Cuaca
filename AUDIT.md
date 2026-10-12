# Audit mendalam CuacaKu

**Tanggal:** 12 Oktober 2026

**Cakupan:** konsistensi sumber dan satuan cuaca, kelengkapan/null data, AQI, fitur, navigasi, HTML, aksesibilitas dasar, responsivitas, dan pemeriksaan kode.

**Lokasi snapshot:** Klumprit, Jawa Tengah · AccuWeather location key `3454553`.

## Ringkasan eksekutif

Audit sumber menemukan ketidaksesuaian utama: kondisi AccuWeather menunjukkan **76°F (24,4°C)** pada 12 Oktober 2026 pukul **21:37 WIB**, tetapi aplikasi sebelumnya memakai 86°F dan menampilkan sekitar **30°C**. Data kondisi saat ini, prakiraan 10 hari, entri jam yang tersedia, dan kualitas udara sekarang dicocokkan ulang sebagai satu snapshot bertimestamp. Aplikasi menampilkan 76°F sebagai **24°C** pada satuan Celsius.

Aplikasi tidak menarik data cuaca live. Cuaca/AQI adalah snapshot yang dicocokkan manual dan tautan sumber disediakan; radar, MinuteCast, dan kalender bulanan tetap diberi label sebagai simulasi/contoh lokal. Kualitas udara menggunakan skala **AccuWeather AQI**, bukan ISPU. Nilai yang tidak ada di sumber tidak lagi diisi dengan angka rekaan.

## Audit data sumber

| Bagian | Hasil audit dan perlakuan |
|---|---|
| Kondisi saat ini | 76°F → 24°C; RealFeel 81°F → 27°C; kelembapan 91%; angin 8 mph → 13 km/jam dengan gust 14 mph → 23 km/jam; visibilitas 6 mil → 9,7 km; peluang hujan malam 6%; sunrise 05:22 dan sunset 17:36 WIB. |
| Prakiraan 10 hari | Nilai tinggi/rendah, kondisi, peluang hujan, angin, dan UV disinkronkan untuk 12–21 Oktober 2026. Nilai Fahrenheit sumber dikonversi hanya saat ditampilkan. Kelembapan yang tidak tersedia pada ringkasan sumber bernilai `null` dan ditampilkan `—`; UV hari ini juga tidak tersedia. |
| Prakiraan per jam | Snapshot hari ini diambil pukul 21:37 sehingga hanya jam 22:00 dan 23:00 yang tersisa. Prakiraan hari berikutnya berisi 00:00–23:00. Kedua tanggal tidak dipaksakan memiliki jumlah sampel yang sama. |
| Kualitas udara | AQI 205, kategori **Sangat Tidak Sehat**, beserta enam konsentrasi dan sub-indeks polutan. Label/skala UI diubah dari ISPU lama ke AccuWeather AQI. Timestamp snapshot dan tautan halaman sumber terlihat di UI. |
| Radar dan MinuteCast | Bingkai radar dan peluang MinuteCast bukan hasil sensor/API. Keduanya tetap simulasi lokal, diberi keterangan bukan data live; label bingkai radar juga menyebut simulasi. |
| Bulanan | Dataset lokal Oktober 2026 bukan bagian dari snapshot prakiraan 10 hari. Data ini tetap ditandai contoh, hanya bulan yang tersedia ditampilkan, dan tanggal tanpa nilai dipertahankan sebagai kosong. |

Snapshot dan URL asal dicatat di `js/data.js`; penjelasan keterbatasan ada di banner, halaman fitur, README, dan audit ini. Snapshot tidak diperbarui otomatis dan bukan dasar tunggal untuk keputusan kesehatan atau perjalanan.

## Temuan penting dan perbaikan

| Prioritas | Temuan | Perbaikan |
|---|---|---|
| **Kritis untuk akurasi** | Suhu saat ini 30°C berbeda dari 24°C pada halaman sumber; data lama memakai angka/label yang tidak sinkron. | Kondisi saat ini dan data prakiraan terkait diganti ke snapshot 12 Okt 2026 21:37 WIB; konversi Fahrenheit → Celsius diuji. |
| **Tinggi** | Label “ISPU” dipakai untuk angka AQI AccuWeather sehingga skala dan kategorinya dapat disalahartikan. | Label, panduan kategori, tabel polutan, ringkasan, dan fitur kesehatan menggunakan istilah AccuWeather AQI. |
| **Tinggi** | Nilai yang tidak tersedia sebelumnya dapat terlihat seolah-olah terukur; data per jam dianggap selalu 24 entri. | UV saat ini dan kelembapan prakiraan yang hilang menjadi `null`/“Tidak tersedia”; renderer mempertahankan nilai kosong; tes membedakan 2 jam tersisa hari ini dari 24 jam esok. |
| **Tinggi** | Timestamp dan status simulasi kurang tegas sehingga data statis berisiko dianggap live. | Banner global menyatakan waktu snapshot; kondisi, AQI, prakiraan, README, dan halaman Tentang menjelaskan bahwa tidak ada refresh API. Tombol refresh hanya menggambar ulang. |
| **Tinggi** | Skor aktivitas menganggap UV hilang sama dengan UV nol dan tidak mencerminkan AQI sangat tidak sehat. | UV hilang diberi penalti konservatif dan diungkapkan. Saran mengutamakan menunda aktivitas luar ruang saat AQI snapshot sangat tidak sehat; skor diberi disclaimer nonmedis. |
| **Sedang** | Prakiraan hari ini/esok tidak memiliki cakupan jam simetris. | Label tab kini menjelaskan sisa malam 12 Okt dan tanggal 13 Okt; jumlah entri sumber asli dipertahankan. |
| **Sedang** | Radar sintetis bisa terlihat seperti jejak observasi menit sebelumnya. | Panel diberi badge bukan radar live dan label timeline/bingkai secara eksplisit menyebut simulasi. |

## Cakupan fitur

- **10 Hari:** 10 tanggal berurutan, detail harian yang dapat dibuka, rentang suhu, peluang hujan, angin, nilai UV/kelembapan jika tersedia, dan grafik suhu.
- **Radar:** kanvas peta skematis, tujuh bingkai lokal, timeline, play/pause, pilihan layer, geser, zoom, dan reset. Tidak mengambil radar atau tile eksternal.
- **MinuteCast®:** visualisasi peluang presipitasi per 5 menit untuk jendela 30/60/120 menit; bukan nowcast aktual.
- **Per Bulan:** pemilih bulan, kalender, ringkasan, tabel, dan grafik suhu/peluang hujan. Hanya contoh Oktober 2026 yang tersedia.
- **Kualitas Udara:** AccuWeather AQI, kategori, timestamp, saran kehati-hatian, serta konsentrasi dan sub-indeks PM2.5/PM10/NO₂/O₃/SO₂/CO.
- **Kesehatan & Aktivitas:** indikator UV/RealFeel/AQI/hujan dan skor heuristik empat aktivitas dengan penanganan data hilang.
- **Suhu:** Celsius adalah satuan awal; tombol °C/°F tersedia pada desktop dan seluler dan preferensi disimpan jika storage diizinkan.

## Verifikasi

Pemeriksaan final pada checkout ini lulus:

- `node --test tests/weather-data.test.js` — **9/9 lulus**, termasuk metadata sumber, snapshot suhu 24°C, default Celsius, sepuluh tanggal, jam parsial vs penuh, null handling, AQI/polutan, batasan dataset bulanan, simulasi radar/MinuteCast, tautan, dan tab fitur.
- `node --check js/data.js`, `js/app.js`, `js/charts.js`, `js/radar.js` — seluruhnya lulus.
- `git diff --check` — lulus.
- Parser struktur HTML — **89 ID unik**, 7 aset script/style lokal ada, dan 11 tautan `target="_blank"` memakai `noopener noreferrer`.
- Smoke test DOM menggunakan Happy DOM — tampilan 24°C/RealFeel 27°C, AQI 205, 10 hari, dua jam tersisa, enam polutan, empat aktivitas, dan default Celsius terverifikasi. Interaksi °C/°F desktop/seluler, dua tab jam, navigasi AQI/radar, putar/jeda simulasi radar, empty state/reset bulan, serta tombol refresh (tanpa fetch data baru) juga lulus.
- Server preview mengembalikan HTTP 200 untuk HTML, CSS fitur, dan semua berkas JavaScript aplikasi.

## Risiko tersisa / prasyarat produksi

1. **Bukan feed live.** Snapshot dapat usang segera setelah diperiksa. Integrasi produksi perlu provider dan lisensi yang sesuai, backend/proxy untuk kredensial, timeout, fallback, batas kuota, serta status usia data.
2. **AQI snapshot bukan pemantauan lokal real-time.** Ambang/kategori harus selalu dijelaskan sesuai sumber; jangan menyebutnya ISPU atau menggantikan arahan otoritas Indonesia.
3. **Radar, MinuteCast, dan data bulanan masih contoh.** Jangan menggunakan ketiganya untuk keputusan. Produksi memerlukan sumber yang sah, sinkronisasi waktu, atribusi, dan cakupan geografis tervalidasi.
4. **Titik koordinat lokasi diwarisi dari repository (`−7.42, 109.24`, perkiraan).** Verifikasi koordinat Klumprit yang tepat sebelum menggunakannya untuk produk lokasi presisi.
5. Belum ada pengujian browser/E2E permanen, monitoring, maupun evaluasi aksesibilitas manual pada perangkat fisik. Tes Node dan smoke test tidak menggantikan uji lintas-browser.
