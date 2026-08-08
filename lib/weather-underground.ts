import "server-only"

import type { WeatherCurrentResponse, WeatherHistoryResponse } from "@/lib/weather-types"
import {
  normalizeCurrentWeather,
  normalizeWeatherHistory,
} from "@/lib/weather-underground-data"

const WEATHER_API_BASE_URL = "https://api.weather.com/v2/pws"
const DEFAULT_STATION_ID = "IUDUMA3"
const CURRENT_CACHE_MS = 5 * 60 * 1000
const HISTORY_CACHE_MS = 60 * 60 * 1000
const PROVIDER_TIMEOUT_MS = 10_000

type CacheEntry<T> = {
  expiresAt: number
  value: T
}

let currentCache: CacheEntry<WeatherCurrentResponse> | null = null
let currentRequest: Promise<WeatherCurrentResponse> | null = null
const historyCache = new Map<string, CacheEntry<WeatherHistoryResponse>>()
const historyRequests = new Map<string, Promise<WeatherHistoryResponse>>()

export class WeatherConfigurationError extends Error {
  constructor() {
    super("Weather Underground API is not configured")
    this.name = "WeatherConfigurationError"
  }
}

export class WeatherProviderError extends Error {
  constructor(message = "Weather Underground data is temporarily unavailable") {
    super(message)
    this.name = "WeatherProviderError"
  }
}

function getStationId(): string {
  const stationId = (process.env.WEATHER_UNDERGROUND_STATION_ID ?? DEFAULT_STATION_ID)
    .trim()
    .toUpperCase()

  if (!/^[A-Z0-9]{1,24}$/.test(stationId)) {
    throw new WeatherConfigurationError()
  }

  return stationId
}

function getApiKey(): string {
  const apiKey = process.env.WEATHER_UNDERGROUND_API_KEY?.trim()
  if (!apiKey) throw new WeatherConfigurationError()
  return apiKey
}

function buildProviderUrl(path: string, parameters: Record<string, string>): URL {
  const url = new URL(`${WEATHER_API_BASE_URL}/${path}`)
  for (const [name, value] of Object.entries(parameters)) {
    url.searchParams.set(name, value)
  }
  url.searchParams.set("apiKey", getApiKey())
  return url
}

async function fetchProviderJson(url: URL): Promise<unknown> {
  let response: Response

  try {
    response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    })
  } catch {
    throw new WeatherProviderError()
  }

  if (!response.ok) {
    throw new WeatherProviderError()
  }

  try {
    return await response.json()
  } catch {
    throw new WeatherProviderError()
  }
}

async function requestCurrentWeather(): Promise<WeatherCurrentResponse> {
  const stationId = getStationId()
  const url = buildProviderUrl("observations/current", {
    stationId,
    format: "json",
    units: "m",
    numericPrecision: "decimal",
  })
  const payload = await fetchProviderJson(url)

  return {
    source: "Weather Underground PWS",
    stationId,
    current: normalizeCurrentWeather(payload, stationId),
  }
}

export async function getCurrentWeather(): Promise<WeatherCurrentResponse> {
  const now = Date.now()
  if (currentCache && currentCache.expiresAt > now) return currentCache.value
  if (currentRequest) return currentRequest

  currentRequest = requestCurrentWeather()
    .then((value) => {
      currentCache = { value, expiresAt: Date.now() + CURRENT_CACHE_MS }
      return value
    })
    .finally(() => {
      currentRequest = null
    })

  return currentRequest
}

async function requestWeatherHistory(
  startDate: string,
  endDate: string,
): Promise<WeatherHistoryResponse> {
  const stationId = getStationId()
  const url = buildProviderUrl("history/daily", {
    stationId,
    format: "json",
    units: "m",
    startDate,
    endDate,
    numericPrecision: "decimal",
  })
  const payload = await fetchProviderJson(url)

  return {
    source: "Weather Underground PWS",
    stationId,
    startDate,
    endDate,
    days: normalizeWeatherHistory(payload),
  }
}

export async function getWeatherHistory(
  startDate: string,
  endDate: string,
): Promise<WeatherHistoryResponse> {
  const cacheKey = `${startDate}:${endDate}`
  const cached = historyCache.get(cacheKey)
  const now = Date.now()
  if (cached && cached.expiresAt > now) return cached.value

  const pending = historyRequests.get(cacheKey)
  if (pending) return pending

  const request = requestWeatherHistory(startDate, endDate)
    .then((value) => {
      historyCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + HISTORY_CACHE_MS,
      })
      return value
    })
    .finally(() => {
      historyRequests.delete(cacheKey)
    })

  historyRequests.set(cacheKey, request)
  return request
}
