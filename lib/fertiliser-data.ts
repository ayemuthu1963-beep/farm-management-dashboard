import { FertiliserProduct, FertiliserTransaction, FertiliserFutureRequirement } from './fertiliser-types'

// All 54 products from Excel file
const rawProducts = [
  {sNo:1, category:"Insecticide", name:"Grosure", quantity:16, unit:"kg", qtyDisplay:"16 kgs", expiryDate:"2031-03-01"},
  {sNo:2, category:"Other Fertilizer / Chemicals", name:"Abamek", quantity:8, unit:"litre", qtyDisplay:"8 litre", expiryDate:"2027-11-01"},
  {sNo:3, category:"Other Fertilizer / Chemicals", name:"Verticill", quantity:25, unit:"litre", qtyDisplay:"25 litre", expiryDate:"2025-02-01"},
  {sNo:4, category:"Other Fertilizer / Chemicals", name:"V-Kill", quantity:10, unit:"litre", qtyDisplay:"10 litre", expiryDate:null},
  {sNo:5, category:"Other Fertilizer / Chemicals", name:"Varunastra", quantity:20, unit:"litre", qtyDisplay:"20 litre", expiryDate:"2027-04-01"},
  {sNo:6, category:"Other Fertilizer / Chemicals", name:"Mono", quantity:5, unit:"litre", qtyDisplay:"5 litre", expiryDate:"2026-07-01"},
  {sNo:7, category:"Other Fertilizer / Chemicals", name:"Profenofos", quantity:10, unit:"litre", qtyDisplay:"10 Litres", expiryDate:"2027-12-01"},
  {sNo:8, category:"Other Fertilizer / Chemicals", name:"Basillis", quantity:12, unit:"kg", qtyDisplay:"12 kgs", expiryDate:"2027-05-01"},
  {sNo:9, category:"Other Fertilizer / Chemicals", name:"Viridi", quantity:12, unit:"kg", qtyDisplay:"12 kgs", expiryDate:"2027-05-01"},
  {sNo:10, category:"Other Fertilizer / Chemicals", name:"Neem Baan", quantity:8, unit:"litre", qtyDisplay:"8 Litre", expiryDate:"2024-06-01"},
  {sNo:11, category:"Other Fertilizer / Chemicals", name:"Termite-X", quantity:6, unit:"litre", qtyDisplay:"6 litre", expiryDate:"2026-03-01"},
  {sNo:12, category:"Other Fertilizer / Chemicals", name:"Warrior", quantity:2, unit:"litre", qtyDisplay:"2 litre", expiryDate:"2027-02-01"},
  {sNo:13, category:"Other Fertilizer / Chemicals", name:"Lethal", quantity:1, unit:"litre", qtyDisplay:"1 Litre", expiryDate:"2027-10-01"},
  {sNo:14, category:"Other Fertilizer / Chemicals", name:"Phorate 10 CG", quantity:1, unit:"kg", qtyDisplay:"1 kg", expiryDate:"2023-03-01"},
  {sNo:15, category:"NPK Fertilizer", name:"NPK 20:20:20", quantity:0, unit:"kg", qtyDisplay:"", expiryDate:null},
  {sNo:16, category:"Micronutrient Fertilizer", name:"Zinc Sulphate", quantity:0, unit:"kg", qtyDisplay:"", expiryDate:null},
  {sNo:17, category:"Spreader", name:"Silwet L-77", quantity:0, unit:"litre", qtyDisplay:"", expiryDate:null},
  {sNo:18, category:"Weedicide", name:"Glyphosate 41%", quantity:0, unit:"litre", qtyDisplay:"", expiryDate:null},
  {sNo:19, category:"Fungicide", name:"Carbendazim 50% WP", quantity:0, unit:"kg", qtyDisplay:"", expiryDate:null},
  {sNo:20, category:"Bio Fertilizer", name:"Azospirillum", quantity:0, unit:"kg", qtyDisplay:"", expiryDate:null},
  {sNo:21, category:"Insecticide", name:"Chlorpyrifos 20% EC", quantity:0, unit:"litre", qtyDisplay:"", expiryDate:null},
  {sNo:22, category:"Micronutrient Fertilizer", name:"Boron", quantity:0, unit:"kg", qtyDisplay:"", expiryDate:null},
  {sNo:23, category:"NPK Fertilizer", name:"NPK 19:19:19", quantity:0, unit:"kg", qtyDisplay:"", expiryDate:null},
  {sNo:24, category:"Weedicide", name:"Paraquat 24% SL", quantity:0, unit:"litre", qtyDisplay:"", expiryDate:null},
  {sNo:25, category:"Fungicide", name:"Mancozeb 75% WP", quantity:0, unit:"kg", qtyDisplay:"", expiryDate:null},
  {sNo:26, category:"Other Fertilizer / Chemicals", name:"Chlorine", quantity:0, unit:"kg", qtyDisplay:"", expiryDate:null},
  {sNo:27, category:"Bio Fertilizer", name:"Phosphobacteria", quantity:0, unit:"kg", qtyDisplay:"", expiryDate:null},
  {sNo:28, category:"Spreader", name:"Sticker", quantity:0, unit:"litre", qtyDisplay:"", expiryDate:null},
  {sNo:29, category:"Insecticide", name:"Spinosad 45% SC", quantity:0, unit:"litre", qtyDisplay:"", expiryDate:null},
  {sNo:30, category:"Micronutrient Fertilizer", name:"Iron", quantity:0, unit:"kg", qtyDisplay:"", expiryDate:null},
  {sNo:31, category:"NPK Fertilizer", name:"Urea 46% N", quantity:0, unit:"kg", qtyDisplay:"", expiryDate:null},
  {sNo:32, category:"Weedicide", name:"Butachlor 50% EC", quantity:0, unit:"litre", qtyDisplay:"", expiryDate:null},
  {sNo:33, category:"Fungicide", name:"Propiconazole 25% EC", quantity:0, unit:"litre", qtyDisplay:"", expiryDate:null},
  {sNo:34, category:"Other Fertilizer / Chemicals", name:"Sulphur", quantity:0, unit:"kg", qtyDisplay:"", expiryDate:null},
  {sNo:35, category:"Bio Fertilizer", name:"Trichoderma", quantity:0, unit:"kg", qtyDisplay:"", expiryDate:null},
  {sNo:36, category:"Spreader", name:"Adjuvant", quantity:0, unit:"litre", qtyDisplay:"", expiryDate:null},
  {sNo:37, category:"Insecticide", name:"Imidacloprid 17.8% SL", quantity:0, unit:"litre", qtyDisplay:"", expiryDate:null},
  {sNo:38, category:"Micronutrient Fertilizer", name:"Manganese", quantity:0, unit:"kg", qtyDisplay:"", expiryDate:null},
  {sNo:39, category:"NPK Fertilizer", name:"DAP 18:46:0", quantity:0, unit:"kg", qtyDisplay:"", expiryDate:null},
  {sNo:40, category:"Weedicide", name:"2,4-D Amine 58% SL", quantity:0, unit:"litre", qtyDisplay:"", expiryDate:null},
  {sNo:41, category:"Fungicide", name:"Chlorothalonil 75% WP", quantity:0, unit:"kg", qtyDisplay:"", expiryDate:null},
  {sNo:42, category:"Other Fertilizer / Chemicals", name:"Lime", quantity:0, unit:"kg", qtyDisplay:"", expiryDate:null},
  {sNo:43, category:"Bio Fertilizer", name:"Bacillus Subtilis", quantity:0, unit:"kg", qtyDisplay:"", expiryDate:null},
  {sNo:44, category:"Spreader", name:"Wetting Agent", quantity:0, unit:"litre", qtyDisplay:"", expiryDate:null},
  {sNo:45, category:"Insecticide", name:"Fipronil 5% SC", quantity:0, unit:"litre", qtyDisplay:"", expiryDate:null},
  {sNo:46, category:"Micronutrient Fertilizer", name:"Copper", quantity:0, unit:"kg", qtyDisplay:"", expiryDate:null},
  {sNo:47, category:"NPK Fertilizer", name:"MOP 0:0:60", quantity:0, unit:"kg", qtyDisplay:"", expiryDate:null},
  {sNo:48, category:"Weedicide", name:"Metolachlor 50% EC", quantity:0, unit:"litre", qtyDisplay:"", expiryDate:null},
  {sNo:49, category:"Fungicide", name:"Hexaconazole 5% EC", quantity:0, unit:"litre", qtyDisplay:"", expiryDate:null},
  {sNo:50, category:"Other Fertilizer / Chemicals", name:"Gypsum", quantity:0, unit:"kg", qtyDisplay:"", expiryDate:null},
  {sNo:51, category:"Bio Fertilizer", name:"Pseudomonas", quantity:0, unit:"kg", qtyDisplay:"", expiryDate:null},
  {sNo:52, category:"Spreader", name:"Surfactant", quantity:0, unit:"litre", qtyDisplay:"", expiryDate:null},
  {sNo:53, category:"Fungicide", name:"Tebuconazole 25.9% EC", quantity:0, unit:"litre", qtyDisplay:"", expiryDate:null},
  {sNo:54, category:"Other Fertlizer /chemicals", name:"Neem Oil", quantity:0, unit:"litre", qtyDisplay:"", expiryDate:null},
]

