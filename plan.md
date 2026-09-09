# Paynest Frontend Plan

## Project Overview

**Framework:** Next.js 16.1.6 (App Router) | **Language:** TypeScript
**UI:** shadcn/ui (new-york theme) + Tailwind CSS v4 | **State:** Zustand 5.0
**HTTP Client:** Axios | **Forms:** React Hook Form + Zod | **Charts:** Recharts
**Animations:** Framer Motion + GSAP | **Barcode:** html5-qrcode | **Testing:** Vitest + RTL

---

## Architecture

```
paynest-frontend-app/
├── src/
│   ├── (api-handlers)/              # 21 API client files
│   │   ├── auditLogHandler.ts
│   │   ├── customersHandler.ts
│   │   ├── dailyClosureHandler.ts
│   │   ├── employeeProfileHandler.ts
│   │   ├── financeHandler.ts
│   │   ├── inventoryHandler.ts
│   │   ├── loginHandler.ts
│   │   ├── logoutHandler.ts
│   │   ├── notificationsHandler.ts
│   │   ├── orderItemsHandler.ts
│   │   ├── orders_walkinsHandler.ts
│   │   ├── organizationHandler.ts
│   │   ├── organizationProfileHandler.ts
│   │   ├── organizationShopsHandler.ts
│   │   ├── paymentsHandler.ts
│   │   ├── productCategoriesHandler.ts
│   │   ├── productsHandler.ts
│   │   ├── registrationHandler.ts
│   │   ├── reportHandler.ts
│   │   ├── stockMovementHandler.ts
│   │   └── userHandler.ts
│   ├── (zustand-store)/             # Global state
│   │   ├── authStore.ts             # User auth + token
│   │   └── salesStore.ts            # Cart + payment method
│   ├── app/
│   │   ├── (auth)/                  # Public auth routes
│   │   │   ├── forget-password/     # Password reset
│   │   │   ├── login/               # Login page
│   │   │   ├── register/            # Registration
│   │   │   └── layout.tsx           # Auth layout
│   │   ├── (pages)/                 # Protected routes (53 pages)
│   │   │   ├── (administrator)/     # Admin-only pages
│   │   │   ├── (superadmin)/        # SuperAdmin-only pages
│   │   │   ├── customers/           # Customer CRUD
│   │   │   ├── dashboard/           # Role-based dashboard
│   │   │   ├── daily-closure/       # EOD workflow
│   │   │   ├── finance/             # Financial overview
│   │   │   ├── inventory/           # Inventory management
│   │   │   ├── notifications/       # Notification feed
│   │   │   ├── order-items/         # Order items list
│   │   │   ├── orders/              # Orders list + detail
│   │   │   ├── organizations/       # Org management
│   │   │   ├── payments/            # Payments list
│   │   │   ├── product_categories/  # Category management
│   │   │   ├── products/            # Product listing
│   │   │   ├── sales/               # Main POS interface
│   │   │   │   └── components/      # POS-specific components
│   │   │   │       ├── BarcodeScannerModal.tsx
│   │   │   │       ├── CartItem.tsx
│   │   │   │       ├── CategoryItem.tsx
│   │   │   │       ├── ProductCard.tsx
│   │   │   │       └── SalesCompletionModal.tsx
│   │   │   ├── sales-report/        # Sales analytics
│   │   │   ├── settings/            # Profile, Security, Notifications, System
│   │   │   ├── stock-movements/     # Stock history
│   │   │   ├── users/               # User management
│   │   │   └── layout.tsx           # Sidebar navigation wrapper
│   │   ├── layout.tsx               # Root layout (fonts, toast)
│   │   └── page.tsx                 # Root redirect
│   ├── components/
│   │   ├── (shared-components)/     # Reusable components
│   │   │   ├── sidebar-navigation.tsx  # Main nav (400+ lines)
│   │   │   ├── PageHeader.tsx
│   │   │   ├── Loading.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── SplitText.tsx
│   │   │   └── Pagination.tsx
│   │   └── ui/                      # shadcn/ui components
│   ├── interfaces/                  # 20 TypeScript type definitions
│   ├── lib/
│   │   ├── utils.ts                 # cn() Tailwind merge
│   │   ├── getToken.ts              # Token extraction
│   │   └── handleErrorMessage.ts
│   ├── utils/zod/                   # Zod validation schemas
│   └── middleware.ts                # Route protection
├── components.json                  # shadcn/ui config
├── vitest.config.ts
├── package.json
└── .env.example
```

