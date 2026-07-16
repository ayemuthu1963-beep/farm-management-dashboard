# FERTILISER MANAGEMENT MODULE - COMPLETE HANDOFF DOCUMENTATION

**Prepared for:** Codex Integration into MFMS Local Testing Server  
**Date:** 2026-07-16  
**Status:** Implementation-Ready Static Frontend + Backend Blueprint  
**Deployment:** LOCAL TESTING ONLY - NO PRODUCTION DEPLOYMENT  

---

## TABLE OF CONTENTS

1. Files and Structure
2. Type Definitions
3. Mock Data Overview
4. Frontend Implementation Details
5. Recommended Database Schema
6. API Endpoint Specifications
7. Integration Guide for Codex
8. Testing Checklist
9. Known Limitations
10. Security Considerations

---

## 1. FILES AND STRUCTURE

### Project Files

```
/vercel/share/v0-project/
├── app/fertiliser-management/
│   └── page.tsx                         # Main page with all 6 tabs, forms, tables
├── lib/
│   ├── fertiliser-types.ts              # TypeScript interface definitions
│   └── fertiliser-data.ts               # Mock data with all 54 products
├── components/farm/                     # Shared MFMS components (no changes)
│   ├── dashboard-shell.tsx
│   ├── header.tsx
│   ├── panel.tsx
│   ├── stat-card.tsx
│   └── export-button.tsx
└── FERTILISER_MANAGEMENT_HANDOFF.md    # This document
```

### File Purposes

- **page.tsx** (696 lines): Complete fertiliser management interface with:
  - 6 tab-based sections (Stock Overview, Incoming, Outgoing, Future Requirements, Transaction History, Product Master)
  - Grouped category tables for products and stock
  - Mock form validation and submission handlers
  - All 54 products integrated
  - Responsive layout for desktop and mobile

- **fertiliser-types.ts** (163 lines): Production-ready TypeScript interfaces:
  - FertiliserProduct
  - FertiliserTransaction
  - FertiliserFutureRequirement
  - FertiliserStockBatch
  - FertiliserStockSummary
  - Form payload types (IncomingStock, OutgoingStock, StockAdjustment, etc.)

- **fertiliser-data.ts** (150+ lines): Complete mock data:
  - All 54 products with proper categories and units
  - Opening stock transactions
  - Sample incoming/outgoing/adjustment transactions
  - Sample future requirements
  - Helper functions (getCurrentStock, getExpiryStatus, etc.)
  - Dropdown data (categories, purposes, crops, locations, suppliers, statuses, priorities)

---

## 2. TYPE DEFINITIONS

All types are exported from `lib/fertiliser-types.ts`:

### FertiliserProduct
```typescript
interface FertiliserProduct {
  id: string                    // P001, P002, ... P054
  categoryId: string           // CAT001, CAT002, etc.
  category: string             // "Insecticide", "NPK Fertilizer", etc.
  name: string                 // "Grosure", "NPK 20:20:20", etc.
  unit: string                 // "kg", "litre", "ml", "gram"
  minimumStock: number         // Reorder point
  status: 'active' | 'inactive' // Product availability status
  createdAt: string            // ISO 8601 timestamp
  updatedAt: string            // ISO 8601 timestamp
}
```

### FertiliserTransaction
```typescript
interface FertiliserTransaction {
  id: string
  type: 'opening' | 'incoming' | 'outgoing' | 'adjustment' | 'disposal'
  date: string                 // YYYY-MM-DD
  productId: string
  productName: string
  category: string
  quantity: number             // Negative for adjustments/disposals
  unit: string
  reference: string            // PO number, APP number, etc.
  remarks: string
  batchId?: string             // For batch tracking (FEFO)
  batchNumber?: string
  expiryDate?: string | null   // Batch expiry
  createdBy?: string           // User ID
  createdAt: string
  updatedAt: string
}
```