// Build products with all 54 items
export const products: FertiliserProduct[] = rawProducts.map((p, idx) => {
  const id = `P${String(idx+1).padStart(3,'0')}`
  const categoryId = `CAT${String(idx+1).padStart(3,'0')}`
  return {
    id,
    categoryId,
    category: p.category || 'Other',
    name: p.name || `Product ${idx+1}`,
    unit: p.unit || 'unit',
    minimumStock: 5,
    status: 'active' as const,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  }
})

// Mock transactions: opening stock + 6 sample movements
export const transactions: FertiliserTransaction[] = [
  { id: 'TXN-OPEN-001', type: 'opening', date: '2026-01-01', productId: 'P001', productName: 'Grosure', category: 'Insecticide', quantity: 16, unit: 'kg', reference: 'Opening Stock', remarks: 'Initial inventory', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'TXN-OPEN-002', type: 'opening', date: '2026-01-01', productId: 'P002', productName: 'Abamek', category: 'Other Fertilizer / Chemicals', quantity: 8, unit: 'litre', reference: 'Opening Stock', remarks: 'Initial inventory', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'TXN-OPEN-003', type: 'opening', date: '2026-01-01', productId: 'P003', productName: 'Verticill', category: 'Other Fertilizer / Chemicals', quantity: 25, unit: 'litre', reference: 'Opening Stock', remarks: 'Initial inventory', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'TXN-OPEN-004', type: 'opening', date: '2026-01-01', productId: 'P004', productName: 'V-Kill', category: 'Other Fertilizer / Chemicals', quantity: 10, unit: 'litre', reference: 'Opening Stock', remarks: 'Initial inventory', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'TXN-OPEN-005', type: 'opening', date: '2026-01-01', productId: 'P005', productName: 'Varunastra', category: 'Other Fertilizer / Chemicals', quantity: 20, unit: 'litre', reference: 'Opening Stock', remarks: 'Initial inventory', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'TXN-INC-001', type: 'incoming', date: '2026-06-10', productId: 'P001', productName: 'Grosure', category: 'Insecticide', quantity: 5, unit: 'kg', reference: 'PO-2026-001', remarks: 'Purchased from Supplier A', createdAt: '2026-06-10', updatedAt: '2026-06-10' },
  { id: 'TXN-INC-002', type: 'incoming', date: '2026-06-15', productId: 'P015', productName: 'NPK 20:20:20', category: 'NPK Fertilizer', quantity: 50, unit: 'kg', reference: 'PO-2026-002', remarks: 'Bulk order received', createdAt: '2026-06-15', updatedAt: '2026-06-15' },
  { id: 'TXN-OUT-001', type: 'outgoing', date: '2026-06-20', productId: 'P001', productName: 'Grosure', category: 'Insecticide', quantity: 3, unit: 'kg', reference: 'APP-2026-001', remarks: 'Pest control application - Plot 1', createdAt: '2026-06-20', updatedAt: '2026-06-20' },
  { id: 'TXN-OUT-002', type: 'outgoing', date: '2026-07-01', productId: 'P015', productName: 'NPK 20:20:20', category: 'NPK Fertilizer', quantity: 25, unit: 'kg', reference: 'APP-2026-002', remarks: 'Top dressing - Coconut plantation', createdAt: '2026-07-01', updatedAt: '2026-07-01' },
  { id: 'TXN-ADJ-001', type: 'adjustment', date: '2026-07-10', productId: 'P003', productName: 'Verticill', category: 'Other Fertilizer / Chemicals', quantity: -2, unit: 'litre', reference: 'ADJ-2026-001', remarks: 'Stock reconciliation - spillage', createdAt: '2026-07-10', updatedAt: '2026-07-10' },
]

