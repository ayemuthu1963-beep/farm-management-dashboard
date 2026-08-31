// Fertiliser Management static mock data for MFMS v1.2.0 FERT-01.
// Source of truth: C:\Users\Muthu Mini PC\Downloads\Fertilize Details.xlsx, worksheet "Fertilizer ".
// This file is mock/static UI data only. It does not connect to a backend or database.

export type FertiliserStockStatus = "In Stock" | "Low Stock" | "Out of Stock" | "Not Entered"
export type FertiliserExpiryStatus = "Valid" | "Expiring Soon" | "Expired" | "No Expiry Entered" | "Not Entered" | "Out of Stock"

export interface FertiliserProduct {
  id: string
  sNo: number
  excelRow: number
  category: string
  name: string
  quantity: number | null
  unit: string
  quantityText: string
  expiryDate: string | null
  source: string
  productId?: number
  minimumStock?: number
  stockStatus?: FertiliserStockStatus
  expiryStatus?: FertiliserExpiryStatus
  lastMovement?: string | null
  latestPurchaseTotalCost?: string | null
  latestPurchaseUnitCost?: string | null
  latestPurchaseDate?: string | null
}

export interface FertiliserTransaction {
  id: string
  type: "Opening Stock" | "Incoming" | "Outgoing" | "Adjustment"
  date: string
  productId: string
  productName: string
  category: string
  quantity: number
  unit: string
  reference: string
  remarks: string
}

export interface FertiliserFutureRequirement {
  id: string
  productId: string
  productName: string
  category: string
  requiredQuantity: number
  unit: string
  currentStock: number
  shortfall: number
  requiredByDate: string
  priority: "Low" | "Normal" | "High" | "Urgent"
  status: "Planned" | "Approved" | "Mock Only"
  remarks: string
}

