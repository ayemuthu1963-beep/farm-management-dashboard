import { NextRequest, NextResponse } from "next/server"
import {
  getWeatherHistory,
  WeatherConfigurationError,
} from "@/lib/weather-underground"
import type { WeatherApiErrorResponse } from "@/lib/weather-types"
import { getHistoryDateRange } from "@/lib/weather-history-range"

export const dynamic = "force-dynamic"

const DEFAULT_HISTORY_DAYS = 7
const MAX_HISTORY_DAYS = 31
const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
}

export async function GET(request: NextRequest) {
  const requestedDays = Number(
    request.nextUrl.searchParams.get("days") ?? DEFAULT_HISTORY_DAYS,
  )

  if (
    !Number.isInteger(requestedDays) ||
    requestedDays < 1 ||
    requestedDays > MAX_HISTORY_DAYS
  ) {
    const payload: WeatherApiErrorResponse = {
      error: `History days must be between 1 and ${MAX_HISTORY_DAYS}`,
    }
    return NextResponse.json(payload, {
      status: 400,
      headers: RESPONSE_HEADERS,
    })
  }

  const { startDate, endDate } = getHistoryDateRange(requestedDays)

  try {
    return NextResponse.json(await getWeatherHistory(startDate, endDate), {
      headers: RESPONSE_HEADERS,
    })
  } catch (error) {
    const payload: WeatherApiErrorResponse = {
      error:
        error instanceof WeatherConfigurationError
          ? "Weather history is awaiting secure API configuration"
          : "Weather history is temporarily unavailable",
    }

    return NextResponse.json(payload, {
      status: 503,
      headers: {
        ...RESPONSE_HEADERS,
        "Retry-After": "600",
      },
    })
  }
}