**Total:** 137 TypeScript/TSX files | 21 API handlers | 53 page components | 20 interface definitions

---

## Pages & Routes

### Public Routes (Authentication)
| Route | Page | Description |
|-------|------|-------------|
| `/login` | Login | Email/username + password (FormData to OAuth2) |
| `/register` | Register | User registration with invitation code |
| `/forget-password` | Forgot Password | Password reset request |

### Protected Routes - Dashboard & Admin
| Route | Role Required | Description |
|-------|--------------|-------------|
| `/dashboard` | Admin/SuperAdmin | Role-based dashboard (AdminView) |
| `/organizations` | SuperAdmin | List all organizations |
| `/organizations/create` | SuperAdmin | Create new organization |
| `/organization_shops` | Admin | Manage organization shops |
| `/organization_profile` | Admin | Edit organization profile |

### Protected Routes - User Management
| Route | Role Required | Description |
|-------|--------------|-------------|
| `/users` | All roles | User list (role-filtered) |
| `/users/[id]` | All roles | User detail page |
| `/users/setup-employee-profile` | Admin | Create employee profile |
| `/users/edit-employee-profile/[id]` | SuperAdmin | Edit employee profile |
| `/users/roles` | SuperAdmin | Roles & permissions matrix |

### Protected Routes - POS & Sales
| Route | Role Required | Description |
|-------|--------------|-------------|
| `/sales` | Attendant+ | Main POS interface (cart, barcode, checkout) |
| `/orders` | Manager+ | Orders & walk-ins list (50/page) |
| `/orders/[id]` | Manager+ | Order detail |
| `/order-items` | Manager+ | All order items list |
| `/payments` | Manager+ | Payment list |
| `/sales-report` | Manager+ | Daily sold items analytics |

### Protected Routes - Inventory & Products
| Route | Role Required | Description |
|-------|--------------|-------------|
| `/inventory` | Manager+ | Inventory list |
| `/inventory/create` | Manager+ | Create inventory record |
| `/stock-movements` | Manager+ | Stock movement history |
| `/products` | Manager+ | Product list |
| `/product_categories` | Manager+ | Category management |

### Protected Routes - Customers & Finance
| Route | Role Required | Description |
|-------|--------------|-------------|
| `/customers` | Attendant+ | Customer list (20/page) |
| `/customers/create` | Attendant+ | Create customer |
| `/customers/edit/[id]` | Attendant+ | Edit customer |
| `/daily-closure` | Manager+ | End-of-day closure (role-specific views) |
| `/daily-closure/[id]` | Manager+ | Closure detail |
| `/finance` | Admin+ | Financial overview |

### Protected Routes - Reports & Settings
| Route | Role Required | Description |
|-------|--------------|-------------|
| `/report` | Admin | All reports (paginated) |
| `/report/[id]` | Admin | Report detail with preview |
| `/report/my_report` | Admin | User's own reports |
| `/report/pending` | Admin | Pending approvals |
| `/settings/profile` | All roles | Edit profile |
| `/settings/security` | All roles | Change password |
| `/settings/notifications` | All roles | 12 notification preference toggles |
| `/settings/system` | SuperAdmin | System info |
| `/notifications` | All roles | Full notification feed (20/page) |

---

## State Management