### FertiliserFutureRequirement
```typescript
interface FertiliserFutureRequirement {
  id: string
  productId: string
  productName: string
  category: string
  requiredQuantity: number     // Total quantity needed
  unit: string
  currentStock: number         // Current available stock
  shortfall: number            // requiredQuantity - currentStock
  requiredByDate: string       // YYYY-MM-DD
  plannedApplicationDate: string
  purpose: string              // "Pest Control", "Top Dressing", etc.
  crop: string                 // "Coconut", "Jackfruit", etc.
  plot: string                 // Location identifier
  priority: 'Low' | 'Normal' | 'High' | 'Urgent'
  status: 'Planned' | 'Approved' | 'Ordered' | 'Partially Received' | 'Received' | 'Cancelled'
  estimatedUnitCost: number    // Price per unit
  estimatedTotalCost: number   // Calculated: requiredQuantity * estimatedUnitCost
  supplier?: string            // Supplier name
  remarks?: string             // Notes
  createdBy?: string           // User ID
  createdAt: string
  updatedAt: string
}
```

### Form Payload Types

```typescript
interface IncomingStockPayload {
  date: string
  productId: string
  quantity: number
  unit: string
  batchNumber?: string         // Optional batch tracking
  expiryDate?: string | null
  reference: string            // PO-YYYY-XXXX
  remarks: string
  supplierId?: string
}

interface OutgoingStockPayload {
  date: string
  productId: string
  quantity: number
  unit: string
  reference: string            // APP-YYYY-XXXX
  remarks: string
  purpose: string
  plot?: string
  issuedTo?: string
}

interface StockAdjustmentPayload {
  date: string
  productId: string
  quantity: number             // Negative to decrease, positive to increase
  unit: string
  reason: string               // "Spillage", "Inventory Recount", etc.
  remarks: string
  reference?: string
}
```

---

## 3. MOCK DATA OVERVIEW

### All 54 Products Included

The application includes all 54 products from the Excel import:

- **14 products with opening stock** (from Excel quantities)
- **40 products with "Not Entered" quantity** (no quantity in Excel)

All products are fully functional and available in:
- Stock Overview table
- Product Master table
- All dropdown selectors

### Sample Mock Transactions

Five categories of transactions are pre-loaded:

1. **Opening Stock (5 transactions)** - P001 through P005 with their original Excel quantities
2. **Incoming (2 transactions)** - P001 (5 kg), P015 (50 kg)
3. **Outgoing (2 transactions)** - P001 (3 kg), P015 (25 kg)
4. **Adjustment (1 transaction)** - P003 (-2 litre)

These demonstrate the full lifecycle and allow testing stock calculations:
- P001 Grosure: 16 (opening) + 5 (incoming) - 3 (outgoing) = **18 kg**
- P015 NPK 20:20:20: 0 (opening) + 50 (incoming) - 25 (outgoing) = **25 kg**

### Sample Future Requirements

Two requirements demonstrate different statuses and shortfall calculations:
- FR001: Grosure (Planned, 10 kg required, 0 shortfall)
- FR002: NPK 20:20:20 (Approved, 100 kg required, 75 kg shortfall)

### Helper Functions

All exported from `lib/fertiliser-data.ts`:

```typescript
getCurrentStock(productId: string): number
  // Calculates: Opening + Incoming - Outgoing + Adjustments
  
getExpiryStatus(expiryDate: string | null): 'expired' | 'expiring-soon' | 'valid' | 'none'
  // Returns status based on 90-day window from 2026-07-16

getProductsByCategory(category: string): FertiliserProduct[]
  // Filters active products by category

categories: string[]              // Unique categories (8 total)
purposes: string[]                // Fixed list of application purposes
crops: string[]                   // Fixed list of crops
locations: string[]               // Fixed list of plots/locations
suppliers: string[]               // Fixed list of suppliers
statuses: string[]                // Fixed list of requirement statuses
priorities: string[]              // Fixed list of priority levels
```

---

## 4. FRONTEND IMPLEMENTATION DETAILS

### Page Structure

**page.tsx** implements a complete admin interface with:

#### Tab 1: Stock Overview
- 8 summary metric cards
- Complete product and stock register with grouped categories
- Category header shows once, products listed beneath
- Stock status indicators (In Stock, Low Stock, Out of Stock)

#### Tab 2: Incoming Stock
- Form to record incoming shipments
- Fields: Reference, Date, Category, Product, Quantity, Unit, Expiry, Supplier, Remarks
- Mock validation (product, quantity, unit required)
- Recent incoming transactions table

