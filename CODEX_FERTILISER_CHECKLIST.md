# CODEX - FERTILISER MANAGEMENT IMPORT CHECKLIST

**Purpose**: Verify everything is ready before importing into MFMS local testing server

**Status**: Ready for local testing only (NO PRODUCTION DEPLOYMENT)

---

## PRE-IMPORT VERIFICATION

### Files Present
- [ ] `app/fertiliser-management/page.tsx` exists (696 lines)
- [ ] `lib/fertiliser-types.ts` exists (163 lines)
- [ ] `lib/fertiliser-data.ts` exists (150+ lines)
- [ ] `FERTILISER_MANAGEMENT_HANDOFF.md` exists (1152 lines)
- [ ] `FERTILISER_IMPLEMENTATION_SUMMARY.md` exists (373 lines)

### TypeScript Compilation
- [ ] Run: `npx tsc --noEmit`
- [ ] Result: NO ERRORS
- [ ] Command: `npm run type-check` passes

### Code Quality
- [ ] No console.log debug statements remaining
- [ ] All imports resolve correctly
- [ ] Props and state properly typed
- [ ] Forms have validation
- [ ] All 54 products load correctly

### Component Dependencies
- [ ] `components/farm/dashboard-shell.tsx` exists
- [ ] `components/farm/header.tsx` exists
- [ ] `components/farm/panel.tsx` exists
- [ ] `components/farm/stat-card.tsx` exists
- [ ] `components/farm/export-button.tsx` exists

---

## PHASE 1: SETUP (LOCAL DEV SERVER ONLY)

### Step 1: Copy Files
```bash
cp app/fertiliser-management/page.tsx ~/mfms-local/app/
cp lib/fertiliser-types.ts ~/mfms-local/lib/
cp lib/fertiliser-data.ts ~/mfms-local/lib/
```

**Verify**:
- [ ] Files copied successfully
- [ ] No permission errors
- [ ] File timestamps updated

### Step 2: Verify Imports
**In page.tsx, verify imports resolve**:
- [ ] `@/components/farm/dashboard-shell` resolves
- [ ] `@/components/farm/header` resolves
- [ ] `@/components/farm/panel` resolves
- [ ] `@/lib/fertiliser-types` resolves
- [ ] `@/lib/fertiliser-data` resolves
- [ ] `lucide-react` imports work (Leaf icon)

### Step 3: Type Check
```bash
cd ~/mfms-local
npm run type-check
```

**Expected Output**:
- [ ] No TypeScript errors
- [ ] All types resolve
- [ ] Compilation completes without warnings

### Step 4: Start Dev Server
```bash
npm run dev
```

**Expected**:
- [ ] Server starts without errors
- [ ] No syntax errors in console
- [ ] Listening on http://localhost:3000

### Step 5: Manual UI Verification

**Navigate to** `http://localhost:3000/fertiliser-management`

**Verify on page**:
- [ ] Header displays "FERTILISER MANAGEMENT"
- [ ] "Inventory administration and stock tracking" subtitle visible
- [ ] 6 tabs appear: Overview, Incoming, Outgoing, Requirements, History, Master
- [ ] Can click between tabs
- [ ] Tab content updates correctly

**Tab 1: Stock Overview**
- [ ] 8 metric cards display (Total Products, With Stock, Out of Stock, etc.)
- [ ] Product & Stock Register table visible
- [ ] Categories grouped (category header shows once)
- [ ] All 54 products visible when scrolling
- [ ] Stock status indicators (In Stock, Low Stock, Out of Stock) show correctly

**Tab 2: Incoming Stock**
- [ ] Form fields visible: Date, Reference, Category, Product, Qty, Unit, Expiry, Supplier, Remarks
- [ ] Category dropdown populated with all 8 categories
- [ ] Product dropdown populated with products
- [ ] Form submission works (shows "success" message)
- [ ] Recent incoming transactions table visible
- [ ] Sample transactions display (PO-2026-001, PO-2026-002)

**Tab 3: Outgoing Stock**
- [ ] Form fields visible: Date, Reference, Category, Product, Qty, Purpose, Plot, Remarks
- [ ] Purpose dropdown shows: Basal, Top Dressing, Micronutrient, Foliar, Pest Control, etc.
- [ ] Plot dropdown shows: Plot 1, Plot 2, North Well, South Well, etc.
- [ ] Form submission works (shows "success" message)
- [ ] Recent outgoing transactions table visible
- [ ] Sample transactions display (APP-2026-001, APP-2026-002)

