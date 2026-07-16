'use client'

import { useState } from 'react'
import { Leaf } from 'lucide-react'
import { DashboardShell } from '@/components/farm/dashboard-shell'
import { Header } from '@/components/farm/header'
import { Panel } from '@/components/farm/panel'
import { StatCard, StatGrid } from '@/components/farm/stat-card'
import { ExportButton } from '@/components/farm/export-button'
import { products, transactions, futureRequirements, getCurrentStock, getExpiryStatus, categories, purposes, crops } from '@/lib/fertiliser-data'

export default function FertiliserManagementPage() {
  const [activeTab, setActiveTab] = useState('overview')
  
  const groupedProducts = categories.map(cat => ({
    category: cat,
    items: products.filter(p => p.category === cat)
  }))

  const totalProducts = products.length
  const productsWithStock = products.filter(p => getCurrentStock(p.id) > 0).length
  const outOfStock = products.filter(p => getCurrentStock(p.id) === 0).length
  const quantityNotEntered = products.filter(p => p.quantity === 0).length
  const expiredCount = products.filter(p => getExpiryStatus(p.expiryDate) === 'expired').length
  const expiringCount = products.filter(p => getExpiryStatus(p.expiryDate) === 'expiring-soon').length
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

  return (
    <DashboardShell>
      <Header title="FERTILISER MANAGEMENT" subtitle="Inventory administration and stock tracking" icon={Leaf} />

      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <ExportButton label="Export Inventory" />
      </div>

      {/* Stock Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <StatGrid>
            <StatCard icon={Leaf} label="Total Products" value={totalProducts} accent="bg-chart-2/10 text-chart-2" />
            <StatCard icon={Leaf} label="Products With Stock" value={productsWithStock} accent="bg-primary/10 text-primary" />
            <StatCard icon={Leaf} label="Out of Stock" value={outOfStock} accent="bg-destructive/10 text-destructive" />
            <StatCard icon={Leaf} label="Quantity Not Entered" value={quantityNotEntered} accent="bg-chart-3/10 text-chart-3" />
            <StatCard icon={Leaf} label="Expired Products" value={expiredCount} accent="bg-destructive/10 text-destructive" />
            <StatCard icon={Leaf} label="Expiring Within 90 Days" value={expiringCount} accent="bg-chart-3/10 text-chart-3" />
            <StatCard icon={Leaf} label="Future Requirements" value={futureReqCount} accent="bg-primary/10 text-primary" />
            <StatCard icon={Leaf} label="Items Requiring Purchase" value={purchaseRequired} accent="bg-destructive/10 text-destructive" />
          </StatGrid>

          <Panel title="Complete Product and Stock Register">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-border bg-muted/50">
                    <th className="text-left px-4 py-2.5 font-semibold text-foreground min-w-[140px]">Category</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-foreground min-w-[140px]">Product Name</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-foreground min-w-[100px]">Quantity</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-foreground min-w-[70px]">Unit</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-foreground min-w-[110px]">Expiry Date</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-foreground min-w-[110px]">Expiry Status</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-foreground min-w-[100px]">Stock Status</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-foreground min-w-[110px]">Last Movement</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedProducts.map((group, groupIdx) => {
                    const groupRows = group.items.map((product, itemIdx) => {
                      const stock = getCurrentStock(product.id)
                      const expiryStatus = getExpiryStatus(product.expiryDate)
                      const statusDisplay = expiryStatus === 'expired' ? 'Expired' : expiryStatus === 'expiring-soon' ? 'Expiring Soon' : expiryStatus === 'none' ? 'No Expiry' : 'Valid'
                      const stockStatus = stock === 0 ? 'Out of Stock' : stock < product.minimumStock ? 'Low Stock' : 'In Stock'
                      
                      return (
                        <tr key={product.id} className="border-b border-border hover:bg-muted/30 last:border-0">
                          {/* Category cell - only show for first product in group */}
                          {itemIdx === 0 ? (
                            <td rowSpan={group.items.length} className="px-4 py-2.5 font-semibold text-foreground bg-muted/20 border-r-2 border-border align-top">
                              {group.category}
                            </td>
                          ) : null}
                          <td className="px-4 py-2.5 text-foreground">{product.name}</td>
                          <td className="px-4 py-2.5 text-foreground font-semibold text-right">{stock > 0 ? stock : 'Not Entered'}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{stock > 0 ? product.unit : '--'}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{product.expiryDate || 'No Expiry'}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-block px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                              expiryStatus === 'expired' ? 'bg-destructive/20 text-destructive' :
                              expiryStatus === 'expiring-soon' ? 'bg-chart-3/20 text-chart-3' :
                              'bg-chart-2/20 text-chart-2'
                            }`}>
                              {statusDisplay}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                              stockStatus === 'Out of Stock' ? 'bg-destructive/20 text-destructive' :
                              stockStatus === 'Low Stock' ? 'bg-chart-3/20 text-chart-3' :
                              'bg-chart-2/20 text-chart-2'
                            }`}>
                              {stockStatus}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">Database Value</td>
                        </tr>
                      )
                    })
                    
                    // Add separator row between category groups
                    const rows = [...groupRows]
                    if (groupIdx < groupedProducts.length - 1) {
                      rows.push(
                        <tr key={`separator-${group.category}`} className="h-1 bg-border/30">
                          <td colSpan={8}></td>
                        </tr>
                      )
                    }
                    return rows
                  }).flat()}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-4">All {products.length} products displayed across {categories.length} categories.</p>
          </Panel>
        </div>
      )}

      {/* Incoming Stock Tab */}
      {activeTab === 'incoming' && (
        <div className="space-y-6">
          <Panel title="Receive Stock / Incoming Entry">
            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold">Reference Number</label>
                  <input type="text" placeholder="PO-2026-XXX" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                </div>
                <div>
                  <label className="text-sm font-semibold">Date</label>
                  <input type="date" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                </div>
                <div>
                  <label className="text-sm font-semibold">Category</label>
                  <select className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                    <option>Select Category</option>
                    {categories.map(cat => <option key={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold">Product Name</label>
                  <select className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                    <option>Select Product</option>
                    {products.slice(0, 20).map(p => <option key={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold">Quantity Received</label>
                  <input type="number" placeholder="0" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                </div>
                <div>
                  <label className="text-sm font-semibold">Unit</label>
                  <select className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                    <option>kg</option>
                    <option>litre</option>
                    <option>ml</option>
                    <option>gram</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-semibold">Expiry Date (Optional)</label>
                  <input type="date" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-semibold">Remarks</label>
                  <textarea placeholder="Additional notes" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" rows={3} />
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
                    <tr key={txn.id} className="border-b border-border">
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

      {/* Outgoing Stock Tab */}
      {activeTab === 'outgoing' && (
        <div className="space-y-6">
          <Panel title="Issue Stock / Outgoing Entry">
            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold">Application Reference</label>
                  <input type="text" placeholder="APP-2026-XXX" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                </div>
                <div>
                  <label className="text-sm font-semibold">Date</label>
                  <input type="date" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                </div>
                <div>
                  <label className="text-sm font-semibold">Category</label>
                  <select className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                    <option>Select Category</option>
                    {categories.map(cat => <option key={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold">Product Name</label>
                  <select className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                    <option>Select Product</option>
                    {products.slice(0, 20).map(p => <option key={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold">Quantity to Issue</label>
                  <input type="number" placeholder="0" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                </div>
                <div>
                  <label className="text-sm font-semibold">Available Stock</label>
                  <input type="text" value="Database Value" disabled className="mt-1 w-full px-3 py-2 border border-border rounded text-sm bg-muted" />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-semibold">Remarks / Purpose</label>
                  <textarea placeholder="Application details" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" rows={3} />
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
                    <tr key={txn.id} className="border-b border-border">
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

      {/* Future Requirements Tab */}
      {activeTab === 'requirements' && (
        <div className="space-y-6">
          <Panel title="Future Requirement Entry">
            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold">Requirement Date</label>
                  <input type="date" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                </div>
                <div>
                  <label className="text-sm font-semibold">Required By Date</label>
                  <input type="date" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                </div>
                <div>
                  <label className="text-sm font-semibold">Category</label>
                  <select className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                    <option>Select Category</option>
                    {categories.map(cat => <option key={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold">Product Name</label>
                  <select className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                    <option>Select Product</option>
                    {products.slice(0, 20).map(p => <option key={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold">Required Quantity</label>
                  <input type="number" placeholder="0" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                </div>
                <div>
                  <label className="text-sm font-semibold">Current Available</label>
                  <input type="text" value="Database Value" disabled className="mt-1 w-full px-3 py-2 border border-border rounded text-sm bg-muted" />
                </div>
                <div>
                  <label className="text-sm font-semibold">Purpose</label>
                  <select className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                    <option>Select Purpose</option>
                    {purposes.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold">Crop</label>
                  <select className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                    <option>Select Crop</option>
                    {crops.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold">Plot / Location</label>
                  <input type="text" placeholder="Plot 1, Plot 2, etc" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                </div>
                <div>
                  <label className="text-sm font-semibold">Planned Application Date</label>
                  <input type="date" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                </div>
                <div>
                  <label className="text-sm font-semibold">Priority</label>
                  <select className="mt-1 w-full px-3 py-2 border border-border rounded text-sm">
                    <option>Low</option>
                    <option>Normal</option>
                    <option>High</option>
                    <option>Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold">Estimated Unit Cost</label>
                  <input type="number" placeholder="0" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-semibold">Remarks</label>
                  <textarea placeholder="Additional notes" className="mt-1 w-full px-3 py-2 border border-border rounded text-sm" rows={3} />
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
                    <th className="text-left px-3 py-2 font-semibold">ID</th>
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
                    <tr key={req.id} className="border-b border-border">
                      <td className="px-3 py-2 font-medium">{req.id}</td>
                      <td className="px-3 py-2">{req.productName}</td>
                      <td className="px-3 py-2 font-semibold">{req.requiredQty} {req.unit}</td>
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

      {/* Transaction History Tab */}
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
                  <tr key={txn.id} className="border-b border-border">
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

      {/* Product Master Tab */}
      {activeTab === 'master' && (
        <div className="space-y-6">
          <div className="flex gap-2">
            <button className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-semibold hover:bg-primary/90">
              Add New Product
            </button>
            <button className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-semibold hover:bg-primary/90">
              Add New Category
            </button>
            <button className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-semibold hover:bg-primary/90">
              Import Product List
            </button>
            <button className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-semibold hover:bg-primary/90">
              Export Product List
            </button>
          </div>

          <Panel title="Product Master">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-border bg-muted/50">
                    <th className="text-left px-4 py-2.5 font-semibold text-foreground min-w-[140px]">Category</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-foreground min-w-[140px]">Product Name</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-foreground min-w-[90px]">Default Unit</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-foreground min-w-[120px]">Min Stock Level</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-foreground min-w-[110px]">Expiry Required</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-foreground min-w-[100px]">Status</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-foreground min-w-[100px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedProducts.map((group, groupIdx) => {
                    const groupRows = group.items.map((product, itemIdx) => (
                      <tr key={product.id} className="border-b border-border hover:bg-muted/30 last:border-0">
                        {/* Category cell - only show for first product in group */}
                        {itemIdx === 0 ? (
                          <td rowSpan={group.items.length} className="px-4 py-2.5 font-semibold text-foreground bg-muted/20 border-r-2 border-border align-top">
                            {group.category}
                          </td>
                        ) : null}
                        <td className="px-4 py-2.5 font-medium text-foreground">{product.name}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{product.unit}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-right">{product.minimumStock}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">Yes</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-1 rounded font-semibold whitespace-nowrap ${product.status === 'active' ? 'bg-chart-2/20 text-chart-2' : 'bg-muted'}`}>
                            {product.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <button className="text-primary text-xs font-semibold hover:underline mr-3">Edit</button>
                          <button className="text-primary text-xs font-semibold hover:underline">Toggle</button>
                        </td>
                      </tr>
                    ))
                    
                    // Add separator row between category groups
                    const rows = [...groupRows]
                    if (groupIdx < groupedProducts.length - 1) {
                      rows.push(
                        <tr key={`separator-${group.category}`} className="h-1 bg-border/30">
                          <td colSpan={7}></td>
                        </tr>
                      )
                    }
                    return rows
                  }).flat()}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-4">All {products.length} products displayed across {categories.length} categories.</p>
          </Panel>
        </div>
      )}
    </DashboardShell>
  )
}
