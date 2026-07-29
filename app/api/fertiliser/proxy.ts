import { NextResponse } from "next/server"
import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"

export async function proxyFertiliserGet(path: string, request: Request) {
  const { searchParams } = new URL(request.url)
  const headers: HeadersInit = {}
  const authHeader = getBasicAuthHeader()

  if (authHeader) {
    headers.Authorization = authHeader
  }

  try {
    const suffix = searchParams.toString()
    const response = await fetch(`${getApiBaseUrl()}/api/fertiliser/${path}${suffix ? `?${suffix}` : ""}`, {
      headers,
      cache: "no-store",
    })
    const payload = await response.json()

    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status })
    }

    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to fetch Fertiliser data",
      },
      { status: 503 },
    )
  }
}

export async function proxyFertiliserPost(path: string, request: Request) {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  }
  const authHeader = getBasicAuthHeader()

  if (authHeader) {
    headers.Authorization = authHeader
  }

  try {
    const body = await request.text()
    const response = await fetch(`${getApiBaseUrl()}/api/fertiliser/${path}`, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
    })
    const payload = await response.json()

    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status })
    }

    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to submit Fertiliser data",
      },
      { status: 503 },
    )
  }
}

export async function proxyFertiliserPatch(path: string, request: Request) {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  }
  const authHeader = getBasicAuthHeader()

  if (authHeader) {
    headers.Authorization = authHeader
  }

  try {
    const body = await request.text()
    const response = await fetch(`${getApiBaseUrl()}/api/fertiliser/${path}`, {
      method: "PATCH",
      headers,
      body,
      cache: "no-store",
    })
    const payload = await response.json()

    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status })
    }

    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update Fertiliser data",
      },
      { status: 503 },
    )
  }
}

export async function proxyFertiliserDownload(path: string, request: Request) {
  const { searchParams } = new URL(request.url)
  const headers: HeadersInit = {}
  const authHeader = getBasicAuthHeader()

  if (authHeader) {
    headers.Authorization = authHeader
  }

  try {
    const suffix = searchParams.toString()
    const response = await fetch(`${getApiBaseUrl()}/api/fertiliser/${path}${suffix ? `?${suffix}` : ""}`, {
      headers,
      cache: "no-store",
    })
    const body = await response.arrayBuffer()
    const responseHeaders = new Headers()
    const contentType = response.headers.get("content-type")
    const disposition = response.headers.get("content-disposition")

    if (contentType) responseHeaders.set("content-type", contentType)
    if (disposition) responseHeaders.set("content-disposition", disposition)

    return new Response(body, {
      status: response.status,
      headers: responseHeaders,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to export Fertiliser data",
      },
      { status: 503 },
    )
  }
}
