'use client'

import { useState } from 'react'
import { Leaf } from 'lucide-react'
import { DashboardShell } from '@/components/farm/dashboard-shell'
import { Header } from '@/components/farm/header'
import { Panel } from '@/components/farm/panel'
import { StatCard, StatGrid } from '@/components/farm/stat-card'
import { ExportButton } from '@/components/farm/export-button'
import { 
  products, 
  transactions, 
  futureRequirements, 
  getCurrentStock, 
  getExpiryStatus, 
  categories, 
  purposes, 
  crops, 
  locations,
  suppliers,
  statuses,
  priorities
} from '@/lib/fertiliser-data'

interface FormErrors {
  [key: string]: string
}

export default function FertiliserManagementPage() {
  const [activeTab, setActiveTab] = useState('overview')
  
  // Form states
  const [incomingFormErrors, setIncomingFormErrors] = useState<FormErrors>({})
  const [outgoingFormErrors, setOutgoingFormErrors] = useState<FormErrors>({})
  const [requirementFormErrors, setRequirementFormErrors] = useState<FormErrors>({})
  const [successMessage, setSuccessMessage] = useState('')

  const groupedProducts = categories.map(cat => ({
    category: cat,
    items: products.filter(p => p.category === cat)
  }))

  // Calculate summary metrics
  const totalProducts = products.length
  const productsWithStock = products.filter(p => getCurrentStock(p.id) > 0).length
  const outOfStock = products.filter(p => getCurrentStock(p.id) === 0).length
  const expiredCount = products.filter(p => getExpiryStatus(p.id)).length
  const expiringCount = products.filter(p => {
    const status = getExpiryStatus(null) 
    return status === 'expiring-soon'
  }).length
  const futureReqCount = futureRequirements.length
  const purchaseRequired = futureRequirements.filter(r => r.shortfall > 0).length

  const tabs = [
    { id: 'overview', label: 'Stock Overview' },
    { id: 'incoming', label: 'Incoming Stock' },
    { id: 'outgoing', label: 'Outgoing Stock' },
    { id: 'requirements', label: 'Future Requirements' },
    { id: 'history', label: 'Transaction History' },
    { id: 'master', label: 'Product Master' },
  ]

  // Form handlers
  const handleReceiveStock = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const errors: FormErrors = {}
    const formData = new FormData(e.currentTarget)
    
    if (!formData.get('product')) errors.product = 'Product required'
    if (!formData.get('quantity') || parseFloat(formData.get('quantity') as string) <= 0) errors.quantity = 'Quantity must be greater than zero'
    if (!formData.get('unit')) errors.unit = 'Unit required'
    
    if (Object.keys(errors).length > 0) {
      setIncomingFormErrors(errors)
      return
    }
    
    setIncomingFormErrors({})
    setSuccessMessage('Incoming stock recorded successfully')
    setTimeout(() => setSuccessMessage(''), 3000)
    e.currentTarget.reset()
  }

  const handleIssueStock = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const errors: FormErrors = {}
    const formData = new FormData(e.currentTarget)
    
    if (!formData.get('product')) errors.product = 'Product required'
    if (!formData.get('quantity') || parseFloat(formData.get('quantity') as string) <= 0) errors.quantity = 'Quantity must be greater than zero'
    if (!formData.get('purpose')) errors.purpose = 'Purpose required'
    if (!formData.get('plot')) errors.plot = 'Plot/Location required'
    
    if (Object.keys(errors).length > 0) {
      setOutgoingFormErrors(errors)
      return
    }
    
    setOutgoingFormErrors({})
    setSuccessMessage('Outgoing stock recorded successfully')
    setTimeout(() => setSuccessMessage(''), 3000)
    e.currentTarget.reset()
  }

  const handleSaveRequirement = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const errors: FormErrors = {}
    const formData = new FormData(e.currentTarget)
    
    if (!formData.get('product')) errors.product = 'Product required'
    if (!formData.get('requiredQty') || parseFloat(formData.get('requiredQty') as string) <= 0) errors.requiredQty = 'Required quantity must be greater than zero'
    if (!formData.get('requiredByDate')) errors.requiredByDate = 'Required by date required'
    if (!formData.get('status')) errors.status = 'Status required'
    
    if (Object.keys(errors).length > 0) {
      setRequirementFormErrors(errors)
      return
    }
    
    setRequirementFormErrors({})
    setSuccessMessage('Future requirement added successfully')
    setTimeout(() => setSuccessMessage(''), 3000)
    e.currentTarget.reset()
  }

  const handleAddProduct = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setSuccessMessage(`Product "${formData.get('productName')}" will be created on backend`)
    setTimeout(() => setSuccessMessage(''), 3000)
    e.currentTarget.reset()
  }

  const handleAddCategory = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setSuccessMessage(`Category "${formData.get('categoryName')}" will be created on backend`)
    setTimeout(() => setSuccessMessage(''), 3000)
    e.currentTarget.reset()
  }

  const handleExport = (type: string) => {
    setSuccessMessage(`${type} export prepared - ready for API integration`)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  const handleRefresh = () => {
    setSuccessMessage('Data refreshed from database')
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-3 sm:p-5">
        <Header />

        {/* Page heading */}
        <div className="flex items-start gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Leaf className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-3xl">
              Fertiliser Management
            </h1>
            <p className="text-sm text-muted-foreground">Inventory administration and stock tracking</p>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-1 border-b border-border overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <ExportButton />
        </div>

        {/* Success message */}
        {successMessage && (
          <div className="rounded-lg bg-chart-2/10 p-3 text-sm font-medium text-chart-2">
            {successMessage}
          </div>
        )}

        {/* STOCK OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <StatGrid>
              <StatCard icon={Leaf} label="Total Products" value={totalProducts} accent="bg-primary/10 text-primary" />
              <StatCard icon={Leaf} label="Products With Stock" value={productsWithStock} accent="bg-chart-2/10 text-chart-2" />
              <StatCard icon={Leaf} label="Out of Stock" value={outOfStock} accent="bg-destructive/10 text-destructive" />
              <StatCard icon={Leaf} label="Expired Products" value={expiredCount} accent="bg-destructive/10 text-destructive" />
              <StatCard icon={Leaf} label="Expiring Soon" value={expiringCount} accent="bg-chart-3/10 text-chart-3" />
              <StatCard icon={Leaf} label="Future Requirements" value={futureReqCount} accent="bg-primary/10 text-primary" />
              <StatCard icon={Leaf} label="Purchase Required" value={purchaseRequired} accent="bg-destructive/10 text-destructive" />
              <StatCard icon={Leaf} label="Categories" value={categories.length} accent="bg-chart-4/10 text-chart-4" />
            </StatGrid>

            <Panel title="Complete Product and Stock Register">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-border bg-muted/50">
                      <th className="text-left px-4 py-2.5 font-semibold text-foreground min-w-[140px]">Category</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-foreground min-w-[140px]">Product Name</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-foreground min-w-[100px]">Stock</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-foreground min-w-[70px]">Unit</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-foreground min-w-[100px]">Stock Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedProducts.map((group, groupIdx) => {
                      const groupRows = group.items.map((product, itemIdx) => {
                        const stock = getCurrentStock(product.id)
                        const stockStatus = stock === 0 ? 'Out of Stock' : stock < product.minimumStock ? 'Low Stock' : 'In Stock'
                        
                        return (
                          <tr key={product.id} className="border-b border-border hover:bg-muted/30">
                            {itemIdx === 0 ? (
                              <td rowSpan={group.items.length} className="px-4 py-2.5 font-semibold text-foreground bg-muted/20 border-r-2 border-border align-top">
                                {group.category}
                              </td>
                            ) : null}
                            <td className="px-4 py-2.5 text-foreground">{product.name}</td>
                            <td className="px-4 py-2.5 text-foreground font-semibold text-right">{stock > 0 ? stock : 'Not Entered'}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{stock > 0 ? product.unit : '--'}</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                                stockStatus === 'Out of Stock' ? 'bg-destructive/20 text-destructive' :
                                stockStatus === 'Low Stock' ? 'bg-chart-3/20 text-chart-3' :
                                'bg-chart-2/20 text-chart-2'
                              }`}>
                                {stockStatus}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                      
                      const rows = [...groupRows]
                      if (groupIdx < groupedProducts.length - 1) {
                        rows.push(
                          <tr key={`separator-${group.category}`} className="h-1 bg-border/30">
                            <td colSpan={5}></td>
                          </tr>
                        )
                      }
                      return rows
                    }).flat()}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-4">All {products.length} products across {categories.length} categories</p>
            </Panel>
          </div>
        )}

        {/* INCOMING STOCK TAB */}
        {activeTab === 'incoming' && (
          <div className="space-y-6">
            <Panel title="Receive Stock / Incoming Entry">
              <form onSubmit={handleReceiveStock} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold">Reference Number</label>
                    <input type="text" name="reference" placeholder="PO-2026-XXX" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Date</label>
                    <input type="date" name="date" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Category</label>
                    <select name="category" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                      <option>Select Category</option>
                      {categories.map(cat => <option key={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Product Name {incomingFormErrors.product && <span className="text-destructive">*</span>}</label>
                    <select name="product" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                      <option>Select Product</option>
                      {products.slice(0, 20).map(p => <option key={p.id}>{p.name}</option>)}
                    </select>
                    {incomingFormErrors.product && <p className="text-xs text-destructive mt-1">{incomingFormErrors.product}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Quantity Received {incomingFormErrors.quantity && <span className="text-destructive">*</span>}</label>
                    <input type="number" name="quantity" placeholder="0" step="0.01" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                    {incomingFormErrors.quantity && <p className="text-xs text-destructive mt-1">{incomingFormErrors.quantity}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Unit {incomingFormErrors.unit && <span className="text-destructive">*</span>}</label>
                    <select name="unit" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                      <option>Select Unit</option>
                      <option>kg</option>
                      <option>litre</option>
                      <option>ml</option>
                      <option>gram</option>
                    </select>
                    {incomingFormErrors.unit && <p className="text-xs text-destructive mt-1">{incomingFormErrors.unit}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Expiry Date (Optional)</label>
                    <input type="date" name="expiryDate" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Supplier</label>
                    <select name="supplier" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                      <option>Select Supplier</option>
                      {suppliers.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-semibold">Remarks</label>
                    <textarea name="remarks" placeholder="Additional notes" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" rows={3} />
                  </div>
                </div>
                <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-semibold hover:bg-primary/90">
                  Record Incoming Stock
                </button>
              </form>
            </Panel>

            <Panel title="Recent Incoming Transactions">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-3 py-2 font-semibold">Date</th>
                      <th className="text-left px-3 py-2 font-semibold">Reference</th>
                      <th className="text-left px-3 py-2 font-semibold">Product</th>
                      <th className="text-left px-3 py-2 font-semibold">Quantity</th>
                      <th className="text-left px-3 py-2 font-semibold">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.filter(t => t.type === 'incoming').map(txn => (
                      <tr key={txn.id} className="border-b border-border hover:bg-muted/50">
                        <td className="px-3 py-2">{txn.date}</td>
                        <td className="px-3 py-2 font-medium">{txn.reference}</td>
                        <td className="px-3 py-2">{txn.productName}</td>
                        <td className="px-3 py-2 font-semibold">{txn.quantity} {txn.unit}</td>
                        <td className="px-3 py-2 text-muted-foreground">{txn.remarks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        )}

        {/* OUTGOING STOCK TAB */}
        {activeTab === 'outgoing' && (
          <div className="space-y-6">
            <Panel title="Issue Stock / Outgoing Entry">
              <form onSubmit={handleIssueStock} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold">Application Reference</label>
                    <input type="text" name="reference" placeholder="APP-2026-XXX" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Date</label>
                    <input type="date" name="date" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Category</label>
                    <select name="category" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                      <option>Select Category</option>
                      {categories.map(cat => <option key={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Product Name {outgoingFormErrors.product && <span className="text-destructive">*</span>}</label>
                    <select name="product" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                      <option>Select Product</option>
                      {products.slice(0, 20).map(p => <option key={p.id}>{p.name}</option>)}
                    </select>
                    {outgoingFormErrors.product && <p className="text-xs text-destructive mt-1">{outgoingFormErrors.product}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Quantity to Issue {outgoingFormErrors.quantity && <span className="text-destructive">*</span>}</label>
                    <input type="number" name="quantity" placeholder="0" step="0.01" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                    {outgoingFormErrors.quantity && <p className="text-xs text-destructive mt-1">{outgoingFormErrors.quantity}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Available Stock</label>
                    <input type="text" value="Database Value" disabled className="mt-1 w-full px-3 py-2 border border-border rounded text-sm bg-muted" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Purpose {outgoingFormErrors.purpose && <span className="text-destructive">*</span>}</label>
                    <select name="purpose" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                      <option>Select Purpose</option>
                      {purposes.map(p => <option key={p}>{p}</option>)}
                    </select>
                    {outgoingFormErrors.purpose && <p className="text-xs text-destructive mt-1">{outgoingFormErrors.purpose}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Plot/Location {outgoingFormErrors.plot && <span className="text-destructive">*</span>}</label>
                    <select name="plot" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                      <option>Select Plot</option>
                      {locations.map(loc => <option key={loc}>{loc}</option>)}
                    </select>
                    {outgoingFormErrors.plot && <p className="text-xs text-destructive mt-1">{outgoingFormErrors.plot}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-semibold">Remarks / Notes</label>
                    <textarea name="remarks" placeholder="Application details" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" rows={3} />
                  </div>
                </div>
                <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-semibold hover:bg-primary/90">
                  Record Outgoing Stock
                </button>
              </form>
            </Panel>

            <Panel title="Recent Outgoing Transactions">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-3 py-2 font-semibold">Date</th>
                      <th className="text-left px-3 py-2 font-semibold">Reference</th>
                      <th className="text-left px-3 py-2 font-semibold">Product</th>
                      <th className="text-left px-3 py-2 font-semibold">Quantity</th>
                      <th className="text-left px-3 py-2 font-semibold">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.filter(t => t.type === 'outgoing').map(txn => (
                      <tr key={txn.id} className="border-b border-border hover:bg-muted/50">
                        <td className="px-3 py-2">{txn.date}</td>
                        <td className="px-3 py-2 font-medium">{txn.reference}</td>
                        <td className="px-3 py-2">{txn.productName}</td>
                        <td className="px-3 py-2 font-semibold">{txn.quantity} {txn.unit}</td>
                        <td className="px-3 py-2 text-muted-foreground">{txn.remarks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        )}

        {/* FUTURE REQUIREMENTS TAB */}
        {activeTab === 'requirements' && (
          <div className="space-y-6">
            <Panel title="Future Requirement Entry">
              <form onSubmit={handleSaveRequirement} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold">Product Name {requirementFormErrors.product && <span className="text-destructive">*</span>}</label>
                    <select name="product" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                      <option>Select Product</option>
                      {products.slice(0, 20).map(p => <option key={p.id}>{p.name}</option>)}
                    </select>
                    {requirementFormErrors.product && <p className="text-xs text-destructive mt-1">{requirementFormErrors.product}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Required Quantity {requirementFormErrors.requiredQty && <span className="text-destructive">*</span>}</label>
                    <input type="number" name="requiredQty" placeholder="0" step="0.01" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                    {requirementFormErrors.requiredQty && <p className="text-xs text-destructive mt-1">{requirementFormErrors.requiredQty}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Required By Date {requirementFormErrors.requiredByDate && <span className="text-destructive">*</span>}</label>
                    <input type="date" name="requiredByDate" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                    {requirementFormErrors.requiredByDate && <p className="text-xs text-destructive mt-1">{requirementFormErrors.requiredByDate}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Planned Application Date</label>
                    <input type="date" name="plannedDate" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Purpose</label>
                    <select name="purpose" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                      <option>Select Purpose</option>
                      {purposes.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Crop</label>
                    <select name="crop" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                      <option>Select Crop</option>
                      {crops.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Plot/Location</label>
                    <select name="plot" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                      <option>Select Plot</option>
                      {locations.map(loc => <option key={loc}>{loc}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Priority</label>
                    <select name="priority" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                      <option>Normal</option>
                      {priorities.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Status {requirementFormErrors.status && <span className="text-destructive">*</span>}</label>
                    <select name="status" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                      <option>Select Status</option>
                      {statuses.map(s => <option key={s}>{s}</option>)}
                    </select>
                    {requirementFormErrors.status && <p className="text-xs text-destructive mt-1">{requirementFormErrors.status}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Estimated Unit Cost</label>
                    <input type="number" name="unitCost" placeholder="0" step="0.01" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-semibold">Remarks</label>
                    <textarea name="remarks" placeholder="Additional notes" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" rows={3} />
                  </div>
                </div>
                <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-semibold hover:bg-primary/90">
                  Add Future Requirement
                </button>
              </form>
            </Panel>

            <Panel title="Future Requirements Register">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-3 py-2 font-semibold">Product</th>
                      <th className="text-left px-3 py-2 font-semibold">Required Qty</th>
                      <th className="text-left px-3 py-2 font-semibold">Current Stock</th>
                      <th className="text-left px-3 py-2 font-semibold">Shortfall</th>
                      <th className="text-left px-3 py-2 font-semibold">Priority</th>
                      <th className="text-left px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {futureRequirements.map(req => (
                      <tr key={req.id} className="border-b border-border hover:bg-muted/50">
                        <td className="px-3 py-2 font-medium">{req.productName}</td>
                        <td className="px-3 py-2">{req.requiredQuantity} {req.unit}</td>
                        <td className="px-3 py-2">{req.currentStock} {req.unit}</td>
                        <td className="px-3 py-2 font-semibold text-destructive">{req.shortfall > 0 ? `${req.shortfall} ${req.unit}` : 'Stock Available'}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${
                            req.priority === 'Urgent' ? 'bg-destructive/20 text-destructive' :
                            req.priority === 'High' ? 'bg-chart-3/20 text-chart-3' :
                            'bg-chart-2/20 text-chart-2'
                          }`}>
                            {req.priority}
                          </span>
                        </td>
                        <td className="px-3 py-2">{req.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        )}

        {/* TRANSACTION HISTORY TAB */}
        {activeTab === 'history' && (
          <Panel title="Complete Transaction History">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-3 py-2 font-semibold">Date</th>
                    <th className="text-left px-3 py-2 font-semibold">Type</th>
                    <th className="text-left px-3 py-2 font-semibold">Product</th>
                    <th className="text-left px-3 py-2 font-semibold">Quantity</th>
                    <th className="text-left px-3 py-2 font-semibold">Reference</th>
                    <th className="text-left px-3 py-2 font-semibold">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(txn => (
                    <tr key={txn.id} className="border-b border-border hover:bg-muted/50">
                      <td className="px-3 py-2">{txn.date}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${
                          txn.type === 'opening' ? 'bg-muted' :
                          txn.type === 'incoming' ? 'bg-chart-2/20 text-chart-2' :
                          txn.type === 'outgoing' ? 'bg-destructive/20 text-destructive' :
                          'bg-chart-3/20 text-chart-3'
                        }`}>
                          {txn.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium">{txn.productName}</td>
                      <td className="px-3 py-2 font-semibold">{txn.quantity} {txn.unit}</td>
                      <td className="px-3 py-2">{txn.reference}</td>
                      <td className="px-3 py-2 text-muted-foreground">{txn.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {/* PRODUCT MASTER TAB */}
        {activeTab === 'master' && (
          <div className="space-y-6">
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => handleAddProduct} className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-semibold hover:bg-primary/90">
                Add New Product
              </button>
              <button onClick={() => handleAddCategory} className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-semibold hover:bg-primary/90">
                Add New Category
              </button>
              <button onClick={() => handleExport('Product')} className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-semibold hover:bg-primary/90">
                Export Product List
              </button>
              <button onClick={handleRefresh} className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-semibold hover:bg-primary/90">
                Refresh Data
              </button>
            </div>

            <Panel title="Product Master">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-border bg-muted/50">
                      <th className="text-left px-4 py-2.5 font-semibold min-w-[140px]">Category</th>
                      <th className="text-left px-4 py-2.5 font-semibold min-w-[140px]">Product Name</th>
                      <th className="text-left px-4 py-2.5 font-semibold min-w-[90px]">Unit</th>
                      <th className="text-right px-4 py-2.5 font-semibold min-w-[120px]">Min Stock</th>
                      <th className="text-left px-4 py-2.5 font-semibold min-w-[100px]">Status</th>
                      <th className="text-left px-4 py-2.5 font-semibold min-w-[100px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedProducts.map((group, groupIdx) => {
                      const groupRows = group.items.map((product, itemIdx) => (
                        <tr key={product.id} className="border-b border-border hover:bg-muted/30">
                          {itemIdx === 0 ? (
                            <td rowSpan={group.items.length} className="px-4 py-2.5 font-semibold bg-muted/20 border-r-2 border-border align-top">
                              {group.category}
                            </td>
                          ) : null}
                          <td className="px-4 py-2.5 font-medium">{product.name}</td>
                          <td className="px-4 py-2.5">{product.unit}</td>
                          <td className="px-4 py-2.5 text-right">{product.minimumStock}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-1 rounded font-semibold ${product.status === 'active' ? 'bg-chart-2/20 text-chart-2' : 'bg-muted'}`}>
                              {product.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <button className="text-primary text-xs font-semibold hover:underline mr-3">Edit</button>
                            <button className="text-primary text-xs font-semibold hover:underline">Toggle</button>
                          </td>
                        </tr>
                      ))
                      
                      const rows = [...groupRows]
                      if (groupIdx < groupedProducts.length - 1) {
                        rows.push(
                          <tr key={`separator-${group.category}`} className="h-1 bg-border/30">
                            <td colSpan={6}></td>
                          </tr>
                        )
                      }
                      return rows
                    }).flat()}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-4">All {products.length} products across {categories.length} categories</p>
            </Panel>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
