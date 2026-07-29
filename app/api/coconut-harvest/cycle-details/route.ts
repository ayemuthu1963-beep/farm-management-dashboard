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
  harvest_record_id?: string
  tree_no?: string
  harvest_date?: string
  bunch1_nuts?: string
  bunch2_nuts?: string
  bunch3_nuts?: string
  total_bunches?: string
  total_nuts?: string
  remarks?: string
  source?: string
  created_at?: string
  harvest_cycle?: string
}

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

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

function todayInTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const cycle = searchParams.get("cycle")

  if (!cycle) {
    return NextResponse.json({ error: "cycle is required" }, { status: 400 })
  }

  const authHeader = getBasicAuthHeader()
  if (!authHeader) {
    return NextResponse.json({ error: "Harvest API credentials are not configured" }, { status: 503 })
  }

  const apiBase = getApiBaseUrl()
  const cyclesResponse = await fetch(`${apiBase}/api/cycles`, {
    headers: { Authorization: authHeader, Accept: "application/json" },
    cache: "no-store",
  })

  if (!cyclesResponse.ok) {
    return NextResponse.json({ error: "Unable to load cycle list" }, { status: 503 })
  }

  const cycles = (await cyclesResponse.json()) as CycleSummaryRow[]
  const selectedCycle = cycles.find((row) => String(row.harvest_cycle) === cycle)

  if (!selectedCycle) {
    return NextResponse.json({ error: `Harvest Cycle ${cycle} was not found` }, { status: 404 })
  }

  const startDate = selectedCycle.harvest_start_date
  const endDate = selectedCycle.harvest_end_date || todayInTimeZone("Asia/Kolkata")

  if (!startDate) {
    return NextResponse.json({ error: `Harvest Cycle ${cycle} does not have a start date` }, { status: 422 })
  }

  const [exportResponse, performanceResponse] = await Promise.all([
    fetch(`${apiBase}/api/export/csv?${new URLSearchParams({ start_date: startDate, end_date: endDate }).toString()}`, {
      headers: { Authorization: authHeader, Accept: "text/csv" },
      cache: "no-store",
    }),
    fetch(`${apiBase}/api/tree-performance`, {
      headers: { Authorization: authHeader, Accept: "application/json" },
      cache: "no-store",
    }),
  ])

  if (!exportResponse.ok) {
    return NextResponse.json({ error: "Unable to load harvest rows for the selected cycle" }, { status: 503 })
  }

  if (!performanceResponse.ok) {
    return NextResponse.json({ error: "Unable to load tree performance details" }, { status: 503 })
  }

  const csvRows = parseCsv(await exportResponse.text()).filter((row) => !row.harvest_cycle || String(row.harvest_cycle) === cycle)
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
      harvestRecordId: toNumber(row.harvest_record_id),
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
      source: row.source ?? "",
      importedAt: row.created_at ?? null,
    }
  })

  return NextResponse.json({
    cycle: Number(cycle),
    cycleSummary: {
      cycle_no: cycle,
      status: selectedCycle.harvest_end_date ? "Closed/Locked" : "Open",
      start_date: selectedCycle.harvest_start_date,
      end_date: selectedCycle.harvest_end_date,
      trees_harvested: rows.length,
      total_bunches: rows.reduce((sum, row) => sum + row.totalBunches, 0),
      total_nuts: rows.reduce((sum, row) => sum + row.totalNuts, 0),
      average_nuts: rows.length > 0 ? rows.reduce((sum, row) => sum + row.totalNuts, 0) / rows.length : 0,
      sale_price: salePrice,
      total_sale: cycleTotalSale,
    },
    rows,
    pagination: {
      page: 1,
      page_size: rows.length,
      total_rows: rows.length,
      total_pages: rows.length > 0 ? 1 : 0,
    },
  })
}
