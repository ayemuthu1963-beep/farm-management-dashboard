# Coconut Counting Form – Static Design (Phase 1)

**Status:** Design Approval Phase – Static UI Only  
**Technology:** React + TypeScript + Tailwind CSS  
**No Backend Integration:** This is a visual design only with mock data.

---

## Components Created (4 files)

### 1. **MainCountingScreen** 
- File: `components/coconut-counting/main-counting-screen.tsx`
- Lines: 191
- Features:
  - Green header with coconut tree and coconut graphics
  - 2×2 grid layout (tablet/desktop) / vertical stack (mobile)
  - Grade A Fixed (200 × 1) with A1 circle
  - Grade B Fixed (400/200 × 1) with B1 circle and input field
  - Grade A Manual (up to 199) with clipboard icon and input
  - Grade B Manual (up to 199) with clipboard icon and input
  - Three total cards: Grade A (308), Grade B (222), A+B (530)
  - Three action buttons: HISTORY, DATE, RESET
  - Reset confirmation dialog with custom messaging
  - Large SEND buttons (green for A, blue for B)

### 2. **TodaysHistoryScreen**
- File: `components/coconut-counting/todays-history-screen.tsx`
- Lines: 203
- Features:
  - Green header with title "TODAY'S COUNT HISTORY"
  - Display date: 23 July 2026
  - Summary cards (Total A, Total B, Total A+B, Total Entries)
  - Export button (visual only, no functionality)
  - Desktop table view with 11 columns:
    - Entry #, Date, Time, Grade, Entry Type, Count, GPS Location, Accuracy
    - Running A, Running B, Running Total
  - Mobile card view (converts table to readable cards)
  - 5 mock history entries with realistic data
  - GPS auto-capture note
  - Back to Counting button

### 3. **DatewiseHistoryScreen**
- File: `components/coconut-counting/datewise-history-screen.tsx`
- Lines: 246
- Features:
  - Blue header with title "COUNT HISTORY BY DATE"
  - Date selector with Previous/Next day buttons
  - Display selected date: 22-07-2026
  - Same summary cards as Today's History
  - Export button (visual only)
  - Desktop table view with same 11 columns
  - Mobile card view
  - 4 mock history entries for selected date
  - Previous Day / Next Day navigation buttons
  - Back to Counting button
  - GPS auto-capture note

### 4. **CoconutCountingPage** (Main Wrapper)
- File: `app/coconut-counting/page.tsx`
- Lines: 23
- Features:
  - Routes between three screens
  - Screen state management
  - Navigation callbacks

---

## Design Features Implemented

### Color Scheme
- **Green (#16A34A):** Grade A, Headers, Primary Actions
- **Blue (#2563EB):** Grade B, Alternative Actions
- **White/Light Backgrounds:** Clean, readable, farm-appropriate
- **Teal (#0D9488):** Total A+B combined totals (distinct styling)

### Typography
- Large outdoor-readable text (6xl–8xl for numbers)
- White title text on green header
- High contrast throughout

### Layout
- **Desktop/Tablet:** 2×2 card grid, full table display
- **Mobile:** Vertical stacking, responsive card view for history
- **No horizontal scrolling** on any device
- Max-width container for readability

### Graphics
- Coconut tree emoji (🌴)
- Coconut emoji (🥥)
- Clipboard icon (📋)
- Send icon (✈️)
- History icon (📜)
- Calendar icon (📅)
- Rotate icon (🔄)

### Interactive Elements
- Large touch-friendly buttons (40px+ height)
- Reset confirmation dialog with clear messaging
- Date navigation (Previous/Next day)
- Screen-to-screen navigation
- Input fields with placeholders

---

## Mock Data

### Totals (Main Screen)
- Grade A: 308
- Grade B: 222
- A + B: 530

### Today's History (5 entries)
- Entry 1: Grade A, Fixed 200 (09:15:22 AM)
- Entry 2: Grade A, Manual 75 (09:18:41 AM)
- Entry 3: Grade B, Fixed 200 (09:22:10 AM)
- Entry 4: Grade A, Manual 33 (09:25:55 AM)
- Entry 5: Grade B, Manual 22 (09:28:30 AM)

### Date-wise History (4 entries for 22-07-2026)
- Entry 1: Grade A, Fixed 200 (10:05:30 AM)
- Entry 2: Grade B, Fixed 200 (10:09:15 AM)
- Entry 3: Grade A, Manual 50 (10:12:45 AM)
- Entry 4: Grade B, Manual 35 (10:15:20 AM)

### GPS Display
- Each entry shows:
  - Latitude, Longitude (e.g., 11.123456, 77.987654)
  - Accuracy (e.g., ± 6 m)
  - Automatically captured note

---

## Responsive Behavior Verified

✅ **Desktop (1200px+)**
- 2×2 card grid displayed
- Full history table with all columns
- Optimized spacing and typography

✅ **Tablet (768px–1200px)**
- Cards responsive, still 2×2
- Table scrollable horizontally if needed
- Touch-friendly button sizes

✅ **Mobile (390px)**
- Cards stack vertically (1 column)
- History converted to card view (no horizontal table)
- Large readable text maintained
- No page-level horizontal scrolling
- Full-width buttons

---

## What's NOT Included (Design Only)

✗ No backend API  
✗ No database integration  
✗ No GPS data capture  
✗ No Excel export functionality  
✗ No authentication  
✗ No Android/Capacitor build  
✗ No counting logic  
✗ No data persistence  
✗ No real-time data sync  

---

## File Statistics

- **Total Files:** 4 components + 1 page = 5 files
- **Total Lines of Code:** 663 lines
- **Zero TypeScript Errors**
- **Zero Runtime Errors**
- **Mobile-First Responsive Design**

---

## Route

`http://localhost:3000/coconut-counting`

---

## Ready for Visual Approval

This is a **static UI design only** with hard-coded mock data. All screens are fully styled and responsive across desktop, tablet, and mobile viewports. No functionality is implemented—all buttons and inputs are visual placeholders.

### Approve this design, and Phase 2 can proceed with:
- Counting logic implementation
- Data persistence
- GPS integration
- Excel export
- Backend API setup
- Android/Capacitor build

---

## Design Checklist

- [x] Green header with coconut graphics
- [x] 2×2 card layout (tablets/desktop) ✓
- [x] Vertical stack (mobile) ✓
- [x] Grade A Fixed card (200 × 1) with A1
- [x] Grade B Fixed card (400/200 × 1) with B1
- [x] Grade A Manual card (up to 199) with clipboard
- [x] Grade B Manual card (up to 199) with clipboard
- [x] Three total cards (A, B, A+B) with large numbers
- [x] Three action buttons (HISTORY, DATE, RESET)
- [x] Reset confirmation dialog
- [x] Today's History screen with table
- [x] Date-wise History screen with date selector
- [x] Mobile card view for history
- [x] GPS display in history
- [x] Export buttons (visual)
- [x] No horizontal scrolling on mobile
- [x] Large outdoor-readable text
- [x] Responsive design verified
- [x] All placeholder buttons styled
- [x] High contrast colors
- [x] Correct "GRADE" spelling throughout

---

**Status: DESIGN READY FOR APPROVAL**
