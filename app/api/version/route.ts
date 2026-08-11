import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function firstConfigured(...values: Array<string | undefined>): string {
  return values.find((value) => value?.trim())?.trim() ?? "unknown"
}

function releaseEnvironment(): string {
  if (process.env.MFMS_BUILD_ENVIRONMENT?.trim()) {
    return process.env.MFMS_BUILD_ENVIRONMENT.trim()
  }

  switch (process.env.VERCEL_ENV) {
    case "production":
      return "Vercel Production Target"
    case "preview":
      return "Vercel Preview"
    case "development":
      return "Local Development"
    default:
      return "unknown"
  }
}

export function GET() {
  return NextResponse.json(
    {
      git_commit: firstConfigured(
        process.env.MFMS_GIT_COMMIT,
        process.env.VERCEL_GIT_COMMIT_SHA,
      ),
      git_branch: firstConfigured(process.env.VERCEL_GIT_COMMIT_REF),
      build_timestamp: firstConfigured(process.env.MFMS_BUILD_TIMESTAMP),
      environment: releaseEnvironment(),
      deployment_id: firstConfigured(process.env.VERCEL_DEPLOYMENT_ID),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  )
}
