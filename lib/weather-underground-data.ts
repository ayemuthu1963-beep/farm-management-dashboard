import type { WeatherCurrent, WeatherHistoryDay } from "@/lib/weather-types"

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function getObject(value: unknown): JsonObject {
  return isObject(value) ? value : {}
}

export function degreesToCardinal(degrees: number | null): string | null {
  if (degrees === null || !Number.isFinite(degrees)) return null
  const directions = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ]
  const normalized = ((degrees % 360) + 360) % 360
  return directions[Math.round(normalized / 22.5) % directions.length]
}

export function normalizeCurrentWeather(payload: unknown, fallbackStationId: string): WeatherCurrent {
  const root = getObject(payload)
  const observations = Array.isArray(root.observations) ? root.observations : []
  const observation = getObject(observations[0])
  const metric = getObject(observation.metric)
  const observedAt = asString(observation.obsTimeUtc)

  if (!observedAt) throw new Error("Invalid Weather Underground current response")

  const temperatureC = asNumber(metric.temp)
  const heatIndexC = asNumber(metric.heatIndex)
  const windChillC = asNumber(metric.windChill)
  const windDirectionDeg = asNumber(observation.winddir)
  const feelsLikeC =
    temperatureC !== null && temperatureC >= 27
      ? heatIndexC ?? temperatureC
      : temperatureC !== null && temperatureC <= 10
        ? windChillC ?? temperatureC
        : temperatureC

  return {
    stationId: asString(observation.stationID) ?? fallbackStationId,
    observedAt,
    observedAtLocal: asString(observation.obsTimeLocal),
    temperatureC,
    feelsLikeC,
    dewPointC: asNumber(metric.dewpt),
    humidityPct: asNumber(observation.humidity),
    windSpeedKph: asNumber(metric.windSpeed),
    windGustKph: asNumber(metric.windGust),
    windDirectionDeg,
    windDirectionCardinal: degreesToCardinal(windDirectionDeg),
    pressureHpa: asNumber(metric.pressure),
    rainfallRateMm: asNumber(metric.precipRate),
    rainfallTodayMm: asNumber(metric.precipTotal),
    uvIndex: asNumber(observation.uv),
    solarRadiationWm2: asNumber(observation.solarRadiation),
  }
}

function normalizeHistoryDate(summary: JsonObject): string | null {
  const local = asString(summary.obsTimeLocal)
  if (local && /^\d{4}-\d{2}-\d{2}/.test(local)) return local.slice(0, 10)

  const utc = asString(summary.obsTimeUtc)
  if (utc && /^\d{4}-\d{2}-\d{2}/.test(utc)) return utc.slice(0, 10)

  return null
}

export function normalizeWeatherHistory(payload: unknown): WeatherHistoryDay[] {
  const root = getObject(payload)
  const records = Array.isArray(root.summaries)
    ? root.summaries
    : Array.isArray(root.observations)
      ? root.observations
      : Array.isArray(payload)
        ? payload
        : []

  return records
    .map((record): WeatherHistoryDay | null => {
      const summary = getObject(record)
      const metric = getObject(summary.metric)
      const date = normalizeHistoryDate(summary)
      if (!date) return null

      return {
        date,
        temperatureHighC: asNumber(metric.tempHigh),
        temperatureLowC: asNumber(metric.tempLow),
        temperatureAverageC: asNumber(metric.tempAvg),
        humidityAveragePct: asNumber(summary.humidityAvg),
        windSpeedAverageKph: asNumber(metric.windspeedAvg),
        windGustHighKph: asNumber(metric.windgustHigh),
        rainfallMm: asNumber(metric.precipTotal),
        pressureHighHpa: asNumber(metric.pressureMax),
        pressureLowHpa: asNumber(metric.pressureMin),
        uvHigh: asNumber(summary.uvHigh),
      }
    })
    .filter((day): day is WeatherHistoryDay => day !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
}