**Tab 4: Future Requirements**
- [ ] Form fields visible: Product, Qty, Required By, Planned Date, Purpose, Crop, Plot, Priority, Status
- [ ] Status dropdown shows: Planned, Approved, Ordered, Partially Received, Received, Cancelled
- [ ] Priority shows: Low, Normal, High, Urgent
- [ ] Form submission works (shows "success" message)
- [ ] Requirements register visible with 2 sample requirements
- [ ] Priority badges color-coded (Urgent=red, High=orange, Normal=green)

**Tab 5: Transaction History**
- [ ] All transactions visible (opening, incoming, outgoing, adjustment)
- [ ] Transactions color-coded by type
- [ ] 9 total transactions shown
- [ ] Sorting by date works

**Tab 6: Product Master**
- [ ] All 54 products visible in table
- [ ] Grouped by category
- [ ] 4 action buttons visible: Add Product, Add Category, Export, Refresh
- [ ] Edit and Toggle buttons present (mock only)
- [ ] Can scroll horizontally on mobile

### Step 6: Mobile Responsiveness
**Resize browser to 375px width**:
- [ ] Layout stacks vertically
- [ ] Tables don't require horizontal scroll (or have scroll container)
- [ ] Forms are readable
- [ ] Buttons are clickable
- [ ] No overlapping elements

### Step 7: Form Validation (Mock)
**Test Incoming Stock Form**:
- [ ] Submit empty form
- [ ] Validation errors appear: "Product required", "Quantity must be greater than zero"
- [ ] Error text is red and visible
- [ ] Fill form correctly
- [ ] Submit shows "successfully recorded" message
- [ ] Form clears after submission

**Test Outgoing Stock Form**:
- [ ] Same validation behavior
- [ ] Errors for Product, Quantity, Purpose, Plot

**Test Future Requirement Form**:
- [ ] Errors for Product, Required Qty, Required By Date, Status

---

## PHASE 2: DATABASE SETUP (LOCAL POSTGRESQL ONLY)

### Step 8: Create Database Tables

**From FERTILISER_MANAGEMENT_HANDOFF.md section 5**, create these tables:

```bash
# Connect to local database
psql -h localhost -U username -d mfms_local

# Run each CREATE TABLE statement:
# - fertiliser_categories
# - fertiliser_products
# - fertiliser_stock_batches
# - fertiliser_stock_transactions
# - fertiliser_future_requirements
# - suppliers (optional)
```

**Verify**:
- [ ] No SQL syntax errors
- [ ] All tables created: `\dt fertiliser_*`
- [ ] Indexes created successfully
- [ ] Constraints in place

### Step 9: Seed Initial Data

**Import all 54 products**:
- [ ] Create INSERT script from `lib/fertiliser-data.ts`
- [ ] Insert into fertiliser_categories (8 unique categories)
- [ ] Insert into fertiliser_products (all 54 products)

**Create opening stock transactions**:
- [ ] For each product with quantity > 0 in Excel
- [ ] Create opening stock transaction
- [ ] Set date to 2026-01-01
- [ ] Reference: "Opening Stock"

**Verify**:
- [ ] Count products: `SELECT COUNT(*) FROM fertiliser_products;` → 54
- [ ] Count categories: `SELECT DISTINCT category_id FROM fertiliser_products;` → 8
- [ ] Count transactions: `SELECT COUNT(*) FROM fertiliser_stock_transactions WHERE type='opening';` → 14

---

## PHASE 3: BACKEND IMPLEMENTATION

### Step 10: Create First Endpoint

**Implement**: `POST /api/fertiliser/stock/receive`

From FERTILISER_MANAGEMENT_HANDOFF.md section 6, implement:

**Request body validation**:
- [ ] productId required
- [ ] quantity > 0
- [ ] unit required
- [ ] reference required

**Database operations**:
- [ ] Insert into fertiliser_stock_transactions
- [ ] Create/update batch if expiryDate provided
- [ ] Return transaction ID

**Response**:
- [ ] Status 200 on success
- [ ] Returns created transaction object
- [ ] Status 400 on validation error
- [ ] Status 404 if product not found

**Test**:
```bash
curl -X POST http://localhost:3000/api/fertiliser/stock/receive \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-07-16",
    "productId": "P001",
    "quantity": 5,
    "unit": "kg",
    "reference": "PO-TEST-001",
    "remarks": "Test incoming"
  }'
```

**Expected**: 
- [ ] Returns transaction with id, type, date, etc.
- [ ] Stock increases in database

### Step 11: Create Second Endpoint

**Implement**: `POST /api/fertiliser/stock/issue`

From FERTILISER_MANAGEMENT_HANDOFF.md section 6, implement:

**Additional logic**:
- [ ] Check available stock
- [ ] Block if issuing more than available
- [ ] Use FEFO (earliest expiry first)
- [ ] May use multiple batches if needed

