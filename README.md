# CuacaKu — Dashboard Cuaca Klumprit

Dashboard cuaca responsif untuk Klumprit, Jawa Tengah, dibuat dengan HTML, CSS, dan JavaScript vanilla tanpa dependensi runtime. Cuaca saat ini, prakiraan, dan kualitas udara di bundel ini dicocokkan manual dengan halaman AccuWeather; aplikasi **tidak** memuat feed atau API live.

## Fitur

- Kondisi saat ini, peringatan, dan prakiraan ringkas 5 hari.
- **Prakiraan 10 Hari** dengan detail harian, rentang suhu, hujan, angin, serta nilai kelembapan/UV yang tersedia.
- Prakiraan per jam untuk sisa malam 12 Oktober dan 24 jam pada 13 Oktober 2026.
- **Kualitas Udara** dengan AccuWeather AQI, kategori sumber, konsentrasi polutan, sub-indeks, timestamp, dan saran kehati-hatian.
- **Kesehatan & Aktivitas** dengan faktor cuaca/AQI dan skor heuristik; data UV yang hilang tidak diperlakukan sebagai UV nol.
- **MinuteCast** ilustratif dengan pilihan jendela 30, 60, dan 120 menit.
- **Radar** skematis dengan timeline simulasi, play/pause, layer, drag, zoom, dan reset.
- **Per Bulan** dengan kalender, ringkasan, tabel, grafik suhu/hujan, dan pemilih bulan.
- Satuan **Celsius sebagai default**; pengguna dapat beralih ke Fahrenheit dan preferensi disimpan di `localStorage`.
- Navigasi dan kontrol responsif untuk layar kecil.

## Sumber dan batasan data

Kondisi saat ini, prakiraan 10 hari, jam yang tersedia, dan AQI dicocokkan manual terhadap halaman AccuWeather untuk Klumprit (location key `3454553`) pada **12 Oktober 2026, pukul 21:37 WIB**. Nilai itu adalah snapshot bertimestamp, bukan kondisi yang terus diperbarui. Temperatur sumber disimpan dalam Fahrenheit dan diformat ke Celsius di antarmuka secara default; misalnya 76°F ditampilkan sebagai **24°C**.

- Kelembapan pada ringkasan prakiraan 10 hari dan indeks UV kondisi saat ini tidak tersedia; UI menampilkan `—`/“Tidak tersedia”, bukan nilai rekaan.
- Halaman per jam hari ini hanya menyisakan entri 22:00 dan 23:00 karena snapshot diperiksa pukul 21:37. Data esok hari mencakup 00:00–23:00.
- Angka kualitas udara menggunakan **AccuWeather AQI**, bukan ISPU Indonesia. Kategori dan nilai polutan adalah cuplikan dari halaman sumber pada timestamp tersebut.
- Radar dan MinuteCast adalah simulasi/ilustrasi lokal, bukan radar atau nowcast aktual. Dataset kalender bulanan hanya contoh lokal untuk Oktober 2026 dan tidak bersumber dari snapshot prakiraan 10 hari.
- Skor aktivitas adalah heuristik antarmuka, bukan penilaian medis atau jaminan keselamatan. Ikuti pengumuman otoritas dan periksa sumber resmi sebelum mengambil keputusan.

Tautan sumber resmi ditampilkan di dalam aplikasi dan dicatat pada `js/data.js`. Cuaca saat ini: [AccuWeather](https://www.accuweather.com/id/id/klumprit/3454553/current-weather/3454553) · 10 hari: [AccuWeather](https://www.accuweather.com/id/id/klumprit/3454553/10-day-weather-forecast/3454553) · kualitas udara: [AccuWeather](https://www.accuweather.com/id/id/klumprit/3454553/air-quality-index/3454553).

## Menjalankan lokal

Dari root repository:

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Lalu buka `http://localhost:8000`. Semua aset aplikasi lokal; koneksi internet hanya digunakan untuk font web opsional dan membuka tautan sumber.

## Pemeriksaan

```sh
node --test tests/weather-data.test.js
node --check js/data.js
node --check js/app.js
node --check js/charts.js
node --check js/radar.js
git diff --check
```

Lihat [`AUDIT.md`](AUDIT.md) untuk temuan audit, verifikasi yang dilakukan, batasan yang masih ada, dan kebutuhan sebelum integrasi produksi/live.