// Mock future requirements
export const futureRequirements: FertiliserFutureRequirement[] = [
  { id: 'FR001', productId: 'P001', productName: 'Grosure', category: 'Insecticide', requiredQuantity: 10, unit: 'kg', currentStock: 18, shortfall: 0, requiredByDate: '2026-08-15', plannedApplicationDate: '2026-08-10', purpose: 'Pest Control', crop: 'Coconut', plot: 'Plot 1', priority: 'High', status: 'Planned', estimatedUnitCost: 200, estimatedTotalCost: 2000, supplier: 'Supplier A', remarks: 'Regular pest control cycle', createdAt: '2026-07-15', updatedAt: '2026-07-15' },
  { id: 'FR002', productId: 'P015', productName: 'NPK 20:20:20', category: 'NPK Fertilizer', requiredQuantity: 100, unit: 'kg', currentStock: 25, shortfall: 75, requiredByDate: '2026-09-01', plannedApplicationDate: '2026-08-20', purpose: 'Top Dressing', crop: 'Jackfruit', plot: 'Plot 2', priority: 'Normal', status: 'Approved', estimatedUnitCost: 15, estimatedTotalCost: 1500, supplier: 'Supplier B', remarks: 'Monsoon season requirement', createdAt: '2026-07-20', updatedAt: '2026-07-20' },
]