export const fertiliserProducts: FertiliserProduct[] = [
  {
    "id": "FERT-001",
    "sNo": 1,
    "excelRow": 5,
    "category": "Insecticide",
    "name": "Grosure",
    "quantity": 16,
    "unit": "kg",
    "quantityText": "16 kgs",
    "expiryDate": "2031-03-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-002",
    "sNo": 2,
    "excelRow": 6,
    "category": "Insecticide",
    "name": "Abamek",
    "quantity": 8,
    "unit": "litre",
    "quantityText": "8 litre",
    "expiryDate": "2027-11-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-003",
    "sNo": 3,
    "excelRow": 7,
    "category": "Insecticide",
    "name": "Verticill ",
    "quantity": 25,
    "unit": "litre",
    "quantityText": "25 litre",
    "expiryDate": "2025-02-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-004",
    "sNo": 4,
    "excelRow": 8,
    "category": "Insecticide",
    "name": "V-Kill",
    "quantity": 10,
    "unit": "litre",
    "quantityText": "10 litre",
    "expiryDate": null,
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-005",
    "sNo": 5,
    "excelRow": 9,
    "category": "Insecticide",
    "name": "Varunastra",
    "quantity": 20,
    "unit": "litre",
    "quantityText": "20 litre",
    "expiryDate": "2027-04-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-006",
    "sNo": 6,
    "excelRow": 10,
    "category": "Insecticide",
    "name": "Mono",
    "quantity": 5,
    "unit": "litre",
    "quantityText": "5 litre",
    "expiryDate": "2026-07-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-007",
    "sNo": 7,
    "excelRow": 11,
    "category": "Insecticide",
    "name": "Profenofos",
    "quantity": 10,
    "unit": "litre",
    "quantityText": "10 Litres",
    "expiryDate": "2027-12-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-008",
    "sNo": 8,
    "excelRow": 12,
    "category": "Insecticide",
    "name": "Basillis",
    "quantity": 12,
    "unit": "kg",
    "quantityText": "12 kgs",
    "expiryDate": "2027-05-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-009",
    "sNo": 9,
    "excelRow": 13,
    "category": "Insecticide",
    "name": "Viridi",
    "quantity": 12,
    "unit": "kg",
    "quantityText": "12 kgs",
    "expiryDate": "2027-05-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-010",
    "sNo": 10,
    "excelRow": 14,
    "category": "Insecticide",
    "name": "Neem Baan",
    "quantity": 8,
    "unit": "litre",
    "quantityText": "8 Litre",
    "expiryDate": "2024-06-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-011",
    "sNo": 11,
    "excelRow": 15,
    "category": "Insecticide",
    "name": "Termite-X",
    "quantity": 6,
    "unit": "litre",
    "quantityText": "6 litre",
    "expiryDate": "2026-03-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-012",
    "sNo": 12,
    "excelRow": 16,
    "category": "Insecticide",
    "name": "Warrior",
    "quantity": 2,
    "unit": "litre",
    "quantityText": "2 litre",
    "expiryDate": "2027-02-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-013",
    "sNo": 13,
    "excelRow": 17,
    "category": "Insecticide",
    "name": "Lethal",
    "quantity": 1,
    "unit": "litre",
    "quantityText": "1 Litre",
    "expiryDate": "2027-10-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-014",
    "sNo": 14,
    "excelRow": 18,
    "category": "Insecticide",
    "name": "Phorate 10 CG ",
    "quantity": 1,
    "unit": "kg",
    "quantityText": "1 kg",
    "expiryDate": "2023-03-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-015",
    "sNo": 15,
    "excelRow": 20,
    "category": "Micronutrient Fertilizer",
    "name": "Boronol",
    "quantity": 15,
    "unit": "kg",
    "quantityText": "15 kgs",
    "expiryDate": "2029-02-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-016",
    "sNo": 16,
    "excelRow": 21,
    "category": "Micronutrient Fertilizer",
    "name": "Boron",
    "quantity": 9,
    "unit": "kg",
    "quantityText": "9 kgs",
    "expiryDate": "2028-10-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-017",
    "sNo": 17,
    "excelRow": 22,
    "category": "Micronutrient Fertilizer",
    "name": "Mag Mix",
    "quantity": 15,
    "unit": "kg",
    "quantityText": "15 Kgs",
    "expiryDate": "2028-01-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-018",
    "sNo": 18,
    "excelRow": 23,
    "category": "Micronutrient Fertilizer",
    "name": "Top Min ",
    "quantity": 2,
    "unit": "litre",
    "quantityText": "2 litre",
    "expiryDate": "2026-01-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-019",
    "sNo": 19,
    "excelRow": 25,
    "category": "Spreader",
    "name": "Spreadmax",
    "quantity": 250,
    "unit": "ml",
    "quantityText": "250 ml",
    "expiryDate": "2030-11-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-020",
    "sNo": 20,
    "excelRow": 26,
    "category": "Spreader",
    "name": "Mobile",
    "quantity": 10,
    "unit": "kg",
    "quantityText": "10 Kgs",
    "expiryDate": null,
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-021",
    "sNo": 21,
    "excelRow": 27,
    "category": "Spreader",
    "name": "Ralwet",
    "quantity": 2,
    "unit": "litre",
    "quantityText": "2 litre",
    "expiryDate": "2028-06-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-022",
    "sNo": 22,
    "excelRow": 30,
    "category": "Weedicide",
    "name": "TATA LAAFA",
    "quantity": 10,
    "unit": "litre",
    "quantityText": "10 Litres",
    "expiryDate": "2028-02-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-023",
    "sNo": 23,
    "excelRow": 31,
    "category": "Weedicide",
    "name": "Weedwash",
    "quantity": 5,
    "unit": "litre",
    "quantityText": "5 Litre",
    "expiryDate": "2027-06-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-024",
    "sNo": 24,
    "excelRow": 32,
    "category": "Weedicide",
    "name": "Paramax",
    "quantity": 500,
    "unit": "ml",
    "quantityText": "500 ml",
    "expiryDate": "2027-07-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-025",
    "sNo": 25,
    "excelRow": 33,
    "category": "Weedicide",
    "name": "Weedon",
    "quantity": 500,
    "unit": "ml",
    "quantityText": "500 ml",
    "expiryDate": "2027-05-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-026",
    "sNo": 26,
    "excelRow": 34,
    "category": "Weedicide",
    "name": "Kapiq",
    "quantity": 10,
    "unit": "litre",
    "quantityText": "10 Litres",
    "expiryDate": "2028-04-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-027",
    "sNo": 27,
    "excelRow": 38,
    "category": "Fungicide ",
    "name": "Blue Copper ",
    "quantity": 2,
    "unit": "kg",
    "quantityText": "2 kgs",
    "expiryDate": "2027-03-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-028",
    "sNo": 28,
    "excelRow": 39,
    "category": "Fungicide ",
    "name": "Oxyblu",
    "quantity": 6,
    "unit": "kg",
    "quantityText": "6 Kgs",
    "expiryDate": "2026-07-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-029",
    "sNo": 29,
    "excelRow": 40,
    "category": "Fungicide ",
    "name": "Chlorowin ",
    "quantity": 5,
    "unit": "kg",
    "quantityText": "5 kgs",
    "expiryDate": "2025-03-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-030",
    "sNo": 30,
    "excelRow": 41,
    "category": "Fungicide ",
    "name": "Metacide",
    "quantity": 5,
    "unit": "litre",
    "quantityText": "5 litre",
    "expiryDate": "2026-12-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-031",
    "sNo": 31,
    "excelRow": 42,
    "category": "Fungicide ",
    "name": "Mildown",
    "quantity": 20,
    "unit": "litre",
    "quantityText": "20 litre",
    "expiryDate": "2027-04-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-032",
    "sNo": 32,
    "excelRow": 43,
    "category": "Fungicide ",
    "name": "Psodomonus",
    "quantity": 12,
    "unit": "kg",
    "quantityText": "12 kgs",
    "expiryDate": "2027-05-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-033",
    "sNo": 33,
    "excelRow": 45,
    "category": "NPK Fertilizer",
    "name": "Grosure",
    "quantity": 16,
    "unit": "kg",
    "quantityText": "16 kgs",
    "expiryDate": "1931-03-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-034",
    "sNo": 34,
    "excelRow": 46,
    "category": "NPK Fertilizer",
    "name": "Royal 19 +",
    "quantity": 2.5,
    "unit": "litre",
    "quantityText": "2.5 Litre",
    "expiryDate": "2022-06-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-035",
    "sNo": 35,
    "excelRow": 47,
    "category": "NPK Fertilizer",
    "name": "Mahadhan",
    "quantity": 17,
    "unit": "kg",
    "quantityText": "17 Kgs",
    "expiryDate": "2027-10-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-036",
    "sNo": 36,
    "excelRow": 48,
    "category": "NPK Fertilizer",
    "name": "20:20:0:13",
    "quantity": 1800,
    "unit": "kg",
    "quantityText": "1800 Kgs",
    "expiryDate": null,
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-037",
    "sNo": 37,
    "excelRow": 49,
    "category": "NPK Fertilizer",
    "name": "Potash",
    "quantity": 2600,
    "unit": "kg",
    "quantityText": "2600 Kgs",
    "expiryDate": null,
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-038",
    "sNo": 38,
    "excelRow": 50,
    "category": "NPK Fertilizer",
    "name": "Amminonium sulphate",
    "quantity": 1800,
    "unit": "kg",
    "quantityText": "1800 Kgs",
    "expiryDate": null,
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-039",
    "sNo": 39,
    "excelRow": 51,
    "category": "NPK Fertilizer",
    "name": "Magnesium Sulphate",
    "quantity": 360,
    "unit": "kg",
    "quantityText": "360 Kgs",
    "expiryDate": null,
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-040",
    "sNo": 40,
    "excelRow": 52,
    "category": "NPK Fertilizer",
    "name": "Urea",
    "quantity": 585,
    "unit": "kg",
    "quantityText": "585 Kgs",
    "expiryDate": null,
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-041",
    "sNo": 41,
    "excelRow": 53,
    "category": "NPK Fertilizer",
    "name": "Micronutrient",
    "quantity": 1000,
    "unit": "kg",
    "quantityText": "1000 kgs",
    "expiryDate": "2028-02-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-042",
    "sNo": 42,
    "excelRow": 56,
    "category": "Other Fertlizer /chemicals ",
    "name": "Nut Rich",
    "quantity": 120,
    "unit": "kg",
    "quantityText": "120 Kgs",
    "expiryDate": "2029-03-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-043",
    "sNo": 43,
    "excelRow": 57,
    "category": "Other Fertlizer /chemicals ",
    "name": "Humic acid",
    "quantity": 12,
    "unit": "kg",
    "quantityText": "12 kgs",
    "expiryDate": "2027-05-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-044",
    "sNo": 44,
    "excelRow": 58,
    "category": "Other Fertlizer /chemicals ",
    "name": "Amino ",
    "quantity": 20,
    "unit": "litre",
    "quantityText": "20 litre",
    "expiryDate": null,
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-045",
    "sNo": 45,
    "excelRow": 59,
    "category": "Other Fertlizer /chemicals ",
    "name": "TATA Bahaar",
    "quantity": 5,
    "unit": "litre",
    "quantityText": "5 Litre",
    "expiryDate": "2028-02-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-046",
    "sNo": 46,
    "excelRow": 60,
    "category": "Other Fertlizer /chemicals ",
    "name": "Megafol",
    "quantity": 250,
    "unit": "ml",
    "quantityText": "250 ml",
    "expiryDate": null,
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-047",
    "sNo": 47,
    "excelRow": 61,
    "category": "Other Fertlizer /chemicals ",
    "name": "Plantafol",
    "quantity": 500,
    "unit": "gram",
    "quantityText": "500 grams",
    "expiryDate": "2026-11-01",
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-048",
    "sNo": 48,
    "excelRow": 62,
    "category": "Other Fertlizer /chemicals ",
    "name": "Neem Cake",
    "quantity": null,
    "unit": "",
    "quantityText": "Not Entered",
    "expiryDate": null,
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-049",
    "sNo": 49,
    "excelRow": 63,
    "category": "Other Fertlizer /chemicals ",
    "name": "Country Sugar",
    "quantity": null,
    "unit": "",
    "quantityText": "Not Entered",
    "expiryDate": null,
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-050",
    "sNo": 50,
    "excelRow": 65,
    "category": "Bio Fertilizer",
    "name": "Nitro-Fix-Azoto-T",
    "quantity": null,
    "unit": "",
    "quantityText": "Not Entered",
    "expiryDate": null,
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-051",
    "sNo": 51,
    "excelRow": 66,
    "category": "Bio Fertilizer",
    "name": "P-solubilizer-Phospo",
    "quantity": null,
    "unit": "",
    "quantityText": "Not Entered",
    "expiryDate": null,
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-052",
    "sNo": 52,
    "excelRow": 67,
    "category": "Bio Fertilizer",
    "name": "Root care TV",
    "quantity": null,
    "unit": "",
    "quantityText": "Not Entered",
    "expiryDate": null,
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-053",
    "sNo": 53,
    "excelRow": 68,
    "category": "Bio Fertilizer",
    "name": "Pseudo care",
    "quantity": null,
    "unit": "",
    "quantityText": "Not Entered",
    "expiryDate": null,
    "source": "Fertilize Details.xlsx"
  },
  {
    "id": "FERT-054",
    "sNo": 54,
    "excelRow": 69,
    "category": "Bio Fertilizer",
    "name": "Leaf care",
    "quantity": null,
    "unit": "",
    "quantityText": "Not Entered",
    "expiryDate": null,
    "source": "Fertilize Details.xlsx"
  }
]

