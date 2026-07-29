import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"

export async function POST(request: Request) {
  const authHeader = getBasicAuthHeader()
  const response = await fetch(`${getApiBaseUrl()}/api/beetle-trap/counts`, {
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