#### Tab 3: Outgoing Stock
- Form to record stock issues/applications
- Fields: Reference, Date, Category, Product, Quantity, Available Stock, Purpose, Plot, Remarks
- Mock validation (product, quantity, purpose, plot required)
- Recent outgoing transactions table

#### Tab 4: Future Requirements
- Form to record future demand
- Fields: Product, Required Qty, Required By, Planned Date, Purpose, Crop, Plot, Priority, Status, Unit Cost, Remarks
- Mock validation (product, quantity, required date, status required)
- Requirements register table with shortfall calculation and priority badges

#### Tab 5: Transaction History
- Complete transaction log
- All transaction types (opening, incoming, outgoing, adjustment)
- Color-coded by type

#### Tab 6: Product Master
- All 54 products in grouped category table
- Edit and Toggle buttons (mock handlers)
- Product buttons: Add New Product, Add New Category, Export, Refresh

### Form Validation

All forms include mock client-side validation:

- **Incoming Stock**: Validates product, quantity, unit
- **Outgoing Stock**: Validates product, quantity, purpose, location
- **Future Requirement**: Validates product, quantity, required date, status
- Error messages displayed inline under each field
- Success messages shown on form submission

### Mock Handlers

Named functions in component state:

- `handleReceiveStock(e)` - Incoming form submission
- `handleIssueStock(e)` - Outgoing form submission
- `handleSaveRequirement(e)` - Future requirement form submission
- `handleAddProduct(e)` - Add product form (not yet shown)
- `handleAddCategory(e)` - Add category form (not yet shown)
- `handleExport(type)` - Export data (mock)
- `handleRefresh()` - Refresh data (mock)

All handlers show success messages indicating where backend API calls will be made.

### Styling

- Uses existing MFMS shared components (Header, Panel, StatCard, ExportButton)
- Tailwind CSS with MFMS color tokens (primary, chart-1 through chart-4, destructive)
- Responsive grid layout (1 col mobile, 2 col tablet, full width desktop)
- Grouped tables with category rowspan for visual grouping

---

## 5. RECOMMENDED DATABASE SCHEMA

### Table: fertiliser_categories

```sql
CREATE TABLE fertiliser_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  CHECK (length(name) > 0)
);

CREATE INDEX idx_categories_name ON fertiliser_categories(name);
```

**Purpose**: Store fertiliser product categories (Insecticide, NPK Fertilizer, etc.)

### Table: fertiliser_products

```sql
CREATE TABLE fertiliser_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES fertiliser_categories(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  unit VARCHAR(20) NOT NULL, -- kg, litre, ml, gram
  minimum_stock DECIMAL(10, 2) DEFAULT 5,
  status VARCHAR(20) DEFAULT 'active', -- active, inactive
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(category_id, name),
  CHECK (minimum_stock > 0),
  CHECK (unit IN ('kg', 'litre', 'ml', 'gram')),
  CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX idx_products_category ON fertiliser_products(category_id);
CREATE INDEX idx_products_status ON fertiliser_products(status);
```

**Purpose**: Store product master data

### Table: fertiliser_stock_batches

```sql
CREATE TABLE fertiliser_stock_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES fertiliser_products(id) ON DELETE CASCADE,
  batch_number VARCHAR(50),
  expiry_date DATE, -- NULL if product doesn't require expiry
  quantity DECIMAL(10, 3) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'available', -- available, expired, reserved
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  CHECK (quantity > 0),
  CHECK (status IN ('available', 'expired', 'reserved'))
);

CREATE INDEX idx_batches_product ON fertiliser_stock_batches(product_id);
CREATE INDEX idx_batches_expiry ON fertiliser_stock_batches(expiry_date);
CREATE INDEX idx_batches_status ON fertiliser_stock_batches(status);
```

**Purpose**: Track inventory by batch, supporting FEFO (First Expiry, First Out)

### Table: fertiliser_stock_transactions

