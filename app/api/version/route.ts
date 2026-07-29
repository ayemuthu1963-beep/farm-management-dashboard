import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export function GET() {
  return NextResponse.json(
    {
      git_commit: process.env.MFMS_GIT_COMMIT ?? "unknown",
      build_timestamp: process.env.MFMS_BUILD_TIMESTAMP ?? "unknown",
      environment: process.env.MFMS_BUILD_ENVIRONMENT ?? "Preview",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  )
}
