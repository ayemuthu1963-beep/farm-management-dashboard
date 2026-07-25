import { getApiBaseUrl, getBasicAuthHeader } from "@/lib/api"
import { NextRequest, NextResponse } from "next/server"

interface CycleSummaryRow {
  harvest_cycle: string
  harvest_start_date: string
  harvest_end_date: string | null
  total_sale_value: string | number | null
  total_nuts: number | null
  sale_price_per_nut: string | number | null
}

interface TreePerformanceDetail {
  tree_no: string
  plot: string
  category: string
}

interface HarvestCsvRow {
  tree_no?: string
  harvest_date?: string
  bunch1_nuts?: string
  bunch2_nuts?: string
  bunch3_nuts?: string
  total_bunches?: string
  total_nuts?: string
  remarks?: string
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"' && inQuotes && next === '"') {
      current += '"'
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === "," && !inQuotes) {
      cells.push(current)
      current = ""
      continue
    }

    current += char
  }

  cells.push(current)
  return cells
}

function parseCsv(csv: string): HarvestCsvRow[] {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim() !== "")
  if (lines.length <= 1 || lines[0] === "no_records") {
    return []
  }

  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    return headers.reduce<HarvestCsvRow>((row, header, index) => {
      row[header as keyof HarvestCsvRow] = cells[index] ?? ""
      return row
    }, {})
  })
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0
  }

  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const cycle = searchParams.get("cycle")
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")

  if (!cycle || !startDate || !endDate) {
    return NextResponse.json({ error: "cycle, startDate and endDate are required" }, { status: 400 })
  }

  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return NextResponse.json({ error: "Harvest API credentials are not configured" }, { status: 503 })
  }

  const apiBase = getApiBaseUrl()
  const [cyclesResponse, exportResponse, performanceResponse] = await Promise.all([
    fetch(`${apiBase}/api/cycles`, {
      headers: { Authorization: authHeader, Accept: "application/json" },
      cache: "no-store",
    }),
    fetch(`${apiBase}/api/export/csv?${new URLSearchParams({ start_date: startDate, end_date: endDate }).toString()}`, {
      headers: { Authorization: authHeader, Accept: "text/csv" },
      cache: "no-store",
    }),
    fetch(`${apiBase}/api/tree-performance`, {
      headers: { Authorization: authHeader, Accept: "application/json" },
      cache: "no-store",
    }),
  ])

  if (!cyclesResponse.ok || !exportResponse.ok || !performanceResponse.ok) {
    return NextResponse.json({ error: "Unable to load cycle details" }, { status: 503 })
  }

  const cycles = (await cyclesResponse.json()) as CycleSummaryRow[]
  const selectedCycle = cycles.find((row) => row.harvest_cycle === cycle)
  const csvRows = parseCsv(await exportResponse.text())
  const performance = (await performanceResponse.json()) as { details?: TreePerformanceDetail[] }
  const detailByTree = new Map((performance.details ?? []).map((detail) => [detail.tree_no, detail]))
  const cycleTotalSale = toNumber(selectedCycle?.total_sale_value)
  const cycleTotalNuts = toNumber(selectedCycle?.total_nuts)
  const salePrice = cycleTotalNuts > 0 && cycleTotalSale > 0 ? cycleTotalSale / cycleTotalNuts : toNumber(selectedCycle?.sale_price_per_nut)

  const rows = csvRows.map((row) => {
    const treeNo = row.tree_no ?? ""
    const totalNuts = toNumber(row.total_nuts)
    const detail = detailByTree.get(treeNo)

    return {
      treeNo,
      harvestDate: row.harvest_date ?? "",
      nutsB1: toNumber(row.bunch1_nuts),
      nutsB2: toNumber(row.bunch2_nuts),
      nutsB3: toNumber(row.bunch3_nuts),
      totalBunches: toNumber(row.total_bunches),
      totalNuts,
      salePrice,
      totalSale: totalNuts * salePrice,
      plot: detail?.plot ?? "",
      classification: detail?.category ?? "",
      remarks: row.remarks && row.remarks.trim() ? row.remarks : null,
    }
  })

  return NextResponse.json({
    cycle: Number(cycle),
    rows,
  })
}
