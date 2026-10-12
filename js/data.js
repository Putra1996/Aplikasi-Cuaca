/**
 * Snapshot cuaca Klumprit yang dicocokkan manual dengan halaman AccuWeather.
 * Data current, 10 hari, jam yang tersedia, dan AQI diperiksa 12 Okt 2026 21:37 WIB.
 * Ini snapshot bertimestamp, bukan koneksi API/live refresh. Radar, MinuteCast,
 * dan data bulanan tetap berstatus simulasi lokal.
 */

const WEATHER_DATA = {
  meta: {
    source: "AccuWeather web snapshot (dicocokkan manual)",
    live: false,
    temperatureUnit: "F",
    snapshotDate: "2026-10-12",
    snapshotTime: "21:37",
    snapshotTimezone: "WIB",
    snapshotLabel: "12 Oktober 2026, 21:37 WIB",
    currentWeatherUrl: "https://www.accuweather.com/id/id/klumprit/3454553/current-weather/3454553",
    weatherUrl: "https://www.accuweather.com/id/id/klumprit/3454553/weather-forecast/3454553",
    dailyForecastUrl: "https://www.accuweather.com/id/id/klumprit/3454553/10-day-weather-forecast/3454553",
    hourlyTodayUrl: "https://www.accuweather.com/id/id/klumprit/3454553/hourly-weather-forecast/3454553",
    hourlyTomorrowUrl: "https://www.accuweather.com/id/id/klumprit/3454553/hourly-weather-forecast/3454553?day=2",
    airQualityUrl: "https://www.accuweather.com/id/id/klumprit/3454553/air-quality-index/3454553"
  },

  location: {
    name: "Klumprit",
    region: "Jawa Tengah",
    country: "Indonesia",
    code: 3454553,
    latitude: -7.42,
    longitude: 109.24,
    timezone: "WIB (UTC+7)"
  },

  current: {
    date: "2026-10-12",
    observedAt: "21:37 WIB",
    temp: 76,
    feelsLike: 81,
    condition: "Awan berkabut",
    conditionCode: "37",
    icon: "37",
    high: 89,
    low: 72,
    humidity: 91,
    wind: { speed: 13, speedMph: 8, direction: "TTG", gust: 23, gustMph: 14, unit: "km/h" },
    rainChance: 6,
    rainWindow: "malam ini",
    visibility: 9.7,
    visibilityMiles: 6,
    uvIndex: null,
    uvDesc: "Tidak tersedia dari snapshot cuaca saat ini",
    sunrise: "05:22",
    sunset: "17:36"
  },

  // Prakiraan 10 hari; suhu mengikuti angka °F yang ditampilkan AccuWeather.
  // Kecepatan angin dikonversi dari mph ke km/jam; kelembapan tidak tersedia di ringkasan sumber.
  dailyForecast: [
    {
      date: "2026-10-12", day: "Sen", dayFull: "Senin", dateNum: 12,
      high: 89, low: 72, condition: "Berkabut", icon: "37",
      rainChance: 6, wind: 10, windMph: 6, humidity: null,
      uvIndex: null, today: true
    },
    {
      date: "2026-10-13", day: "Sel", dayFull: "Selasa", dateNum: 13,
      high: 87, low: 73, condition: "Berkabut", icon: "05",
      rainChance: 4, wind: 19, windMph: 12, humidity: null,
      uvIndex: 13
    },
    {
      date: "2026-10-14", day: "Rab", dayFull: "Rabu", dateNum: 14,
      high: 88, low: 73, condition: "Berkabut", icon: "05",
      rainChance: 25, wind: 16, windMph: 10, humidity: null,
      uvIndex: 13
    },
    {
      date: "2026-10-15", day: "Kam", dayFull: "Kamis", dateNum: 15,
      high: 88, low: 73, condition: "Semakin berawan", icon: "06",
      rainChance: 3, wind: 16, windMph: 10, humidity: null,
      uvIndex: 11
    },
    {
      date: "2026-10-16", day: "Jum", dayFull: "Jumat", dateNum: 16,
      high: 88, low: 74, condition: "Awan berganti menjadi sebagian cerah", icon: "04",
      rainChance: 5, wind: 16, windMph: 10, humidity: null,
      uvIndex: 7
    },
    {
      date: "2026-10-17", day: "Sab", dayFull: "Sabtu", dateNum: 17,
      high: 88, low: 74, condition: "Sebagian cerah", icon: "03",
      rainChance: 25, wind: 16, windMph: 10, humidity: null,
      uvIndex: 13
    },
    {
      date: "2026-10-18", day: "Min", dayFull: "Minggu", dateNum: 18,
      high: 89, low: 73, condition: "Sebagian cerah", icon: "03",
      rainChance: 55, wind: 16, windMph: 10, humidity: null,
      uvIndex: 13
    },
    {
      date: "2026-10-19", day: "Sen", dayFull: "Senin", dateNum: 19,
      high: 86, low: 69, condition: "Umumnya cerah", icon: "02",
      rainChance: 17, wind: 14, windMph: 9, humidity: null,
      uvIndex: 13
    },
    {
      date: "2026-10-20", day: "Sel", dayFull: "Selasa", dateNum: 20,
      high: 87, low: 71, condition: "Hujan singkat", icon: "14",
      rainChance: 55, wind: 13, windMph: 8, humidity: null,
      uvIndex: 12
    },
    {
      date: "2026-10-21", day: "Rab", dayFull: "Rabu", dateNum: 21,
      high: 88, low: 70, condition: "Cerah hingga sebagian berawan", icon: "02",
      rainChance: 3, wind: 11, windMph: 7, humidity: null,
      uvIndex: 12
    }
  ],

  // Semua berikut adalah nilai demonstrasi lokal, bukan observasi atau API live.
  minuteCast: {
    intervalMinutes: 5,
    precipitationProbability: [5, 5, 8, 12, 18, 25, 38, 52, 68, 75, 82, 80, 72, 65, 58, 50, 42, 35, 28, 20, 14, 10, 6, 5]
  },

  // Pengukuran AQI yang terlihat pada halaman AccuWeather saat snapshot diperiksa.
  airQuality: {
    scale: "AccuWeather AQI",
    index: 205,
    category: "Sangat Tidak Sehat",
    updatedAt: "2026-10-12T21:37:00+07:00",
    sourceUrl: "https://www.accuweather.com/id/id/klumprit/3454553/air-quality-index/3454553",
    advice: "Efek kesehatan dapat langsung terasa pada kelompok sensitif. Batasi kegiatan di luar ruang; orang sehat dapat mengalami kesulitan bernapas atau iritasi tenggorokan.",
    pollutants: [
      { name: "PM2.5", description: "Partikulat halus", value: 97, unit: "µg/m³", index: 205, category: "Sangat Tidak Sehat" },
      { name: "PM10", description: "Partikulat", value: 122, unit: "µg/m³", index: 126, category: "Tidak Sehat" },
      { name: "NO₂", description: "Nitrogen dioksida", value: 26, unit: "µg/m³", index: 50, category: "Buruk" },
      { name: "O₃", description: "Ozon permukaan", value: 63, unit: "µg/m³", index: 22, category: "Lumayan" },
      { name: "SO₂", description: "Sulfur dioksida", value: 5, unit: "µg/m³", index: 5, category: "Bagus Sekali" },
      { name: "CO", description: "Karbon monoksida", value: 324, unit: "µg/m³", index: 3, category: "Bagus Sekali" }
    ]
  },

  // Bingkai radar sintetis: posisi dan intensitas dinormalisasi 0–1.
  radarFrames: [
    { label: "Simulasi −60 menit", cells: [{ x: 0.18, y: 0.35, radius: 0.17, intensity: 0.38 }, { x: 0.78, y: 0.72, radius: 0.11, intensity: 0.22 }] },
    { label: "Simulasi −50 menit", cells: [{ x: 0.25, y: 0.38, radius: 0.17, intensity: 0.42 }, { x: 0.74, y: 0.68, radius: 0.12, intensity: 0.25 }] },
    { label: "Simulasi −40 menit", cells: [{ x: 0.32, y: 0.42, radius: 0.18, intensity: 0.48 }, { x: 0.69, y: 0.65, radius: 0.13, intensity: 0.28 }] },
    { label: "Simulasi −30 menit", cells: [{ x: 0.39, y: 0.46, radius: 0.18, intensity: 0.55 }, { x: 0.64, y: 0.61, radius: 0.14, intensity: 0.32 }] },
    { label: "Simulasi −20 menit", cells: [{ x: 0.46, y: 0.50, radius: 0.19, intensity: 0.62 }, { x: 0.59, y: 0.58, radius: 0.14, intensity: 0.38 }] },
    { label: "Simulasi −10 menit", cells: [{ x: 0.53, y: 0.53, radius: 0.20, intensity: 0.68 }, { x: 0.54, y: 0.55, radius: 0.13, intensity: 0.46 }] },
    { label: "Akhir simulasi", cells: [{ x: 0.60, y: 0.56, radius: 0.20, intensity: 0.72 }, { x: 0.49, y: 0.53, radius: 0.12, intensity: 0.42 }] }
  ],

  // Prakiraan per jam dari halaman AccuWeather yang sama; hari ini menampilkan jam tersisa.
  hourlyForecast: {
    today: [
      { time: "22:00", temp: 75, condition: "Langit malam cerah berkabut", icon: "37", rain: 0, humidity: 93, wind: 11, windMph: 7, gustKmh: 19 },
      { time: "23:00", temp: 75, condition: "Langit malam cerah berkabut", icon: "37", rain: 0, humidity: 94, wind: 11, windMph: 7, gustKmh: 19 }
    ],
    tomorrow: [
      { time: "00:00", temp: 74, condition: "Langit malam cerah berkabut", icon: "37", rain: 0, humidity: 94, wind: 10, windMph: 6, gustKmh: 19 },
      { time: "01:00", temp: 73, condition: "Langit malam cerah berkabut", icon: "37", rain: 0, humidity: 94, wind: 10, windMph: 6, gustKmh: 19 },
      { time: "02:00", temp: 72, condition: "Langit malam cerah berkabut", icon: "37", rain: 0, humidity: 95, wind: 10, windMph: 6, gustKmh: 19 },
      { time: "03:00", temp: 73, condition: "Langit malam cerah berkabut", icon: "37", rain: 0, humidity: 94, wind: 10, windMph: 6, gustKmh: 19 },
      { time: "04:00", temp: 73, condition: "Langit malam cerah berkabut", icon: "37", rain: 0, humidity: 93, wind: 10, windMph: 6, gustKmh: 19 },
      { time: "05:00", temp: 74, condition: "Langit malam cerah berkabut", icon: "37", rain: 0, humidity: 92, wind: 10, windMph: 6, gustKmh: 21 },
      { time: "06:00", temp: 75, condition: "Cerah berkabut", icon: "05", rain: 0, humidity: 88, wind: 11, windMph: 7, gustKmh: 23 },
      { time: "07:00", temp: 77, condition: "Cerah berkabut", icon: "05", rain: 0, humidity: 83, wind: 11, windMph: 7, gustKmh: 23 },
      { time: "08:00", temp: 80, condition: "Cerah berkabut", icon: "05", rain: 0, humidity: 76, wind: 13, windMph: 8, gustKmh: 26 },
      { time: "09:00", temp: 83, condition: "Cerah berkabut", icon: "05", rain: 0, humidity: 69, wind: 16, windMph: 10, gustKmh: 27 },
      { time: "10:00", temp: 85, condition: "Cerah berkabut", icon: "05", rain: 0, humidity: 64, wind: 19, windMph: 12, gustKmh: 32 },
      { time: "11:00", temp: 86, condition: "Cerah berkabut", icon: "05", rain: 0, humidity: 62, wind: 21, windMph: 13, gustKmh: 34 },
      { time: "12:00", temp: 87, condition: "Cerah berkabut", icon: "05", rain: 0, humidity: 61, wind: 23, windMph: 14, gustKmh: 35 },
      { time: "13:00", temp: 86, condition: "Cerah berkabut", icon: "05", rain: 0, humidity: 64, wind: 23, windMph: 14, gustKmh: 37 },
      { time: "14:00", temp: 85, condition: "Cerah berkabut", icon: "05", rain: 0, humidity: 65, wind: 23, windMph: 14, gustKmh: 34 },
      { time: "15:00", temp: 84, condition: "Cerah berkabut", icon: "05", rain: 0, humidity: 68, wind: 21, windMph: 13, gustKmh: 32 },
      { time: "16:00", temp: 82, condition: "Cerah berkabut", icon: "05", rain: 0, humidity: 71, wind: 19, windMph: 12, gustKmh: 29 },
      { time: "17:00", temp: 81, condition: "Cerah berkabut", icon: "05", rain: 0, humidity: 75, wind: 16, windMph: 10, gustKmh: 27 },
      { time: "18:00", temp: 78, condition: "Langit malam cerah berkabut", icon: "37", rain: 0, humidity: 83, wind: 14, windMph: 9, gustKmh: 26 },
      { time: "19:00", temp: 77, condition: "Langit malam cerah berkabut", icon: "37", rain: 0, humidity: 86, wind: 13, windMph: 8, gustKmh: 24 },
      { time: "20:00", temp: 76, condition: "Langit malam cerah berkabut", icon: "37", rain: 0, humidity: 89, wind: 11, windMph: 7, gustKmh: 23 },
      { time: "21:00", temp: 76, condition: "Langit malam cerah berkabut", icon: "37", rain: 0, humidity: 91, wind: 11, windMph: 7, gustKmh: 23 },
      { time: "22:00", temp: 75, condition: "Langit malam cerah berkabut", icon: "37", rain: 0, humidity: 92, wind: 11, windMph: 7, gustKmh: 21 },
      { time: "23:00", temp: 75, condition: "Langit malam cerah berkabut", icon: "37", rain: 0, humidity: 92, wind: 10, windMph: 6, gustKmh: 21 }
    ]
  },

  // Satu-satunya bulan yang memiliki dataset lokal demonstrasi.
  monthlyMonth: { year: 2026, month: 10 },
  // Data Bulanan Oktober 2026 (31 hari)
  monthlyData: [
    { date: 1, day: "Kam", high: 86, low: 78, condition: "Berkabut", icon: "05", rain: 40 },
    { date: 2, day: "Jum", high: 87, low: 77, condition: "Berkabut", icon: "05", rain: 35 },
    { date: 3, day: "Sab", high: 86, low: 78, condition: "Berkabut", icon: "05", rain: 40 },
    { date: 4, day: "Min", high: 86, low: 78, condition: "Berkabut", icon: "05", rain: 38 },
    { date: 5, day: "Sen", high: 86, low: 78, condition: "Berkabut", icon: "05", rain: 42 },
    { date: 6, day: "Sel", high: 85, low: 77, condition: "Berkabut", icon: "05", rain: 45 },
    { date: 7, day: "Rab", high: 86, low: 77, condition: "Berkabut", icon: "05", rain: 40 },
    { date: 8, day: "Kam", high: 87, low: 76, condition: "Berkabut", icon: "05", rain: 35 },
    { date: 9, day: "Jum", high: 86, low: 78, condition: "Berkabut", icon: "05", rain: 38 },
    { date: 10, day: "Sab", high: 86, low: 78, condition: "Berkabut", icon: "05", rain: 40 },
    { date: 11, day: "Min", high: null, low: null, condition: "Tidak tersedia", icon: "na", rain: null },
    { date: 12, day: "Sen", high: 89, low: 72, condition: "Berkabut", icon: "05", rain: 40, today: true },
    { date: 13, day: "Sel", high: 87, low: 73, condition: "Berkabut", icon: "05", rain: 35 },
    { date: 14, day: "Rab", high: 88, low: 73, condition: "Berkabut", icon: "05", rain: 30 },
    { date: 15, day: "Kam", high: 88, low: 73, condition: "Semakin berawan", icon: "06", rain: 45 },
    { date: 16, day: "Jum", high: 88, low: 74, condition: "Berawan terputus-putus", icon: "04", rain: 50 },
    { date: 17, day: "Sab", high: 88, low: 74, condition: "Sebagian cerah", icon: "03", rain: 25 },
    { date: 18, day: "Min", high: 89, low: 73, condition: "Sebagian cerah", icon: "03", rain: 20 },
    { date: 19, day: "Sen", high: 86, low: 69, condition: "Umumnya cerah", icon: "02", rain: 10 },
    { date: 20, day: "Sel", high: 87, low: 71, condition: "Hujan singkat", icon: "14", rain: 65 },
    { date: 21, day: "Rab", high: 91, low: 70, condition: "Cerah hingga sebagian berawan", icon: "02", rain: 15 },
    { date: 22, day: "Kam", high: 90, low: 71, condition: "Sedikit hujan", icon: "13", rain: 55 },
    { date: 23, day: "Jum", high: 91, low: 70, condition: "Cerah berawan", icon: "04", rain: 20 },
    { date: 24, day: "Sab", high: 90, low: 69, condition: "Umumnya berawan", icon: "06", rain: 30 },
    { date: 25, day: "Min", high: 87, low: 70, condition: "Bergantian berawan dan cerah", icon: "04", rain: 35 },
    { date: 26, day: "Sen", high: 88, low: 70, condition: "Berawan", icon: "07", rain: 40 },
    { date: 27, day: "Sel", high: 88, low: 71, condition: "Berawan", icon: "07", rain: 38 },
    { date: 28, day: "Rab", high: 87, low: 70, condition: "Cerah berawan", icon: "04", rain: 25 },
    { date: 29, day: "Kam", high: 88, low: 71, condition: "Hujan singkat", icon: "14", rain: 60 },
    { date: 30, day: "Jum", high: 86, low: 72, condition: "Hujan singkat", icon: "14", rain: 55 },
    { date: 31, day: "Sab", high: 86, low: 71, condition: "Cerah berawan", icon: "04", rain: 20 }
  ],

  // Konversi suhu
  toCelsius: function(f) {
    return Math.round((f - 32) * 5 / 9);
  },

  toFahrenheit: function(c) {
    return Math.round(c * 9 / 5 + 32);
  }
};