# Kaffa Coffee Roasters — Web Application Frontend

A modern, responsive, specialty coffee ordering and roastery kitchen management web application built with **React 18**, **TypeScript**, **Vite**, and **Tailwind CSS**.

The frontend interacts with the FastAPI backend strictly according to [`API_CONTRACT.md`](../API_CONTRACT.md), maintaining **zero modifications** to the backend codebase while implementing resilient fallbacks and comprehensive client-side validation.

---

## ☕ Key Features

### 1. Customer Ordering Experience
- **Outlet Selection**: Real-time outlet discovery displaying operating hours, current open/closed status, street address, and estimated preparation time. Persisted globally to scope the menu.
- **Dynamic Menu & Customization**:
  - Outlet-scoped categorization (`Hot Coffee`, `Cold Coffee`, `Matcha & Teas`, `Bakery & Food`, `Add-ons`).
  - Out-of-stock / sold-out state indicators with disabled purchase controls.
  - Interactive drink customizer modal supporting size selection, milk alternatives, sweetness levels, and add-on modifiers with live price deltas.
  - 1-tap "Save as Favorite Preset" to reorder personalized builds with a single click.
- **Cart & Transparent Checkout**:
  - Itemized quantity editing and custom modifier reconfiguration.
  - Real-time subtotal, 5% GST calculation, and loyalty discount deductions.
  - Pickup slot selection: **Brew Now (Immediate)** or **Scheduled Pickup** adhering to outlet operating hours and roastery prep buffers.
  - Loyalty point redemption validator enforcing the backend's minimum threshold, balance constraints, and maximum payable caps.
  - Payment gateway simulation modal (supporting UPI, Credit/Debit Cards, Net Banking) with simulated decline testing and real backend order submission.
- **Live Order Tracking & History**:
  - Real-time order progress tracking (`ORDER_RECEIVED` $\rightarrow$ `PREPARING` $\rightarrow$ `READY_FOR_PICKUP` $\rightarrow$ `COMPLETED`) powered by 3-second live polling.
  - One-click customer order cancellation (reversing points).
  - "Repeat Previous Order" 1-click reorder mechanism calling `POST /api/orders/{id}/repeat`.
  - Comprehensive order history with status filter tabs (`All`, `Active`, `Completed`, `Cancelled`) and instant ID search.
- **Loyalty Ledger**:
  - Visual points card displaying available balance, equivalent rupee discount, and redemption progress.
  - Complete chronological audit log of all point earnings, redemptions, and refund reversals tied to order IDs.

### 2. Barista & Admin Portal (`/admin` and `/staff`)
- **Kitchen Orders Board**:
  - Live 3-second polling on `GET /api/staff/orders`.
  - Filter tabs across all order states with real-time counters.
  - Scheduled vs Immediate pickup badges with formatted IST timestamps.
  - One-click **Accept** (`PATCH /api/staff/orders/{id}/decision`, `action: "ACCEPT"`).
  - Modal **Reject with Reason** (`action: "REJECT"`), triggering automatic customer point refunds.
  - Order state machine transitions: *Brewing* $\rightarrow$ *Ready at Counter* $\rightarrow$ *Completed / Handed Over*.
- **Customer & Payment Details View**:
  - Detailed modal showing customer identifiers, scheduled pickup times, itemized modifiers, 5% GST, loyalty discounts, and payment status (`PAID` / `REFUNDED`).
- **Menu & Catalog Management**:
  - Global catalog availability toggle (`PATCH /api/staff/products/{id}/availability`).
  - Outlet-specific stock override (`PATCH /api/staff/products/{id}/outlet-availability`).
  - Add new products modal with custom modifier builder (`POST /api/staff/products`).
  - Delete products and associated modifiers (`DELETE /api/staff/products/{id}`).
- **Strict Role Gating**:
  - Enforced via `ProtectedRoute` allowing only `staff` and `admin` roles, matching the backend's `User.role` schema.
  - Unauthorized customers are blocked with an informative access denied screen.

---