### authStore (Zustand, persisted to localStorage)
```typescript
{
  user: UserResponse | null
  accessToken: string | null
  isAuthenticated: boolean
  setAuth(authData): void
  clearAuth(): void
  updateUser(userData): void
}
```
- Persisted as `pos-auth-storage` in localStorage
- Token also stored in `pos_token` cookie (30-day max age)
- Role stored in `user_role` cookie

### salesStore (Zustand, session only - NOT persisted)
```typescript
{
  isOrderMode: boolean                  // false = walk-in, true = order
  cart: Record<number, CartItemData>    // productId -> { product, quantity }
  paymentMethod: "cash" | "bank transfer" | "mobile transfer"

  toggleOrderMode(): void
  addToCart(product): void
  updateCartQuantity(productId, delta): void
  removeFromCart(productId): void
  clearCart(): void
  setPaymentMethod(method): void
}
```

---

## Key Components

### Sidebar Navigation (`sidebar-navigation.tsx`, 400+ lines)
- Collapsible left drawer (mobile responsive)
- Role-based menu filtering (different items per role)
- Notification bell: 15-item dropdown, 20-second polling, unread badge
- Immediate refresh on tab focus (`visibilitychange` event)
- Logout with confirmation

### POS Sales Components
| Component | Purpose |
|-----------|---------|
| `BarcodeScannerModal` | Camera + manual barcode input, calls `GetProductByBarcode()` |
| `CartItem` | Cart line item with quantity +/- controls |
| `ProductCard` | Product grid card, click to add to cart |
| `CategoryItem` | Category filter chip in horizontal scroll |
| `SalesCompletionModal` | Checkout flow: payment method, walk-in/order toggle, discount, receipt printing |

### Shared Components
| Component | Purpose |
|-----------|---------|
| `PageHeader` | Title + description header for all pages |
| `Pagination` | Offset-based pagination (tested with vitest) |
| `Loading` | Skeleton loader |
| `EmptyState` | Empty data placeholder |
| `SplitText` | Animated branding text (Framer Motion) |

---

## API Integration

### Configuration
- Base URL: `NEXT_PUBLIC_AXIOS_API_BASE_URL` (default `http://127.0.0.1:8000`)
- Auth: JWT Bearer token from `useAuthStore.getState().accessToken`
- All handlers use Axios with async/await

### API Handlers (21 files)
| Handler | Functions | Backend Routes |
|---------|-----------|---------------|
| `loginHandler` | `loginWithFormData()` | POST `/auth/token` |
| `logoutHandler` | `LogoutHandler()` | POST `/auth/logout` |
| `registrationHandler` | `registerUser()` | POST `/auth/register` |
| `userHandler` | `getUserData()`, `updateUserProfile()`, `changePassword()`, `getNotificationPreferences()`, `updateNotificationPreferences()` | `/user/me/*` |
| `productsHandler` | `GetProducts()`, `GetProductByBarcode()`, `GetProductsByCategory()`, `CreateProduct()`, `UpdateProdctDetails()`, `DeleteProduct()` | `/products/*` |
| `productCategoriesHandler` | `GetProductCategories()`, `CreateProductCategory()`, `UpdateProductCategory()`, `DeleteProductCategory()` | `/categories/*` |
| `inventoryHandler` | `CreateInventory()`, `GetAllInventory()`, `GetInventoryByID()`, `UpdateInventory()`, `DeleteInventory()` | `/inventory/*` |
| `stockMovementHandler` | `GetStockMovements()` | `/stock-movements/` |
| `customersHandler` | `GetAllCustomers()`, `GetCustomerByID()`, `CreateCustomer()`, `UpdateCustomer()`, `DeleteCustomer()` | `/customers/*` |
| `orders_walkinsHandler` | `CreateWalkIns()`, `GetWalkinOrdersList()`, `GetWalkinOrderById()`, `CloseOrder()`, `UpdateOrderStatus()`, `GetSoldItemsReport()` | `/orders/*` |
| `orderItemsHandler` | `GetOrderItems()` | `/order-items/` |
| `paymentsHandler` | `GetPayments()` | `/payments/` |
| `dailyClosureHandler` | `CreateDailyClosure()`, `GetDailyClosures()`, `GetDailyClosureByID()`, `UpdateDailyClosure()` | `/daily-closures/*` |
| `financeHandler` | `GetFinance()` | `/finance/` |
| `reportHandler` | `createReport()`, `getAllReports()`, `getMyResports()`, `getReportByID()`, `updateReport()`, `getPendingReports()`, `getReportPreview()`, `downloadReport()` | `/reports/*` |
| `notificationsHandler` | `getNotifications()`, `markNotificationRead()`, `markAllNotificationsRead()`, `createNotificationStream()` | `/notifications/*` |
| `auditLogHandler` | `GetAuditLog()` | `/audit-logs/` |
| `organizationHandler` | Full CRUD | `/organizations/*` |
| `organizationProfileHandler` | `GetOrganizationProfile()`, `UpdateOrganizationProfile()` | `/organization/me` |
| `organizationShopsHandler` | Full CRUD | `/organization/shops/*` |
| `employeeProfileHandler` | Full CRUD | `/employee-profile/*` |

