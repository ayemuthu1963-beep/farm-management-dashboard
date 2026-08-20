export function getApiBaseUrl(): string {
  const configured = process.env.HARVEST_API_BASE_URL?.trim()
  if (!configured) {
    throw new Error("HARVEST_API_BASE_URL is required; no cross-environment fallback is permitted.")
  }

  let parsed: URL
  try {
    parsed = new URL(configured)
  } catch {
    throw new Error("HARVEST_API_BASE_URL must be an absolute HTTP or HTTPS URL.")
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("HARVEST_API_BASE_URL must use HTTP or HTTPS.")
  }

  return configured.replace(/\/$/, "")
}

export function getBasicAuthHeader(): string | null {
  const username = process.env.HARVEST_API_USERNAME
  const password = process.env.HARVEST_API_PASSWORD

  if (!username || !password) {
    return null
  }

  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
}
