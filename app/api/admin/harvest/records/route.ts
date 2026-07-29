import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_MFMS_ENV !== "local") {
    return Response.json({ error: "Harvest Admin save is enabled only in LOCAL TEST." }, { status: 403 })
  }

  const authHeader = getBasicAuthHeader()
  const response = await fetch(`${getApiBaseUrl()}/api/harvest/records`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: await request.text(),
  })

  return new Response(await response.text(), {
    status: response.status,
    headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
  })
}
