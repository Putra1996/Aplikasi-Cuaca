/**
 * Data cuaca untuk Klumprit, Jawa Tengah, Indonesia
 * Sumber: AccuWeather (https://www.accuweather.com/id/id/klumprit/3454553)
 * Data untuk Oktober 2026
 */

const WEATHER_DATA = {
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
    date: "Minggu, 12 Oktober 2026",
    temp: 86,
    feelsLike: 92,
    condition: "Berkabut",
    conditionCode: "05",
    icon: "https://www.accuweather.com/images/weathericons/v2a/05.svg",
    high: 89,
    low: 72,
    humidity: 78,
    wind: { speed: 8, direction: "SE", unit: "km/h" },
    rainChance: 40,
    visibility: 10,
    uvIndex: 11,
    uvDesc: "Ekstrem",
    sunrise: "05:28",
    sunset: "17:42",
    pressure: 1012,
    dewPoint: 75,
    cloudCover: 65
  },

  // Prakiraan 10 Hari (12-21 Oktober 2026)
  dailyForecast: [
    {
      date: "2026-10-12",
      day: "Min",
      dayFull: "Minggu",
      dateNum: 12,
      high: 89,
      low: 72,
      condition: "Berkabut",
      icon: "https://www.accuweather.com/images/weathericons/v2a/05.svg",
      rainChance: 40,
      wind: 8,
      humidity: 78,
      uvIndex: 11,
      today: true
    },
    {
      date: "2026-10-13",
      day: "Sen",
      dayFull: "Senin",
      dateNum: 13,
      high: 87,
      low: 73,
      condition: "Berkabut",
      icon: "https://www.accuweather.com/images/weathericons/v2a/05.svg",
      rainChance: 35,
      wind: 10,
      humidity: 76,
      uvIndex: 10
    },
    {
      date: "2026-10-14",
      day: "Sel",
      dayFull: "Selasa",
      dateNum: 14,
      high: 88,
      low: 73,
      condition: "Berkabut",
      icon: "https://www.accuweather.com/images/weathericons/v2a/05.svg",
      rainChance: 30,
      wind: 9,
      humidity: 74,
      uvIndex: 11
    },
    {
      date: "2026-10-15",
      day: "Rab",
      dayFull: "Rabu",
      dateNum: 15,
      high: 88,
      low: 73,
      condition: "Semakin berawan",
      icon: "https://www.accuweather.com/images/weathericons/v2a/06.svg",
      rainChance: 45,
      wind: 11,
      humidity: 77,
      uvIndex: 9
    },
    {
      date: "2026-10-16",
      day: "Kam",
      dayFull: "Kamis",
      dateNum: 16,
      high: 88,
      low: 74,
      condition: "Berawan terputus-putus",
      icon: "https://www.accuweather.com/images/weathericons/v2a/04.svg",
      rainChance: 50,
      wind: 12,
      humidity: 80,
      uvIndex: 8
    },
    {
      date: "2026-10-17",
      day: "Jum",
      dayFull: "Jumat",
      dateNum: 17,
      high: 88,
      low: 74,
      condition: "Sebagian cerah",
      icon: "https://www.accuweather.com/images/weathericons/v2a/03.svg",
      rainChance: 25,
      wind: 10,
      humidity: 72,
      uvIndex: 10
    },
    {
      date: "2026-10-18",
      day: "Sab",
      dayFull: "Sabtu",
      dateNum: 18,
      high: 89,
      low: 73,
      condition: "Sebagian cerah",
      icon: "https://www.accuweather.com/images/weathericons/v2a/03.svg",
      rainChance: 20,
      wind: 9,
      humidity: 70,
      uvIndex: 11
    },
    {
      date: "2026-10-19",
      day: "Min",
      dayFull: "Minggu",
      dateNum: 19,
      high: 86,
      low: 69,
      condition: "Umumnya cerah",
      icon: "https://www.accuweather.com/images/weathericons/v2a/02.svg",
      rainChance: 10,
      wind: 8,
      humidity: 65,
      uvIndex: 11
    },
    {
      date: "2026-10-20",
      day: "Sen",
      dayFull: "Senin",
      dateNum: 20,
      high: 87,
      low: 71,
      condition: "Hujan singkat",
      icon: "https://www.accuweather.com/images/weathericons/v2a/14.svg",
      rainChance: 65,
      wind: 14,
      humidity: 82,
      uvIndex: 7
    },
    {
      date: "2026-10-21",
      day: "Sel",
      dayFull: "Selasa",
      dateNum: 21,
      high: 91,
      low: 70,
      condition: "Cerah hingga sebagian berawan",
      icon: "https://www.accuweather.com/images/weathericons/v2a/02.svg",
      rainChance: 15,
      wind: 7,
      humidity: 68,
      uvIndex: 11
    }
  ],

  // Data Per Jam (Hari Ini - 12 Oktober)
  hourlyForecast: {
    today: [
      { time: "00:00", temp: 74, condition: "Cerah", icon: "01", rain: 5, humidity: 85, wind: 5 },
      { time: "01:00", temp: 73, condition: "Cerah", icon: "01", rain: 5, humidity: 86, wind: 4 },
      { time: "02:00", temp: 73, condition: "Cerah", icon: "01", rain: 3, humidity: 87, wind: 4 },
      { time: "03:00", temp: 72, condition: "Cerah", icon: "01", rain: 3, humidity: 88, wind: 3 },
      { time: "04:00", temp: 72, condition: "Cerah Berawan", icon: "02", rain: 5, humidity: 88, wind: 3 },
      { time: "05:00", temp: 72, condition: "Cerah Berawan", icon: "02", rain: 8, humidity: 87, wind: 4 },
      { time: "06:00", temp: 74, condition: "Berkabut", icon: "05", rain: 15, humidity: 85, wind: 5 },
      { time: "07:00", temp: 77, condition: "Berkabut", icon: "05", rain: 20, humidity: 82, wind: 6 },
      { time: "08:00", temp: 80, condition: "Berkabut", icon: "05", rain: 25, humidity: 78, wind: 7 },
      { time: "09:00", temp: 83, condition: "Berkabut", icon: "05", rain: 30, humidity: 75, wind: 8 },
      { time: "10:00", temp: 85, condition: "Berkabut", icon: "05", rain: 35, humidity: 72, wind: 9 },
      { time: "11:00", temp: 87, condition: "Berkabut", icon: "05", rain: 40, humidity: 70, wind: 10 },
      { time: "12:00", temp: 88, condition: "Berkabut", icon: "05", rain: 40, humidity: 68, wind: 10 },
      { time: "13:00", temp: 89, condition: "Berkabut", icon: "05", rain: 38, humidity: 66, wind: 11 },
      { time: "14:00", temp: 89, condition: "Berkabut", icon: "05", rain: 35, humidity: 65, wind: 10 },
      { time: "15:00", temp: 88, condition: "Berkabut", icon: "05", rain: 30, humidity: 68, wind: 9 },
      { time: "16:00", temp: 86, condition: "Berkabut", icon: "05", rain: 28, humidity: 72, wind: 8 },
      { time: "17:00", temp: 83, condition: "Cerah Berawan", icon: "02", rain: 20, humidity: 76, wind: 7 },
      { time: "18:00", temp: 80, condition: "Cerah", icon: "01", rain: 10, humidity: 80, wind: 6 },
      { time: "19:00", temp: 78, condition: "Cerah", icon: "01", rain: 8, humidity: 82, wind: 5 },
      { time: "20:00", temp: 77, condition: "Cerah", icon: "01", rain: 5, humidity: 84, wind: 5 },
      { time: "21:00", temp: 76, condition: "Cerah", icon: "01", rain: 5, humidity: 85, wind: 4 },
      { time: "22:00", temp: 75, condition: "Cerah", icon: "01", rain: 3, humidity: 86, wind: 4 },
      { time: "23:00", temp: 75, condition: "Cerah", icon: "01", rain: 3, humidity: 86, wind: 3 }
    ],
    tomorrow: [
      { time: "00:00", temp: 74, condition: "Cerah", icon: "01", rain: 5, humidity: 84, wind: 4 },
      { time: "01:00", temp: 74, condition: "Cerah", icon: "01", rain: 3, humidity: 85, wind: 3 },
      { time: "02:00", temp: 73, condition: "Cerah", icon: "01", rain: 3, humidity: 86, wind: 3 },
      { time: "03:00", temp: 73, condition: "Cerah Berawan", icon: "02", rain: 5, humidity: 87, wind: 4 },
      { time: "04:00", temp: 73, condition: "Cerah Berawan", icon: "02", rain: 8, humidity: 86, wind: 4 },
      { time: "05:00", temp: 73, condition: "Berkabut", icon: "05", rain: 12, humidity: 85, wind: 5 },
      { time: "06:00", temp: 75, condition: "Berkabut", icon: "05", rain: 18, humidity: 83, wind: 6 },
      { time: "07:00", temp: 78, condition: "Berkabut", icon: "05", rain: 22, humidity: 80, wind: 7 },
      { time: "08:00", temp: 80, condition: "Berkabut", icon: "05", rain: 28, humidity: 77, wind: 8 },
      { time: "09:00", temp: 83, condition: "Berkabut", icon: "05", rain: 30, humidity: 74, wind: 9 },
      { time: "10:00", temp: 85, condition: "Berkabut", icon: "05", rain: 32, humidity: 71, wind: 9 },
      { time: "11:00", temp: 86, condition: "Berkabut", icon: "05", rain: 35, humidity: 69, wind: 10 },
      { time: "12:00", temp: 87, condition: "Berkabut", icon: "05", rain: 35, humidity: 68, wind: 10 },
      { time: "13:00", temp: 87, condition: "Berkabut", icon: "05", rain: 33, humidity: 67, wind: 10 },
      { time: "14:00", temp: 87, condition: "Berkabut", icon: "05", rain: 30, humidity: 68, wind: 9 },
      { time: "15:00", temp: 86, condition: "Berkabut", icon: "05", rain: 28, humidity: 70, wind: 9 },
      { time: "16:00", temp: 84, condition: "Cerah Berawan", icon: "02", rain: 22, humidity: 73, wind: 8 },
      { time: "17:00", temp: 82, condition: "Cerah Berawan", icon: "02", rain: 15, humidity: 77, wind: 7 },
      { time: "18:00", temp: 79, condition: "Cerah", icon: "01", rain: 8, humidity: 80, wind: 6 },
      { time: "19:00", temp: 77, condition: "Cerah", icon: "01", rain: 5, humidity: 82, wind: 5 },
      { time: "20:00", temp: 76, condition: "Cerah", icon: "01", rain: 5, humidity: 83, wind: 5 },
      { time: "21:00", temp: 75, condition: "Cerah", icon: "01", rain: 3, humidity: 84, wind: 4 },
      { time: "22:00", temp: 74, condition: "Cerah", icon: "01", rain: 3, humidity: 85, wind: 4 },
      { time: "23:00", temp: 74, condition: "Cerah", icon: "01", rain: 3, humidity: 85, wind: 3 }
    ]
  },

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

  // Cuaca 5 hari ke depan (untuk tab beranda)
  fiveDayForecast: [
    { day: "Hari Ini", date: "12 Okt", high: 89, low: 72, condition: "Berkabut", icon: "https://www.accuweather.com/images/weathericons/v2a/05.svg", today: true },
    { day: "Senin", date: "13 Okt", high: 87, low: 73, condition: "Berkabut", icon: "https://www.accuweather.com/images/weathericons/v2a/05.svg" },
    { day: "Selasa", date: "14 Okt", high: 88, low: 73, condition: "Berkabut", icon: "https://www.accuweather.com/images/weathericons/v2a/05.svg" },
    { day: "Rabu", date: "15 Okt", high: 88, low: 73, condition: "Semakin berawan", icon: "https://www.accuweather.com/images/weathericons/v2a/06.svg" },
    { day: "Kamis", date: "16 Okt", high: 88, low: 74, condition: "Berawan terputus-putus", icon: "https://www.accuweather.com/images/weathericons/v2a/04.svg" }
  ],

  // Konversi suhu
  toCelsius: function(f) {
    return Math.round((f - 32) * 5 / 9);
  },

  toFahrenheit: function(c) {
    return Math.round(c * 9 / 5 + 32);
  }
};