**Validation**:
- [ ] quantity > 0
- [ ] quantity ≤ available stock
- [ ] purpose required
- [ ] plot required

**Test**:
```bash
# Should succeed (stock = 18 for P001)
curl -X POST http://localhost:3000/api/fertiliser/stock/issue \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-07-16",
    "productId": "P001",
    "quantity": 5,
    "reference": "APP-TEST-001",
    "purpose": "Pest Control",
    "plot": "Plot 1"
  }'

# Should fail (requesting 20 but only 13 left after previous issue)
curl -X POST http://localhost:3000/api/fertiliser/stock/issue \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-07-16",
    "productId": "P001",
    "quantity": 20,
    "reference": "APP-TEST-002",
    "purpose": "Top Dressing",
    "plot": "Plot 2"
  }'
```

**Expected**:
- [ ] First request succeeds
- [ ] Stock decreases (18 - 5 = 13)
- [ ] Second request returns 400 error "Insufficient stock"

### Step 12: Create GET Endpoint

**Implement**: `GET /api/fertiliser/stock/{productId}`

**Returns**:
- [ ] Current stock calculation (Opening + Incoming - Outgoing + Adjustments)
- [ ] All batches for product
- [ ] Expiry status
- [ ] Minimum stock comparison

**Test**:
```bash
curl http://localhost:3000/api/fertiliser/stock/P001
```

**Expected**:
- [ ] Returns productId, productName, totalStock
- [ ] totalStock = 13 (from tests above)
- [ ] Lists all batches
- [ ] Shows expiry dates

### Step 13: Create Transaction History Endpoint

**Implement**: `GET /api/fertiliser/transactions`

**Parameters**:
- [ ] productId (optional)
- [ ] type (optional)
- [ ] dateFrom (optional)
- [ ] dateTo (optional)
- [ ] limit (default 100)
- [ ] offset (default 0)

**Test**:
```bash
# All transactions
curl http://localhost:3000/api/fertiliser/transactions

# Specific product
curl http://localhost:3000/api/fertiliser/transactions?productId=P001

# Specific type
curl http://localhost:3000/api/fertiliser/transactions?type=outgoing
```

**Expected**:
- [ ] Returns array of transactions
- [ ] Includes our test transactions
- [ ] Filters work correctly

### Step 14: Replace Mock Handlers in page.tsx

**In page.tsx**:
- [ ] Update `handleReceiveStock()` to call `/api/fertiliser/stock/receive`
- [ ] Update `handleIssueStock()` to call `/api/fertiliser/stock/issue`
- [ ] Update `handleSaveRequirement()` to call `/api/fertiliser/requirements`
- [ ] Add error handling and error messages

**Test**:
- [ ] Submit incoming form → check database
- [ ] Submit outgoing form → verify stock decreases
- [ ] Verify error messages appear on validation failures

---

## PHASE 4: COMPREHENSIVE TESTING

### Step 15: Full Workflow Test

**Scenario: Complete lifecycle for P015 (NPK 20:20:20)**

**Starting state**:
- [ ] Current stock = 25 kg

**Incoming transaction**:
- [ ] Receive 50 kg
- [ ] Verify stock = 75 kg

**Future requirement**:
- [ ] Create requirement: 100 kg needed by 2026-09-01
- [ ] Verify shortfall calculated: 100 - 75 = 25 kg

**Outgoing transaction**:
- [ ] Issue 30 kg for top dressing
- [ ] Verify stock = 45 kg

**Stock adjustment**:
- [ ] Adjust -5 kg (spillage)
- [ ] Verify stock = 40 kg

**Verify transaction history**:
- [ ] 4 transactions appear: incoming, issue, adjustment
- [ ] Running balance correct
- [ ] All details preserved (date, reference, remarks)

### Step 16: Validation Testing

**Over-issue prevention**:
- [ ] Try to issue 50 kg when only 40 kg available
- [ ] Should fail with "Insufficient stock" error
- [ ] Stock should remain 40 kg
- [ ] No transaction created

**Form validation**:
- [ ] Submit incoming form with blank Product
- [ ] Error: "Product required"
- [ ] Submit with Quantity = 0
- [ ] Error: "Quantity must be greater than zero"
- [ ] Submit valid form
- [ ] Success message appears

**FEFO batch selection**:
- [ ] Create batch A: 50 kg, expiry 2027-01-01
- [ ] Create batch B: 50 kg, expiry 2028-01-01
- [ ] Issue 60 kg
- [ ] Verify batch A (earlier) used first
- [ ] Batch A depleted (used 50)
- [ ] Batch B decreased by 10

### Step 17: Stock Calculation Verification

