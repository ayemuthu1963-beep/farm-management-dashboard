export type WeatherCurrent = {
  stationId: string
  observedAt: string
  observedAtLocal: string | null
  temperatureC: number | null
  feelsLikeC: number | null
  dewPointC: number | null
  humidityPct: number | null
  windSpeedKph: number | null
  windGustKph: number | null
  windDirectionDeg: number | null
  windDirectionCardinal: string | null
  pressureHpa: number | null
  rainfallRateMm: number | null
  rainfallTodayMm: number | null
  uvIndex: number | null
  solarRadiationWm2: number | null
}

export type WeatherHistoryDay = {
  date: string
  temperatureHighC: number | null
  temperatureLowC: number | null
  temperatureAverageC: number | null
  humidityAveragePct: number | null
  windSpeedAverageKph: number | null
  windGustHighKph: number | null
  rainfallMm: number | null
  pressureHighHpa: number | null
  pressureLowHpa: number | null
  uvHigh: number | null
}

export type WeatherCurrentResponse = {
  source: "Weather Underground PWS"
  stationId: string
  current: WeatherCurrent
}

export type WeatherHistoryResponse = {
  source: "Weather Underground PWS"
  stationId: string
  startDate: string
  endDate: string
  days: WeatherHistoryDay[]
}

export type WeatherApiErrorResponse = {
  error: string
}