export const fertiliserCategories: string[] = [
  "Insecticide",
  "Micronutrient Fertilizer",
  "Spreader",
  "Weedicide",
  "Fungicide ",
  "NPK Fertilizer",
  "Other Fertlizer /chemicals ",
  "Bio Fertilizer"
]

export const fertiliserUnits = Array.from(new Set(fertiliserProducts.map((product) => product.unit).filter(Boolean)))

export const MOCK_DATA_NOTICE = "STATIC UI / MOCK DATA"

const today = new Date("2026-07-16T00:00:00")

export function getFertiliserStockStatus(product: FertiliserProduct): FertiliserStockStatus {
  if (product.quantity === null) return "Not Entered"
  if (product.quantity <= 2) return "Low Stock"
  return "In Stock"
}

export function getFertiliserExpiryStatus(expiryDate: string | null): FertiliserExpiryStatus {
  if (!expiryDate) return "No Expiry Entered"
  const expiry = new Date(`${expiryDate}T00:00:00`)
  const days = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (days < 0) return "Expired"
  if (days <= 90) return "Expiring Soon"
  return "Valid"
}

export function formatFertiliserQuantity(product: FertiliserProduct): string {
  if (product.quantity === null) return "Not Entered"
  return product.unit ? `${product.quantity.toLocaleString("en-IN")} ${product.unit}` : product.quantity.toLocaleString("en-IN")
}