**For each product with transactions**:
- [ ] Calculate manually: Opening + Incoming - Outgoing + Adjustments
- [ ] Call API: `GET /api/fertiliser/stock/{productId}`
- [ ] Verify calculation matches database
- [ ] Test with 5-10 products

**Expected**: All calculations match exactly

### Step 18: Mobile Testing

**On mobile device or simulator**:
- [ ] Navigate to `/fertiliser-management`
- [ ] All 6 tabs functional
- [ ] Forms readable and usable
- [ ] Tables have horizontal scroll if needed
- [ ] Buttons clickable with thumb
- [ ] No text overflow
- [ ] Success/error messages visible

---

## PHASE 5: CLEANUP & FINALIZATION

### Step 19: Code Cleanup

- [ ] Remove any console.log statements
- [ ] Remove any TODO comments
- [ ] Remove hardcoded localhost URLs
- [ ] Use environment variables for API endpoints
- [ ] Verify no commented-out code remains

### Step 20: Environment Setup

**Create `.env.local`** (DO NOT commit):
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

**Verify**:
- [ ] `.env.local` in `.gitignore`
- [ ] No secrets in code
- [ ] API calls use env variable

### Step 21: Database Connection

**Verify connection string**:
- [ ] Uses environment variable: `DATABASE_URL`
- [ ] Connects to LOCAL database only
- [ ] NO production database URL in code

### Step 22: Final Type Check

```bash
npm run type-check
```

**Expected**:
- [ ] No TypeScript errors
- [ ] No warnings

### Step 23: Create Git Branch

```bash
git checkout -b feature/fertiliser-management
git add app/fertiliser-management/ lib/fertiliser-types.ts lib/fertiliser-data.ts
git commit -m "Add Fertiliser Management module

- All 54 products with categories
- 6-tab admin interface (Stock Overview, Incoming, Outgoing, Requirements, History, Master)
- Grouped category tables
- Mock forms with validation
- Complete TypeScript types
- Backend API implementation ready
- Local testing only - ready for handoff"
git push origin feature/fertiliser-management
```

**DO NOT**:
- [ ] ❌ Merge to main
- [ ] ❌ Deploy to production
- [ ] ❌ Merge to develop without approval
- [ ] ❌ Push to feedback.muthufarms.com
- [ ] ❌ Push to muthufarms.com

---

## FINAL VERIFICATION

### All Systems Green?

- [ ] TypeScript compiles: `npm run type-check` ✅
- [ ] All 54 products load ✅
- [ ] UI responsive on mobile ✅
- [ ] Forms validate ✅
- [ ] Database tables created ✅
- [ ] Incoming stock increases balance ✅
- [ ] Outgoing stock decreases balance ✅
- [ ] Over-issue blocked ✅
- [ ] FEFO batch selection works ✅
- [ ] Stock calculations accurate ✅
- [ ] Transaction history complete ✅
- [ ] Error messages helpful ✅
- [ ] No console errors ✅
- [ ] No hardcoded URLs ✅
- [ ] Git branch created ✅
- [ ] PR ready for review ✅

### Sign-Off

**Prepared by**: v0 AI  
**Date**: 2026-07-16  
**Status**: ✅ READY FOR LOCAL TESTING  
**Deployment**: LOCAL ONLY - NO PRODUCTION PUSH  

---

## TROUBLESHOOTING

### TypeScript Errors
**If `npm run type-check` fails**:
- [ ] Check imports resolve to correct files
- [ ] Verify all types exported from fertiliser-types.ts
- [ ] See error message for specific line number
- [ ] Refer to FERTILISER_MANAGEMENT_HANDOFF.md section 2 for type definitions

### Forms Not Submitting
**If form submission shows error**:
- [ ] Check browser console for errors
- [ ] Verify API endpoint exists and is running
- [ ] Check request/response payload matches spec
- [ ] See FERTILISER_MANAGEMENT_HANDOFF.md section 6

### Stock Calculations Wrong
**If stock doesn't match manual calculation**:
- [ ] Verify all transactions present: opening, incoming, outgoing, adjustments
- [ ] Check formula: Opening + Incoming - Outgoing + Adjustments
- [ ] See `getCurrentStock()` function in lib/fertiliser-data.ts
- [ ] Test with simpler product first (fewer transactions)

### Database Connection Issues
**If cannot connect to PostgreSQL**:
- [ ] Verify LOCAL database is running
- [ ] Check connection string in DATABASE_URL
- [ ] Verify credentials (username, password, database name)
- [ ] NEVER use production credentials
- [ ] Ensure local database has all tables created

---

**This checklist ensures a smooth handoff to Codex. Completion of all items = Ready for local testing.**
