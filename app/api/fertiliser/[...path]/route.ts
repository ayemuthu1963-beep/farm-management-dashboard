import {
  proxyFertiliserGet,
  proxyFertiliserPatch,
  proxyFertiliserPost,
} from "../proxy"

type FertiliserRouteContext = {
  params: Promise<{
    path?: string[]
  }>
}

function resolvePath(parts: string[] | undefined) {
  return (parts ?? []).join("/")
}

export async function GET(request: Request, context: FertiliserRouteContext) {
  const { path } = await context.params
  return proxyFertiliserGet(resolvePath(path), request)
}

export async function POST(request: Request, context: FertiliserRouteContext) {
  const { path } = await context.params
  return proxyFertiliserPost(resolvePath(path), request)
}

export async function PATCH(request: Request, context: FertiliserRouteContext) {
  const { path } = await context.params
  return proxyFertiliserPatch(resolvePath(path), request)
}
