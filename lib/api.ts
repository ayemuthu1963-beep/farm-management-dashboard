const DEFAULT_API_BASE_URL = "http://127.0.0.1:8001"

export function getApiBaseUrl(): string {
  return (process.env.HARVEST_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, "")
}

export function getBasicAuthHeader(): string | null {
  const username = process.env.HARVEST_API_USERNAME
  const password = process.env.HARVEST_API_PASSWORD

  if (!username || !password) {
    return null
  }

  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
}