export function formatFertiliserExpiry(expiryDate: string | null): string {
  if (!expiryDate) return "No Expiry Entered"
  return expiryDate
}

export const fertiliserTransactions: FertiliserTransaction[] = [
  ...fertiliserProducts
    .filter((product) => product.quantity !== null)
    .map((product) => ({
      id: `FERT-OPEN-${String(product.sNo).padStart(3, "0")}`,
      type: "Opening Stock" as const,
      date: "2026-07-16",
      productId: product.id,
      productName: product.name,
      category: product.category,
      quantity: product.quantity ?? 0,
      unit: product.unit,
      reference: "Excel opening stock mock",
      remarks: "Static UI only - not imported",
    })),
  {
    id: "FERT-MOCK-IN-001",
    type: "Incoming",
    date: "2026-07-16",
    productId: "FERT-001",
    productName: "Grosure",
    category: "Insecticide",
    quantity: 1,
    unit: "kg",
    reference: "Mock incoming validation",
    remarks: "Example transaction only",
  },
  {
    id: "FERT-MOCK-OUT-001",
    type: "Outgoing",
    date: "2026-07-16",
    productId: "FERT-005",
    productName: "Varunastra",
    category: "Insecticide",
    quantity: 1,
    unit: "litre",
    reference: "Mock outgoing validation",
    remarks: "Example transaction only",
  },
]