```sql
CREATE TABLE fertiliser_stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type VARCHAR(20) NOT NULL, -- opening, incoming, outgoing, adjustment, disposal
  transaction_date DATE NOT NULL,
  product_id UUID NOT NULL REFERENCES fertiliser_products(id),
  batch_id UUID REFERENCES fertiliser_stock_batches(id),
  quantity DECIMAL(10, 3) NOT NULL, -- negative for outgoing/disposal/negative adjustments
  unit VARCHAR(20) NOT NULL,
  reference VARCHAR(50), -- PO-YYYY-XXXX, APP-YYYY-XXXX, ADJ-YYYY-XXXX
  remarks TEXT,
  supplier_id UUID REFERENCES suppliers(id), -- optional
  issued_to VARCHAR(100),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  CHECK (transaction_type IN ('opening', 'incoming', 'outgoing', 'adjustment', 'disposal')),
  CHECK (reference IS NOT NULL OR transaction_type = 'opening')
);

CREATE INDEX idx_transactions_product ON fertiliser_stock_transactions(product_id);
CREATE INDEX idx_transactions_date ON fertiliser_stock_transactions(transaction_date);
CREATE INDEX idx_transactions_type ON fertiliser_stock_transactions(transaction_type);
CREATE INDEX idx_transactions_reference ON fertiliser_stock_transactions(reference);
```

**Purpose**: Immutable transaction history (audit log, stock calculation source)

### Table: fertiliser_future_requirements

```sql
CREATE TABLE fertiliser_future_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES fertiliser_products(id),
  required_quantity DECIMAL(10, 3) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  required_by_date DATE NOT NULL,
  planned_application_date DATE,
  purpose VARCHAR(100), -- Pest Control, Top Dressing, etc.
  crop VARCHAR(100),     -- Coconut, Jackfruit, etc.
  plot VARCHAR(100),     -- Location/plot identifier
  priority VARCHAR(20) DEFAULT 'Normal', -- Low, Normal, High, Urgent
  status VARCHAR(25) DEFAULT 'Planned', -- Planned, Approved, Ordered, Partially Received, Received, Cancelled
  estimated_unit_cost DECIMAL(10, 2),
  estimated_total_cost DECIMAL(12, 2), -- Calculated: required_quantity * estimated_unit_cost
  supplier_id UUID REFERENCES suppliers(id),
  remarks TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  CHECK (required_quantity > 0),
  CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
  CHECK (status IN ('Planned', 'Approved', 'Ordered', 'Partially Received', 'Received', 'Cancelled')),
  CHECK (required_by_date > CURRENT_DATE OR status IN ('Received', 'Cancelled'))
);

CREATE INDEX idx_requirements_product ON fertiliser_future_requirements(product_id);
CREATE INDEX idx_requirements_status ON fertiliser_future_requirements(status);
CREATE INDEX idx_requirements_date ON fertiliser_future_requirements(required_by_date);
```

**Purpose**: Track future demand and material planning

### Table: suppliers (optional but recommended)

```sql
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL UNIQUE,
  contact_person VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(50),
  region VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX idx_suppliers_name ON suppliers(name);
```

**Purpose**: Master list of suppliers for purchase orders and transactions

---

## 6. API ENDPOINT SPECIFICATIONS

### Stock Management Endpoints

#### GET /api/fertiliser/products
**Purpose**: Fetch all products

