import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { formatHistoryDate, formatWeatherValue } from "../lib/weather-format.ts"
import { getHistoryDateRange } from "../lib/weather-history-range.ts"
import { mfmsNavigationItems } from "../lib/mfms-navigation.ts"
import {
  degreesToCardinal,
  normalizeCurrentWeather,
  normalizeWeatherHistory,
} from "../lib/weather-underground-data.ts"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

const serverClient = read("lib/weather-underground.ts")
const normalizer = read("lib/weather-underground-data.ts")
const currentRoute = read("app/api/weather/current/route.ts")
const historyRoute = read("app/api/weather/history/route.ts")
const weatherCard = read("components/home/weather-card.tsx")
const weatherDashboard = read("components/weather/weather-dashboard.tsx")
const envExample = read(".env.example")

assert.match(serverClient, /import "server-only"/)
assert.match(serverClient, /https:\/\/api\.weather\.com\/v2\/pws/)
assert.match(serverClient, /process\.env\.WEATHER_UNDERGROUND_API_KEY/)
assert.match(serverClient, /process\.env\.WEATHER_UNDERGROUND_STATION_ID/)
assert.match(serverClient, /url\.searchParams\.set\("apiKey", getApiKey\(\)\)/)
assert.match(serverClient, /cache: "no-store"/)
assert.match(serverClient, /CURRENT_CACHE_MS = 5 \* 60 \* 1000/)
assert.match(serverClient, /HISTORY_CACHE_MS = 60 \* 60 \* 1000/)
assert.match(serverClient, /units: "m"/)
assert.match(serverClient, /"observations\/current"/)
assert.match(serverClient, /"history\/daily"/)
assert.doesNotMatch(serverClient, /NEXT_PUBLIC_.*(?:API_KEY|WEATHER_UNDERGROUND)/)
assert.match(normalizer, /normalizeCurrentWeather/)
assert.match(normalizer, /normalizeWeatherHistory/)

assert.match(currentRoute, /getCurrentWeather\(\)/)
assert.match(historyRoute, /getWeatherHistory\(startDate, endDate\)/)
assert.match(currentRoute, /Live weather is temporarily unavailable/)
assert.match(historyRoute, /Weather history is temporarily unavailable/)
assert.doesNotMatch(currentRoute, /apiKey|WEATHER_UNDERGROUND_API_KEY/)
assert.doesNotMatch(historyRoute, /apiKey|WEATHER_UNDERGROUND_API_KEY/)

assert.match(weatherCard, /fetch\("\/api\/weather\/current"/)
assert.match(weatherCard, /window\.setInterval\(loadCurrentWeather, 5 \* 60 \* 1000\)/)
assert.doesNotMatch(weatherCard, /wunderground\.com|api\.weather\.com/)
assert.match(weatherDashboard, /\/api\/weather\/history\?days=7/)
assert.match(weatherDashboard, /without external advertisements/)

const weatherNavigation = mfmsNavigationItems.find((item) => item.id === "todays-weather")
assert.ok(weatherNavigation)
assert.equal(weatherNavigation.href, "/weather")
assert.equal(weatherNavigation.external, undefined)
assert.equal(weatherNavigation.showInSidebar, true)

const weatherHistoryNavigation = mfmsNavigationItems.find((item) => item.id === "weather-history")
assert.ok(weatherHistoryNavigation)
assert.equal(weatherHistoryNavigation.href, "/weather")
assert.equal(weatherHistoryNavigation.status, "active")
assert.equal(weatherHistoryNavigation.showInSidebar, false)
assert.equal(weatherHistoryNavigation.ctaLabel, "View 7-Day History")

assert.match(envExample, /^WEATHER_UNDERGROUND_STATION_ID=IUDUMA3$/m)
assert.match(
  envExample,
  /^WEATHER_UNDERGROUND_API_KEY=replace_with_regenerated_preview_api_key$/m,
)
assert.doesNotMatch(envExample, /^NEXT_PUBLIC_.*WEATHER_UNDERGROUND/m)

assert.deepEqual(getHistoryDateRange(7, new Date("2026-08-08T02:00:00Z")), {
  startDate: "20260801",
  endDate: "20260807",
})
assert.equal(formatWeatherValue(28.25, " °C", 1), "28.3 °C")
assert.equal(formatWeatherValue(null, " mm", 1), "—")
assert.equal(formatHistoryDate("2026-08-07"), "Fri, 07 Aug")
assert.equal(degreesToCardinal(0), "N")
assert.equal(degreesToCardinal(225), "SW")

const current = normalizeCurrentWeather(
  {
    observations: [
      {
        stationID: "IUDUMA3",
        obsTimeUtc: "2026-08-08T02:00:00Z",
        obsTimeLocal: "2026-08-08 07:30:00",
        humidity: 81,
        winddir: 225,
        uv: 3.2,
        solarRadiation: 418,
        metric: {
          temp: 29.4,
          heatIndex: 33.1,
          dewpt: 25.7,
          windSpeed: 7.4,
          windGust: 12.2,
          pressure: 1007.6,
          precipRate: 0,
          precipTotal: 3.4,
        },
      },
    ],
  },
  "IUDUMA3",
)

assert.equal(current.temperatureC, 29.4)
assert.equal(current.feelsLikeC, 33.1)
assert.equal(current.windDirectionCardinal, "SW")
assert.equal(current.rainfallTodayMm, 3.4)

const history = normalizeWeatherHistory({
  summaries: [
    {
      obsTimeLocal: "2026-08-07 23:59:59",
      humidityAvg: "77",
      uvHigh: 6,
      metric: {
        tempHigh: 32.5,
        tempLow: 24.1,
        tempAvg: 28.2,
        windspeedAvg: 4.7,
        windgustHigh: 17.3,
        precipTotal: 8.6,
        pressureMax: 1009.3,
        pressureMin: 1004.8,
      },
    },
  ],
})

assert.deepEqual(history, [
  {
    date: "2026-08-07",
    temperatureHighC: 32.5,
    temperatureLowC: 24.1,
    temperatureAverageC: 28.2,
    humidityAveragePct: 77,
    windSpeedAverageKph: 4.7,
    windGustHighKph: 17.3,
    rainfallMm: 8.6,
    pressureHighHpa: 1009.3,
    pressureLowHpa: 1004.8,
    uvHigh: 6,
  },
])

console.log("Weather Underground server-only API, cache, UI and history contracts passed.")
