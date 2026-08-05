import { NextRequest } from "next/server"
import { proxyCoconutCountingAdminPatch } from "@/lib/coconut-counting-admin-proxy"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function PATCH(request: NextRequest, context: { params: Promise<{ sessionUuid: string }> }) {
  const { sessionUuid } = await context.params
  return proxyCoconutCountingAdminPatch(
    request,
    `/api/coconut-counting/admin/sessions/${encodeURIComponent(sessionUuid)}`,
  )
}
