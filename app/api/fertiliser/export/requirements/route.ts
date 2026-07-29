import { proxyFertiliserDownload } from "../../proxy"

export async function GET(request: Request) {
  return proxyFertiliserDownload("export/requirements", request)
}