## 🛠 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Core Framework** | [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Build Tool** | [Vite 5](https://vitejs.dev/) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) + Custom typography (`Playfair Display` & `Plus Jakarta Sans`) |
| **Server State & Polling** | [TanStack React Query v5](https://tanstack.com/query/latest) |
| **Client State** | [Zustand](https://github.com/pmndrs/zustand) (cart persistence, selected outlet) |
| **HTTP Client** | [Axios](https://axios-http.com/) (JWT interceptors & 401 handling) |
| **Icons** | [Lucide React](https://lucide.dev/) |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18.0.0 or later)
- **npm** (v9.0.0 or later)
- Backend server running on `http://127.0.0.1:8000` (or configured URL)

### 2. Installation
```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install
```

### 3. Environment Configuration
Create a `.env` file in the `frontend` root (or copy `.env.example`):
```bash
cp .env.example .env
```

Contents of `.env`:
```env
# Roastery Backend API Base URL
VITE_API_BASE_URL=http://localhost:8000/api
```

### 4. Running the Development Server
```bash
npm run dev
```
The application will be accessible at: **`http://localhost:5173`**

### 5. Production Build & Verification
```bash
# Type check and build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 🔐 Credentials for Testing

| Persona | Email | Password | Role | Access |
| :--- | :--- | :--- | :--- | :--- |
| **Customer** | `alex@coffee.com` | `alex123` | `customer` | Full customer ordering, cart, tracking, loyalty ledger |
| **Staff / Barista** | `staff@coffee.com` | `staff123` | `staff` | Kitchen orders board (`/staff`, `/admin`), catalog management |

*(Quick-autofill buttons are provided on the `/login` screen for rapid testing)*

---

## 🔍 Validation Coverage Audit (vs API_CONTRACT.md)

| Form / Flow | Field | Validation Rules | Error Behavior |
| :--- | :--- | :--- | :--- |
| **Registration** | `full_name` | Required, 2–100 characters. | Inline field error message. |
| | `email` | Required, valid RFC 5322 regex. | Inline field error message. |
| | `phone_number` | Required, 10–15 digits (clean string). | Inline field error message. |
| | `password` | Required, 6–128 characters. | Inline field error message. |
| **Login** | `email` / `password` | Required non-empty; min 6 chars. | Inline validation & HTTP 401 banner. |
| **Cart & Checkout** | `outlet_id` | Must be selected in state. | Blocks checkout with prompt to select outlet. |
| | `pickup_type` | `'immediate'` or `'scheduled'`. | Validated before checkout submission. |
| | `scheduled_pickup_time` | If scheduled: must be in the future, within outlet open/close hours, and account for `avg_prep_minutes`. | Inline warning and blocks modal opening. |
| | `points_to_redeem` | Minimum 50 points; $\le$ available balance; $\le$ payable total. | Live error warning; capped automatically. |
| | `items` | Minimum 1 item; `quantity` $\ge 1$. | Blocks checkout when cart is empty. |
| **Staff Dashboard** | Rejection Reason | String captured in modal. | Passed in `PATCH /staff/orders/{id}/decision`. |
| | Product Creation | Name required, base price > 0, category valid enum, modifiers validated. | Disables submit until required fields valid. |

---

## ⚙️ Backend Assumptions & Resilient Handling

During development against [`API_CONTRACT.md`](../API_CONTRACT.md) and the live backend, several real-world behaviors were discovered and gracefully addressed without touching the backend code:

1. **Customer Order Details Serialization Gotcha (`GET /api/orders/{order_id}`)**:
   - In `backend/app/api/orders.py`, the endpoint `get_order_details` omitted a return statement at the end of the handler, causing FastAPI to return HTTP `500 Internal Server Error`.
   - **Frontend Solution**: [OrderTrackingPage.tsx](src/pages/OrderTrackingPage.tsx) attempts `GET /orders/{order_id}` with a resilient automatic fallback to `GET /orders` filtering by `order.id`. This ensures customer order tracking is 100% reliable with zero downtime.
2. **Loyalty Redemption Rule Enforcement**:
   - Backend enforces a minimum redemption threshold of **50 points**, where 1 point = ₹1.00 discount. Points are capped at the total amount payable.
   - Frontend provides live client-side validation reflecting this policy, preventing invalid API payloads.
3. **Staff Role Gating Mechanism**:
   - The backend's `get_current_staff` dependency strictly permits accounts where `User.role in ['staff', 'admin']` and returns HTTP `403 Forbidden` for standard customer accounts.
   - The frontend's `ProtectedRoute` strictly enforces `allowedRoles={['staff', 'admin']}` on `/staff` and `/admin` routes without inventing artificial role hierarchies.
4. **Dynamic Pickup Slot Generation**:
   - The frontend dynamically computes valid future pickup slots in 15-minute increments based on the outlet's `opening_time`, `closing_time`, and `avg_prep_minutes`, preventing customer orders outside operating hours.
5. **Simulated Payment Gateway**:
   - The backend handles payment confirmation via order creation and order status updates. The frontend wraps this in a realistic simulated checkout gateway (supporting failure testing) that directly submits the payload to the real backend order and payment endpoints.
