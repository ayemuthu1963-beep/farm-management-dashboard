import { NextRequest } from "next/server"
import { proxyCoconutCountingAdminPatch } from "@/lib/coconut-counting-admin-proxy"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function PATCH(request: NextRequest, context: { params: Promise<{ entryUuid: string }> }) {
  const { entryUuid } = await context.params
  return proxyCoconutCountingAdminPatch(
    request,
    `/api/coconut-counting/admin/entries/${encodeURIComponent(entryUuid)}`,
  )
}