---

## Design System

### Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#10295E` (Deep Navy) | Buttons, active states, branding |
| Secondary | `#3B82F6` (Modern Blue) | Links, accents |
| Background | `#F8FAFC` (Light Slate) | Page background |
| Surface | `#FFFFFF` | Cards, modals |
| Text Primary | `#0F172A` | Headlines, body |
| Text Secondary | `#475569` | Labels, descriptions |
| Success | `#16A34A` | Success states |
| Warning | `#F59E0B` | Warning states |
| Error | `#DC2626` | Error states |
| Info | `#0284C7` | Info badges |

### Typography & Spacing
- Font: System fonts via Next.js
- Border radius: 0.625rem (10px) default
- Dark mode: CSS variable-based, togglable
- Currency: GHS (Ghana Cedis) throughout

### Notification Color Coding
| Type | Color |
|------|-------|
| new_order | Blue |
| low_stock | Amber |
| report_ready | Violet |
| daily_closure | Emerald |
| system_alert | Rose |

---

## Features Completed

### Authentication & Session
- [x] Login with email/username + password (OAuth2 FormData)
- [x] Registration with invitation code
- [x] Password reset (forgot password flow)
- [x] JWT token management (cookie + localStorage)
- [x] Middleware route protection
- [x] Role-based redirect on login (attendant->sales, manager->orders, admin->dashboard)
- [x] Logout with token blacklisting

### POS Sales System
- [x] Product listing with search + category filter
- [x] Shopping cart (add, remove, quantity +/-)
- [x] Walk-in vs Order mode toggle
- [x] Barcode scanner (camera + manual input via html5-qrcode)
- [x] Checkout flow with payment method selection
- [x] Discount amount input
- [x] Order mode: customer selector + delivery address
- [x] Subtotal, Tax (4%), Total calculation
- [x] Receipt printing (browser print dialog, isolated print area)

### Inventory & Products
- [x] Inventory list (paginated)
- [x] Create/update/delete inventory records
- [x] Stock movement history (paginated)
- [x] Product list (paginated, role-filtered)
- [x] Product CRUD
- [x] Category list + CRUD
- [x] Product-category filtering in POS

### Orders & Payments
- [x] Orders/walk-ins list (paginated, 50/page)
- [x] Order detail view (customer info + items)
- [x] Order status management (5 status transitions)
- [x] Payments list (paginated)
- [x] Sold items report (date-filtered, paginated)

### Notifications
- [x] Notification bell in sidebar (15-item dropdown)
- [x] 20-second polling + tab focus refresh
- [x] Unread badge count
- [x] Mark individual / all as read
- [x] Full notification feed page (20/page, offset-based)
- [x] Color-coded by type
- [x] Click-through to linked entity
- [x] Notification preferences (12 toggles: 6 types x 2 channels)