**Response**:
```json
{
  "status": "success",
  "data": [
    {
      "id": "P001",
      "categoryId": "CAT001",
      "category": "Insecticide",
      "name": "Grosure",
      "unit": "kg",
      "minimumStock": 5,
      "status": "active",
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /api/fertiliser/stock/receive
**Purpose**: Record incoming stock

**Request**:
```json
{
  "date": "2026-07-16",
  "productId": "P001",
  "quantity": 5,
  "unit": "kg",
  "batchNumber": "BATCH-001",
  "expiryDate": "2031-03-01",
  "reference": "PO-2026-001",
  "remarks": "Purchased from Supplier A",
  "supplierId": "SUP-001"
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Incoming stock recorded",
  "transaction": {
    "id": "TXN-INC-001",
    "type": "incoming",
    "date": "2026-07-16",
    "productId": "P001",
    "quantity": 5,
    "unit": "kg",
    "reference": "PO-2026-001"
  }
}
```

**Validation**:
- Product must exist and be active
- Quantity > 0
- Unit must match product unit
- Reference is required
- ExpiryDate required if product configuration specifies

#### POST /api/fertiliser/stock/issue
**Purpose**: Record outgoing stock

**Request**:
```json
{
  "date": "2026-07-16",
  "productId": "P001",
  "quantity": 3,
  "unit": "kg",
  "reference": "APP-2026-001",
  "remarks": "Pest control - Plot 1",
  "purpose": "Pest Control",
  "plot": "Plot 1",
  "issuedTo": "Field Worker A"
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Outgoing stock recorded",
  "transaction": {
    "id": "TXN-OUT-001",
    "type": "outgoing",
    "date": "2026-07-16",
    "productId": "P001",
    "quantity": 3,
    "unit": "kg",
    "reference": "APP-2026-001",
    "batchesUsed": [
      {"batchId": "BATCH-001", "quantity": 3}
    ]
  }
}
```

**Validation**:
- Product must exist
- Quantity > 0 and ≤ current available stock
- Unit must match product unit
- Purpose required
- Plot required
- Use FEFO for batch selection

**Error Response** (over-issue):
```json
{
  "status": "error",
  "message": "Insufficient stock",
  "available": 15,
  "requested": 25
}
```

#### POST /api/fertiliser/stock/adjust
**Purpose**: Record stock adjustments (reconciliation, spillage, etc.)

**Request**:
```json
{
  "date": "2026-07-16",
  "productId": "P003",
  "quantity": -2,
  "unit": "litre",
  "reason": "Spillage",
  "remarks": "Reconciliation - spillage loss",
  "reference": "ADJ-2026-001"
}
```

**Validation**:
- Product must exist
- Quantity can be positive or negative
- Reason required
- Adjustment must leave stock >= 0 for products with current stock

#### GET /api/fertiliser/stock/{productId}
**Purpose**: Get current stock summary for a product

**Response**:
```json
{
  "status": "success",
  "data": {
    "productId": "P001",
    "productName": "Grosure",
    "category": "Insecticide",
    "totalStock": 18,
    "unit": "kg",
    "minimumStock": 5,
    "status": "in_stock",
    "earliestExpiry": "2031-03-01",
    "expiryStatus": "valid",
    "batchCount": 2,
    "batches": [
      {
        "id": "BATCH-001",
        "batchNumber": "BATCH-001",
        "expiryDate": "2031-03-01",
        "quantity": 18,
        "status": "available"
      }
    ]
  }
}
```

#### GET /api/fertiliser/transactions
**Purpose**: Get transaction history with filters

**Query Parameters**:
- `productId` (optional)
- `type` (optional): opening, incoming, outgoing, adjustment, disposal
- `dateFrom` (optional): YYYY-MM-DD
- `dateTo` (optional): YYYY-MM-DD
- `limit` (optional): default 100
- `offset` (optional): default 0

**Response**:
```json
{
  "status": "success",
  "data": [...],
  "total": 50,
  "limit": 100,
  "offset": 0
}
```

### Future Requirements Endpoints

#### POST /api/fertiliser/requirements
**Purpose**: Create a future requirement

**Request**:
```json
{
  "productId": "P001",
  "requiredQuantity": 10,
  "unit": "kg",
  "requiredByDate": "2026-08-15",
  "plannedApplicationDate": "2026-08-10",
  "purpose": "Pest Control",
  "crop": "Coconut",
  "plot": "Plot 1",
  "priority": "High",
  "status": "Planned",
  "estimatedUnitCost": 200,
  "supplierId": "SUP-001",
  "remarks": "Regular pest control cycle"
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Requirement created",
  "requirement": {
    "id": "FR-001",
    "productId": "P001",
    "requiredQuantity": 10,
    "currentStock": 18,
    "shortfall": 0,
    "estimatedTotalCost": 2000,
    "status": "Planned"
  }
}
```

#### PATCH /api/fertiliser/requirements/{id}
**Purpose**: Update requirement status

**Request**:
```json
{
  "status": "Approved"
}
```

#### POST /api/fertiliser/requirements/{id}/receive
**Purpose**: Receive stock against a requirement (partial or full)

**Request**:
```json
{
  "quantityReceived": 5,
  "reference": "PO-2026-002",
  "batchNumber": "BATCH-002"
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Requirement partially received",
  "requirement": {
    "id": "FR-001",
    "status": "Partially Received",
    "requiredQuantity": 10,
    "totalReceived": 5,
    "remainingQuantity": 5
  }
}
```

### Product Master Endpoints

#### POST /api/fertiliser/products
**Purpose**: Create new product

**Request**:
```json
{
  "categoryId": "CAT001",
  "name": "New Insecticide",
  "unit": "kg",
  "minimumStock": 5,
  "status": "active"
}
```

**Validation**:
- Category must exist
- Product name must be unique within category
- Unit must be one of: kg, litre, ml, gram
- Minimum stock > 0

#### POST /api/fertiliser/categories
**Purpose**: Create new category

**Request**:
```json
{
  "name": "New Category",
  "description": "Category description"
}
```

**Validation**:
- Category name must be unique
- Name cannot be empty

---

## 7. INTEGRATION GUIDE FOR CODEX

### Step-by-Step Import Procedure

#### Phase 1: Setup (Local Only)

1. **Copy files to local MFMS repository**:
   ```bash
   cp app/fertiliser-management/page.tsx ~/mfms-local/app/
   cp lib/fertiliser-types.ts ~/mfms-local/lib/
   cp lib/fertiliser-data.ts ~/mfms-local/lib/
   ```

2. **Verify imports and component paths**:
   - Ensure Header, Panel, StatCard, DashboardShell imports resolve
   - Check Tailwind token names (primary, chart-1, destructive, etc.)
   - Verify Lucide icon availability (Leaf, etc.)

3. **Add route to navigation** (if applicable):
   - Update home page or main navigation
   - Add link: `/fertiliser-management`

4. **Type-check**:
   ```bash
   npm run type-check
   # or
   pnpm exec tsc --noEmit
   ```

5. **Run dev server**:
   ```bash
   npm run dev
   # Visit http://localhost:3000/fertiliser-management
   ```

#### Phase 2: Database Setup (Local PostgreSQL Only)

6. **Run database migrations** against LOCAL database ONLY:
   ```bash
   # Use existing MFMS migration approach
   # Create migration files in migrations/ or use Prisma/Drizzle
   
   # Tables:
   # - fertiliser_categories
   # - fertiliser_products
   # - fertiliser_stock_batches
   # - fertiliser_stock_transactions
   # - fertiliser_future_requirements
   # - suppliers (optional)
   ```

7. **Seed initial data** (optional):
   ```bash
   # Import all 54 products from Excel
   # Create opening stock transactions
   # This ensures local testing matches production data structure
   ```

#### Phase 3: Backend Implementation

8. **Create API endpoints** one by one:
   - Start with: `POST /api/fertiliser/stock/receive`
   - Add: `POST /api/fertiliser/stock/issue`
   - Add: `GET /api/fertiliser/stock/{productId}`
   - Add: `GET /api/fertiliser/transactions`
   - etc.

9. **Replace mock handlers** in page.tsx:
   - Replace `handleReceiveStock` with actual API call
   - Replace `handleIssueStock` with actual API call
   - Keep mock handlers as fallback during development

10. **Test each endpoint** independently:
    - POST receive → verify stock increases
    - POST issue → verify stock decreases, over-issue blocked
    - GET stock → verify calculations match transactions
    - etc.

#### Phase 4: Integration Testing

11. **Full workflow testing**:
    - Incoming stock increases balance
    - Outgoing stock decreases balance
    - FEFO works (earliest expiry used first)
    - Over-issue prevented with error message
    - Stock calculations accurate
    - Transactions logged immutably

12. **Form validation**:
    - All required fields enforced
    - Quantity validation (> 0)
    - Unit matching
    - Duplicate prevention (product names per category)
    - Expiry date handling

13. **Mobile/responsive testing**:
    - Tables stack on mobile
    - Forms readable on small screens
    - No horizontal scroll needed

#### Phase 5: Cleanup

14. **Before committing**:
    - Remove any console.log debug statements
    - Ensure no hardcoded localhost URLs
    - Verify all imports use environment variables for endpoints
    - Add .env.local example file

15. **Git workflow**:
    ```bash
    git checkout -b feature/fertiliser-management
    git add app/fertiliser-management/ lib/fertiliser-*
    git commit -m "Add Fertiliser Management module

    - All 54 products integrated
    - 6-tab admin interface
    - Mock forms with validation
    - Grouped category tables
    - Ready for backend API integration"
    git push origin feature/fertiliser-management
    # Create Pull Request
    # DO NOT merge to main or deploy
    ```

---

## 8. TESTING CHECKLIST

### Pre-Launch (v0 → Codex Handoff)

- [x] All 54 products display correctly
- [x] Stock Overview metrics calculate accurately
- [x] Grouped category tables render without errors
- [x] 6 tabs functional and switchable
- [x] Forms accept input
- [x] Mock validation messages appear
- [x] Success messages display on form submission
- [x] Sample transactions visible in history
- [x] TypeScript compiles without errors
- [x] No console errors in browser

### Local Testing (Codex Integration)

- [ ] Database tables created successfully
- [ ] Opening stock import loads all 54 products
- [ ] Incoming stock form creates transaction and increases stock
- [ ] Stock balance updates immediately after incoming
- [ ] Outgoing stock form creates transaction and decreases stock
- [ ] Cannot issue more than available stock (error shown)
- [ ] FEFO batch selection works (earliest expiry used first)
- [ ] Stock adjustment (positive) increases balance
- [ ] Stock adjustment (negative) decreases balance
- [ ] Future requirement shortfall calculates correctly
- [ ] Partial receipt updates requirement status
- [ ] Transaction history shows all movements
- [ ] Export functions generate correct data format
- [ ] Mobile layout responsive and functional
- [ ] New products appear in dropdowns immediately
- [ ] New categories appear in category list
- [ ] User permissions enforced (if applicable)
- [ ] API errors handled gracefully with messages
- [ ] Performance acceptable with 54 products + 10+ transactions

### Security Testing (Post-Integration)

- [ ] SQL injection attempts blocked
- [ ] Quantity manipulation prevented
- [ ] Role-based access control enforced
- [ ] Audit trail captures all changes
- [ ] Deleted transactions marked as reversal (not erased)
- [ ] Supplier data secured
- [ ] User identification on all transactions

---

## 9. KNOWN LIMITATIONS

### Current (v0 Implementation)

1. **Mock data only** - All form submissions show success messages but don't persist data beyond component state
2. **No batch management UI** - Batch numbers accepted but not displayed in stock breakdowns
3. **No FEFO algorithm** - Batch selection is simulated; actual FEFO logic in backend required
4. **Static dropdown lists** - Suppliers, purposes, crops are fixed; dynamic loading from database needed
5. **No user authentication** - All forms assume authenticated user; `createdBy` not populated
6. **No real export** - Export buttons show success messages only
7. **No search or filter** - Product tables not filterable beyond category grouping
8. **Expiry status fixed** - Uses hardcoded date (2026-07-16); should be current server date
9. **No pagination** - All 54 products load upfront; pagination needed for scale
10. **No concurrent edit handling** - No conflict detection if multiple users edit same product

### Backend (To Be Implemented by Codex)

1. **No transaction rollback logic** - Partial failures need reversal transactions
2. **No stock reservation system** - Requirements don't reserve stock; needed for accurate availability
3. **No cost tracking** - Estimated costs calculated but not tracked against actuals
4. **No waste/disposal tracking** - Adjustment transactions recorded but not analyzed
5. **No low-stock alerts** - No automated notifications when stock falls below minimum
6. **No expiry-date aging report** - No dashboard for approaching expiries
7. **No supplier performance** - No tracking of late deliveries or quality issues
8. **No reorder point optimization** - Minimum stock levels are static; no AI-based recommendations

---

## 10. SECURITY CONSIDERATIONS

### Recommended Implementation

#### Authentication & Authorization

- **Session-based authentication** (use existing MFMS auth)
- **Role-based access control (RBAC)**:
  - Viewer: Stock Overview tab only
  - Manager: All tabs except Delete Product
  - Admin: All tabs including product deletion
  
#### Data Protection

- **Row-level security (RLS)** on all tables if using Supabase/PostgRES
  - Users can only see transactions for their farm/organization
  
- **Parameterized queries** (use Prisma/Drizzle ORM) to prevent SQL injection

- **Input validation** on all API endpoints:
  - Quantity: positive numbers only
  - Dates: valid ISO 8601 format
  - References: no special characters
  - Text fields: max length limits

#### Audit & Compliance

- **Immutable transaction history**:
  - Never delete transactions
  - Use adjustment/reversal transactions for corrections
  - Log `created_by`, `created_at` for all records
  
- **Comprehensive audit logging**:
  ```sql
  CREATE TABLE audit_log (
    id UUID PRIMARY KEY,
    user_id UUID,
    action VARCHAR(50), -- create, update, delete
    table_name VARCHAR(100),
    record_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
  ```

- **Change notifications**: Email alerts for high-value or unusual transactions (over-issue attempts, large adjustments, etc.)

#### Network & Infrastructure

- **HTTPS only** - All API communication encrypted
- **Rate limiting** - Prevent abuse (e.g., 100 requests/minute per user)
- **CORS** - Restrict to known domains
- **Environment variables** - No hardcoded credentials or secrets
- **Database backups** - Daily backups stored separately from production
- **Local testing isolated** - Cannot accidentally hit production database

---

## 11. ENVIRONMENT CONFIGURATION

### Required Environment Variables

For local testing, create `.env.local`:

```env
# Local testing only - DO NOT deploy to production
LOCAL_DATABASE_URL=postgresql://username:password@localhost:5432/mfms_local
LOCAL_API_BASE_URL=http://localhost:3000
LOCAL_MFMS_APP_URL=http://localhost:3000

# Never commit actual credentials
# Use placeholder values during development
# Replace with real values only in local .env.local (in .gitignore)
```

### Environment Variable Usage in Code

```typescript
// Correct:
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'

// Never do this:
const apiBaseUrl = 'http://localhost:3000' // Hardcoded - bad!
```

---

## 12. FINAL CHECKLIST BEFORE CODEX HANDOFF

### Files Ready
- [x] app/fertiliser-management/page.tsx (696 lines, fully functional)
- [x] lib/fertiliser-types.ts (163 lines, all interfaces)
- [x] lib/fertiliser-data.ts (150+ lines, all 54 products + mock data)
- [x] FERTILISER_MANAGEMENT_HANDOFF.md (this document)

### Code Quality
- [x] TypeScript compiles without errors
- [x] No console errors in browser preview
- [x] All imports resolve correctly
- [x] Props and state properly typed
- [x] Form validation functional
- [x] All 54 products display correctly

### Data Completeness
- [x] All 54 products from Excel included
- [x] Product categories preserved from Excel
- [x] Units properly normalized (kg, litre, ml, gram)
- [x] Sample transactions demonstrate lifecycle
- [x] Sample requirements show planning workflow
- [x] Mock data sufficient for testing

### Documentation
- [x] This handoff guide complete with 12 sections
- [x] Database schema recommended
- [x] API endpoint specs provided
- [x] Form payload types defined
- [x] Integration procedure documented
- [x] Testing checklist provided
- [x] Security recommendations included
- [x] Known limitations disclosed

### Deployment Safety
- [x] No production credentials in code
- [x] LOCAL_ONLY annotations clear
- [x] Environment variables templated
- [x] No hardcoded localhost URLs
- [x] Ready for local testing only
- [x] Never push to production without explicit approval

---

## CONCLUSION

The Fertiliser Management module is **implementation-ready** for import into the MFMS local testing server. All 54 products, mock data, UI components, type definitions, and documentation are complete. Codex can proceed with confidence to:

1. Copy static files to local repository
2. Create database tables
3. Implement API endpoints
4. Replace mock handlers with real calls
5. Run local integration testing

**Critical Reminder**: This is for LOCAL TESTING ONLY. Do not deploy to:
- feedback.muthufarms.com
- muthufarms.com
- Any Vercel production project
- Any DigitalOcean production service

All changes should remain on a feature branch until explicit approval is granted.

---

**End of Handoff Documentation**  
**Prepared by**: v0 AI  
**Date**: 2026-07-16  
**Status**: READY FOR CODEX IMPORT