export const fertiliserFutureRequirements: FertiliserFutureRequirement[] = [
  {
    id: "FERT-REQ-001",
    productId: "FERT-048",
    productName: "Neem Cake",
    category: "Other Fertlizer /chemicals ",
    requiredQuantity: 25,
    unit: "kg",
    currentStock: 0,
    shortfall: 25,
    requiredByDate: "2026-08-15",
    priority: "Normal",
    status: "Mock Only",
    remarks: "Blank quantity in Excel; no opening-stock transaction later unless approved.",
  },
  {
    id: "FERT-REQ-002",
    productId: "FERT-050",
    productName: "Nitro-Fix-Azoto-T",
    category: "Bio Fertilizer",
    requiredQuantity: 10,
    unit: "kg",
    currentStock: 0,
    shortfall: 10,
    requiredByDate: "2026-09-01",
    priority: "High",
    status: "Planned",
    remarks: "Example future requirement for static UI review.",
  },
]

export const fertiliserPurposes = [
  "Basal Fertiliser Application",
  "Top Dressing",
  "Micronutrient Application",
  "Foliar Spray",
  "Pest Control",
  "Disease Control",
  "Weed Control",
  "Soil Treatment",
  "Bio-fertiliser Application",
  "Other",
]

export const fertiliserLocations = ["Plot 1", "Plot 2", "Coconut Block", "Jackfruit Block", "Nutmeg Block", "Main Store", "Other"]

export const duplicateConfirmationNotes = [
  "Grosure appears in Insecticide and NPK Fertilizer. Both entries are retained for later administrator confirmation.",
]

// Backward-compatible exports for existing static chart/placeholder imports.
export interface FertiliserSummary {
  label: string
  value: string | number
  unit?: string
  icon: "bag" | "calendar" | "applied" | "alert"
}

export interface FertiliserSchedule {
  date: string
  block: string
  fertiliser: string
  quantityKg: number
  method: string
  status: "Done" | "Scheduled" | "Overdue"
}

export type ScheduleStatus = FertiliserSchedule["status"]
export type StockLevel = "Good" | "Low" | "Critical"

export const fertiliserSummary: FertiliserSummary[] = [
  { label: "Products", value: fertiliserProducts.length, unit: "Excel rows", icon: "bag" },
  { label: "Categories", value: fertiliserCategories.length, unit: "Excel groups", icon: "calendar" },
  { label: "Entered Stock", value: fertiliserProducts.filter((product) => product.quantity !== null).length, unit: "rows", icon: "applied" },
  { label: "Need Quantity", value: fertiliserProducts.filter((product) => product.quantity === null).length, unit: "rows", icon: "alert" },
]

export const fertiliserSchedule: FertiliserSchedule[] = []
export const stockItems = fertiliserProducts.map((product) => ({
  name: product.name,
  inStockKg: product.unit === "kg" && product.quantity !== null ? product.quantity : 0,
  reorderKg: 5,
  level: getFertiliserStockStatus(product) === "Low Stock" ? "Low" as const : getFertiliserStockStatus(product) === "Not Entered" ? "Critical" as const : "Good" as const,
}))

export const usageTrend = [
  { month: "Feb", quantityKg: 0 },
  { month: "Mar", quantityKg: 0 },
  { month: "Apr", quantityKg: 0 },
  { month: "May", quantityKg: 0 },
  { month: "Jun", quantityKg: 0 },
  { month: "Jul", quantityKg: 0 },
]