### User & Organization Management
- [x] User list + detail pages
- [x] Employee profile setup/edit
- [x] Roles & permissions matrix view
- [x] Organization list (superadmin)
- [x] Create organization
- [x] Edit organization profile
- [x] Shops management

### Customer Management
- [x] Customer list (paginated, 20/page)
- [x] Create/edit/delete customers
- [x] Customer selector in order checkout

### Finance & Reports
- [x] Finance overview page
- [x] Report CRUD + approval workflow
- [x] My reports / pending reports views
- [x] Report preview (inline table + stats)
- [x] Report download (blob -> file)

### Advanced Analytics (2026-09-09, backend plan §3.3 — `/analytics/*`, behind the `reports_advanced` ModuleGuard, admin + manager)
- [x] Report Builder page (`/analytics/report-builder`) — dataset picker (driven by `GET /analytics/datasets`), Detail vs Grouped mode, column / group-by / aggregation-row / `field·op·value` filter / sort builders, save·edit·delete definitions, run with date-range + shop filter into a results table + summary chips, export to PDF/Excel/CSV/JSON (generates + downloads the report file)
- [x] Consolidated multi-shop report (`/analytics/consolidated`) — date range → per-shop table (orders, revenue, COGS, gross/net profit, expenses, AOV, inventory value, out/low stock) + ORG TOTAL row + summary strip + CSV export
- [x] Forecasting (`/analytics/forecast`) — sales forecast composed chart (history line + dashed forecast line + confidence band + "today" seam marker) with metric/lookback/horizon/shop controls and recent-vs-projected delta; days-to-stockout table with at-risk badge, sales rate, projected date, suggested reorder qty
- [x] Report Schedules (`/analytics/schedules`) — cron schedule CRUD (preset cadences or raw 5-field cron), standard report type or saved custom report, format, window days, recipient multiselect, auto-approve toggle, run-now, pause/activate, next/last-run columns
- [x] KPI Alerts (`/analytics/alerts`) — rule CRUD (11 metrics × comparison × threshold × window, per-shop scope, in-app/email channels, cooldown), test-now toast (observed vs threshold), per-rule event history
- [x] `src/interfaces/analytics.ts` + `src/(api-handlers)/analyticsHandler.ts`; "Advanced Analytics" nav group under Reports & Finance; `analytics/layout.tsx` guard

### Daily Closure
- [x] Daily closure workflow (role-specific views: Admin/Attendant)
- [x] Closure detail page

### Settings
- [x] Profile editing (name, phone, username)
- [x] Security (change password)
- [x] Notification preferences
- [x] System info (superadmin)

### Audit & Logging
- [x] Audit log list (superadmin, paginated, 20/page)

### Quality
- [x] TypeScript strict mode
- [x] ESLint 9
- [x] Form validation (React Hook Form + Zod)
- [x] Error handling with toast notifications
- [x] Responsive design (mobile-first breakpoints)
- [x] Dark mode support (CSS variables)
- [x] Vitest tests (utils + Pagination component)

---

## Features Partially Implemented

- [ ] **SSE Notifications** - `createNotificationStream()` handler exists but uses polling instead for reliability
- [ ] **Loyalty Program UI** - Customer model has loyalty_points/tier fields, no management interface
- [ ] **Receipt Printing** - Works via browser print dialog; no thermal/ESC-POS printer support
- [ ] **Email Notifications** - Preferences UI complete; backend SMTP not configured
- [ ] **Dashboard Analytics** - AdminView exists but limited charts/widgets
- [ ] **Inventory Alerts UI** - Backend sends low_stock notifications; no dedicated alerts view

---

## Features Missing to Complete the App

### Phase 1: Core UX Gaps (High Priority)