export const categories = Array.from(new Set(products.map(p => p.category))).sort()

export const purposes = [
  'Basal Fertiliser Application',
  'Top Dressing',
  'Micronutrient Application',
  'Foliar Spray',
  'Pest Control',
  'Disease Control',
  'Weed Control',
  'Soil Treatment',
  'Bio-fertiliser Application',
  'Other',
]

export const crops = ['Coconut', 'Jackfruit', 'Nutmeg', 'General Farm Use', 'Other']

export const locations = ['Plot 1', 'Plot 2', 'North Well', 'South Well', 'Main Storage', 'Shed 1', 'Shed 2']

export const suppliers = ['Supplier A', 'Supplier B', 'Supplier C', 'Local Distributor', 'Online Supplier']

export const statuses = ['Planned', 'Approved', 'Ordered', 'Partially Received', 'Received', 'Cancelled']

export const priorities = ['Low', 'Normal', 'High', 'Urgent']

export const getProductsByCategory = (category: string) => products.filter(p => p.category === category && p.status === 'active')

export const getExpiryStatus = (expiryDate: string | null): 'expired' | 'expiring-soon' | 'valid' | 'none' => {
  if (!expiryDate) return 'none'
  const expiry = new Date(expiryDate)
  const today = new Date('2026-07-16')
  const days = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (days < 0) return 'expired'
  if (days < 90) return 'expiring-soon'
  return 'valid'
}

export const getCurrentStock = (productId: string): number => {
  const opening = transactions.filter(t => t.type === 'opening' && t.productId === productId).reduce((sum, t) => sum + t.quantity, 0)
  const incoming = transactions.filter(t => t.type === 'incoming' && t.productId === productId).reduce((sum, t) => sum + t.quantity, 0)
  const outgoing = transactions.filter(t => t.type === 'outgoing' && t.productId === productId).reduce((sum, t) => sum + t.quantity, 0)
  const adjustments = transactions.filter(t => t.type === 'adjustment' && t.productId === productId).reduce((sum, t) => sum + t.quantity, 0)
  return opening + incoming - outgoing + adjustments
}
