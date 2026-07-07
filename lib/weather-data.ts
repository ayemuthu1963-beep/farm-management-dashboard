export type WeatherCondition = "sunny" | "partly-cloudy" | "cloudy" | "rain" | "storm"

export interface CurrentWeather {
  location: string
  condition: WeatherCondition
  summary: string
  temperatureC: number
  feelsLikeC: number
  highC: number
  lowC: number
  humidityPct: number
  windKmh: number
  rainfallMm: number
  rainChancePct: number
  uvIndex: number
  sunrise: string
  sunset: string
}

export interface HourlyForecast {
  time: string
  condition: WeatherCondition
  temperatureC: number
  rainChancePct: number
}

export interface DailyForecast {
  day: string
  condition: WeatherCondition
  highC: number
  lowC: number
  rainChancePct: number
}

export const currentWeather: CurrentWeather = {
  location: "Muthu Farms, Pollachi",
  condition: "partly-cloudy",
  summary: "Partly cloudy",
  temperatureC: 31,
  feelsLikeC: 34,
  highC: 33,
  lowC: 24,
  humidityPct: 68,
  windKmh: 12,
  rainfallMm: 2.4,
  rainChancePct: 40,
  uvIndex: 7,
  sunrise: "06:02 AM",
  sunset: "06:24 PM",
}

export const hourlyForecast: HourlyForecast[] = [
  { time: "9 AM", condition: "sunny", temperatureC: 29, rainChancePct: 10 },
  { time: "12 PM", condition: "partly-cloudy", temperatureC: 32, rainChancePct: 20 },
  { time: "3 PM", condition: "cloudy", temperatureC: 33, rainChancePct: 45 },
  { time: "6 PM", condition: "rain", temperatureC: 30, rainChancePct: 65 },
  { time: "9 PM", condition: "partly-cloudy", temperatureC: 27, rainChancePct: 30 },
]

export const weeklyForecast: DailyForecast[] = [
  { day: "Today", condition: "partly-cloudy", highC: 33, lowC: 24, rainChancePct: 40 },
  { day: "Tue", condition: "rain", highC: 30, lowC: 23, rainChancePct: 70 },
  { day: "Wed", condition: "storm", highC: 28, lowC: 23, rainChancePct: 85 },
  { day: "Thu", condition: "cloudy", highC: 31, lowC: 24, rainChancePct: 35 },
  { day: "Fri", condition: "sunny", highC: 34, lowC: 25, rainChancePct: 10 },
]