#### 1.1 Payroll Module UI
- [ ] Payroll dashboard page (`/payroll`)
- [ ] Employee salary configuration form
- [ ] Timesheet entry/management page (`/timesheets`)
- [ ] Clock-in/clock-out interface (for attendants)
- [ ] Pay period list + payroll run page
- [ ] Pay slip viewer (PDF preview)
- [ ] Payroll approval workflow UI
- [ ] Employee self-service: view pay slips, request leave
- [ ] Payroll reports page
- [ ] API handlers for payroll endpoints

#### 1.2 Return/Refund UI
- [ ] Return order page (select order -> select items -> reason)
- [ ] Refund calculator (full/partial)
- [ ] Return confirmation + receipt
- [ ] Returns list/history page
- [ ] Return reason dropdown (defective, wrong item, customer changed mind, etc.)

#### 1.3 Enhanced Dashboard
- [ ] Revenue chart (Recharts line/bar chart, daily/weekly/monthly)
- [ ] Top products widget
- [ ] Sales by category pie chart
- [ ] Recent orders feed
- [ ] Low stock alerts widget
- [ ] Daily closure status widget
- [ ] Manager dashboard view (currently redirects to /orders)
- [ ] Attendant dashboard view (currently redirects to /sales)

#### 1.4 Product Management Enhancements
- [ ] Product create/edit form page (currently only list view)
- [ ] Product image upload
- [ ] Bulk product import (CSV)
- [ ] Barcode generation + print
- [ ] Product variants (size, color)

### Phase 2: Business Features (Medium Priority)

#### 2.1 Expense Tracking UI
- [ ] Expense list page (`/expenses`)
- [ ] Create expense form (amount, category, receipt upload)
- [ ] Expense categories management
- [ ] Expense approval workflow
- [ ] Monthly expense summary chart

#### 2.2 Supplier/Vendor Management
- [ ] Supplier list page (`/suppliers`)
- [ ] Supplier CRUD form
- [ ] Purchase order creation
- [ ] PO approval workflow
- [ ] PO -> Inventory receiving workflow

#### 2.3 Advanced Inventory UI
- [ ] Inventory transfer page (shop-to-shop)
- [ ] Transfer request/approve/receive workflow
- [ ] Stock adjustment form (with reason codes)
- [ ] Reorder alerts dashboard
- [ ] Inventory valuation report
- [ ] Expiry date tracking (for perishables)

#### 2.4 Customer Loyalty Program
- [ ] Loyalty points dashboard
- [ ] Points earning rules configuration
- [ ] Points redemption at checkout
- [ ] Loyalty tier management (bronze/silver/gold)
- [ ] Customer rewards history

#### 2.5 Discount & Promotion Management
- [ ] Promo code CRUD page (`/promotions`)
- [ ] Promo code application at checkout
- [ ] Active promotions banner
- [ ] Volume/tiered discount configuration
- [ ] Scheduled promotions (start/end date)

#### 2.6 Leave & HR Management UI
- [ ] Leave request form
- [ ] Leave calendar view
- [ ] Leave approval workflow (manager)
- [ ] Leave balance dashboard
- [ ] Employee schedule/shift view

### Phase 3: Integrations & Infrastructure (Lower Priority)

#### 3.1 Payment Gateway Integration
- [ ] Stripe/Flutterwave checkout flow
- [ ] Mobile money payment modal (MTN MoMo, Vodafone Cash)
- [ ] Card payment form
- [ ] Payment confirmation screen
- [ ] Transaction history with gateway details

#### 3.2 Advanced Reporting — done 2026-09-09 (see "Advanced Analytics" under Features Completed)
- [x] Custom report builder page — `/analytics/report-builder`
- [x] Report scheduling UI (cron: presets + raw) — `/analytics/schedules`
- [x] KPI alert configuration — `/analytics/alerts`
- [x] Export to PDF/Excel/CSV/JSON from the report builder results
- [x] Consolidated multi-shop report + sales/stockout forecasting charts — `/analytics/consolidated`, `/analytics/forecast`
- [ ] Interactive charts dashboard (drill-down) — not built (forecast + dashboards cover the common cases)

