import { NextResponse } from "next/server"
import {
  getCurrentWeather,
  WeatherConfigurationError,
} from "@/lib/weather-underground"
import type { WeatherApiErrorResponse } from "@/lib/weather-types"

export const dynamic = "force-dynamic"

const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
}

export async function GET() {
  try {
    return NextResponse.json(await getCurrentWeather(), {
      headers: RESPONSE_HEADERS,
    })
  } catch (error) {
    const payload: WeatherApiErrorResponse = {
      error:
        error instanceof WeatherConfigurationError
          ? "Live weather is awaiting secure API configuration"
          : "Live weather is temporarily unavailable",
    }

    return NextResponse.json(payload, {
      status: 503,
      headers: {
        ...RESPONSE_HEADERS,
        "Retry-After": "300",
      },
    })
  }
}