#### 3.3 Communication Center
- [ ] In-app messaging (admin -> staff)
- [ ] Announcement broadcasts
- [ ] SMS notification integration
- [ ] Email template editor

#### 3.4 Multi-language Support
- [ ] i18n framework setup (next-intl or react-i18next)
- [ ] Language switcher
- [ ] Translation files (English, French, Twi for Ghana)
- [ ] RTL support

### Phase 4: Polish & Performance

#### 4.1 UX Improvements
- [ ] Keyboard shortcuts for POS (e.g., F1-F4 for payment methods)
- [ ] Offline mode with sync queue (Service Worker)
- [ ] Progressive Web App (PWA) manifest
- [ ] Touch-optimized POS for tablet
- [ ] Drag-and-drop cart reordering
- [ ] Quick search (Cmd+K global search)

#### 4.2 Performance Optimization
- [ ] React Query / SWR for server state (replace manual fetch+state)
- [ ] Optimistic UI updates
- [ ] Virtual scrolling for large lists
- [ ] Image optimization (next/image for product images)
- [ ] Bundle size analysis + code splitting
- [ ] Prefetching for common navigation paths

#### 4.3 Testing Expansion
- [ ] E2E tests (Playwright/Cypress)
- [ ] Component tests for all major components
- [ ] API handler tests (mock Axios)
- [ ] Integration tests for complete flows (login -> POS -> checkout)
- [ ] Accessibility testing (axe-core)

#### 4.4 Accessibility
- [ ] ARIA labels on all interactive elements
- [ ] Keyboard navigation for POS
- [ ] Screen reader support
- [ ] Focus management
- [ ] Color contrast compliance (WCAG AA)

#### 4.5 Error Handling & Resilience
- [ ] Global error boundary
- [ ] Retry logic for failed API calls
- [ ] Offline detection banner
- [ ] Session expiry detection + re-login prompt
- [ ] Rate limit feedback to user

---

## Completion Assessment

| Area | Status | Completion |
|------|--------|------------|
| Authentication & Session | Done | 95% |
| POS Sales System | Done | 85% |
| Inventory & Products | Done | 75% |
| Orders & Payments | Done | 80% |
| Notifications | Done | 90% |
| User Management | Done | 85% |
| Customer Management | Done | 80% |
| Finance & Reports | Done | 70% |
| Daily Closure | Done | 80% |
| Settings | Done | 85% |
| Dashboard | Partial | 40% (needs charts/widgets) |
| Payroll Module | Missing | 0% |
| Returns/Refunds UI | Missing | 0% |
| Expense Tracking | Missing | 0% |
| Supplier Management | Missing | 0% |
| Loyalty Program | Partial | 10% |
| Payment Gateway | Missing | 0% |
| Testing | Started | 15% |
| Accessibility | Missing | 10% |
| **Overall Frontend** | | **~55%** |

---

## Priority Order for Completion

1. **Enhanced Dashboard** - First thing users see; needs charts, widgets, KPIs
2. **Payroll Module UI** - Core missing feature matching the app name
3. **Return/Refund UI** - Essential POS flow
4. **Product Create/Edit Pages** - Currently only list view exists
5. **Payment Gateway Integration** - Replace manual payment entry
6. **Dashboard per Role** - Manager + Attendant need their own views
7. ~~Advanced Reporting~~ - done 2026-09-09 (report builder, consolidated, forecasting, schedules, KPI alerts under `/analytics/*`)
8. **Expense Tracking** - Complete financial picture
9. **React Query Migration** - Replace manual fetch patterns for better UX
10. **E2E Testing** - Production confidence
11. **PWA / Offline Mode** - Reliability for retail environments
12. **Accessibility** - WCAG compliance
