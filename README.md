# ☕ Kaffee — Coffee Shop Ordering & Roastery Management Platform

A full-stack, production-style **coffee ordering and roastery kitchen management system**, built as a monorepo with a **FastAPI** backend and a **React 18 + TypeScript + Vite** frontend. Customers can browse outlet-specific menus, customize drinks, check out, track orders live, and earn/redeem loyalty points — while staff and admins run the kitchen from a dedicated operations dashboard.

**Live demo:** [kaffee-coffee-shop-indol.vercel.app](https://kaffee-coffee-shop-indol.vercel.app)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Key Features](#key-features)
  - [Customer Experience](#1-customer-ordering-experience)
  - [Barista & Admin Portal](#2-barista--admin-portal)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#1-prerequisites)
  - [Backend Setup](#2-backend-setup)
  - [Frontend Setup](#3-frontend-setup)
  - [Running with Docker](#4-running-with-docker)
- [Test Credentials](#test-credentials)
- [Validation Coverage](#validation-coverage)
- [Backend Assumptions & Resilient Handling](#backend-assumptions--resilient-handling)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## Overview

Kaffee is split into two independently deployable services that communicate over a documented REST contract (`API_CONTRACT.md`):

| Service | Description |
|---|---|
| **`backend/`** | A FastAPI application exposing auth, outlet, menu, order, and staff-management endpoints, backed by SQLAlchemy models and a seed script. |
| **`frontend/`** | A React + TypeScript SPA that consumes the backend strictly according to the API contract, with resilient client-side fallbacks and full form validation. |

The two halves are designed to be built and shipped separately (see `render.yaml` for a Render.com blueprint and `docker-compose.yml` for local multi-container orchestration).

## Architecture

```
Customer / Staff Browser
        │
        ▼
 React 18 + TS + Vite  (frontend/, port 5173 dev / 80 prod)
        │  Axios + JWT interceptors, 3s polling
        ▼
 FastAPI backend       (backend/, port 8000)
        │  SQLAlchemy ORM
        ▼
   Relational Database
```

- **Auth**: JWT-based, role-gated (`customer`, `staff`, `admin`).
- **State sync**: Live order status is kept fresh via 3-second polling rather than websockets, on both the customer tracking page and the staff kitchen board.
- **Contract-first**: The frontend treats `API_CONTRACT.md` as the source of truth and makes **zero modifications** to backend code, instead building resilient fallbacks for any real-world quirks it discovers (see [Backend Assumptions](#backend-assumptions--resilient-handling)).

---

## Key Features

### 1. Customer Ordering Experience

- **Outlet Selection** — real-time outlet discovery with operating hours, live open/closed status, address, and estimated prep time. The chosen outlet is persisted globally and scopes the entire menu.
- **Dynamic Menu & Customization**
  - Outlet-scoped categories: `Hot Coffee`, `Cold Coffee`, `Matcha & Teas`, `Bakery & Food`, `Add-ons`.
  - Out-of-stock / sold-out indicators that disable purchase controls.
  - A drink customizer modal for size, milk alternatives, sweetness level, and add-on modifiers with live price deltas.
  - One-tap **"Save as Favorite Preset"** to reorder a personalized build instantly.
- **Cart & Transparent Checkout**
  - Itemized quantity editing and modifier reconfiguration.
  - Real-time subtotal, 5% GST calculation, and loyalty discount deductions.
  - Pickup slot selection: **Brew Now (Immediate)** or **Scheduled Pickup**, constrained to outlet hours plus roastery prep buffers.
  - Loyalty point redemption validator enforcing minimum threshold, balance limits, and payable caps.
  - A simulated payment gateway (UPI, Credit/Debit Card, Net Banking) — including simulated decline testing — that submits real orders to the backend.
- **Live Order Tracking & History**
  - Real-time status progression: `ORDER_RECEIVED → PREPARING → READY_FOR_PICKUP → COMPLETED`, via 3-second polling.
  - One-click order cancellation with automatic loyalty point reversal.
  - **"Repeat Previous Order"** — one-click reorder via `POST /api/orders/{id}/repeat`.
  - Full order history with status filter tabs (`All`, `Active`, `Completed`, `Cancelled`) and instant order-ID search.
- **Loyalty Ledger**
  - A points card showing available balance, rupee-equivalent discount, and redemption progress.
  - A chronological audit log of every earning, redemption, and refund reversal, tied back to order IDs.

### 2. Barista & Admin Portal

Available at `/staff` and `/admin`.

- **Kitchen Orders Board**
  - Live 3-second polling on `GET /api/staff/orders`.
  - Filter tabs across every order state, with real-time counters.
  - Scheduled vs. Immediate pickup badges with formatted IST timestamps.
  - One-click **Accept** (`PATCH /api/staff/orders/{id}/decision`, `action: "ACCEPT"`).
  - **Reject with Reason** modal (`action: "REJECT"`), which automatically triggers a customer point refund.
  - Order state machine: *Brewing → Ready at Counter → Completed / Handed Over*.
- **Customer & Payment Details View** — a detailed modal showing customer identifiers, scheduled pickup time, itemized modifiers, GST, loyalty discount, and payment status (`PAID` / `REFUNDED`).
- **Menu & Catalog Management**
  - Global catalog availability toggle (`PATCH /api/staff/products/{id}/availability`).
  - Outlet-specific stock overrides (`PATCH /api/staff/products/{id}/outlet-availability`).
  - Add new products with a custom modifier builder (`POST /api/staff/products`).
  - Delete products and their associated modifiers (`DELETE /api/staff/products/{id}`).
- **Strict Role Gating** — enforced client-side via `ProtectedRoute` (`allowedRoles={['staff', 'admin']}`), matching the backend's `User.role` schema. Standard customers see an informative access-denied screen rather than a blank page.

---

## Tech Stack

### Frontend

| Layer | Technology |
|---|---|
| Core Framework | [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| Build Tool | [Vite 5](https://vitejs.dev/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) + custom typography (`Playfair Display`, `Plus Jakarta Sans`) |
| Server State & Polling | [TanStack React Query v5](https://tanstack.com/query/latest) |
| Client State | [Zustand](https://github.com/pmndrs/zustand) (cart persistence, selected outlet) |
| HTTP Client | [Axios](https://axios-http.com/) with JWT interceptors and 401 handling |
| Icons | [Lucide React](https://lucide.dev/) |

### Backend

| Layer | Technology |
|---|---|
| Framework | [FastAPI](https://fastapi.tiangolo.com/) |
| ORM | SQLAlchemy models (`app/models`) |
| Validation | Pydantic schemas (`app/schemas`) |
| Auth | JWT-based security (`app/core/security.py`) |
| Config | Environment-driven settings (`app/core/config.py`) |
| Containerization | Docker (see `backend/Dockerfile`) |

---

## Project Structure

```
coffee-app/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── security.py
│   │   ├── models/
│   │   │   └── models.py
│   │   ├── schemas/
│   │   │   └── schemas.py
│   │   ├── api/
│   │   │   ├── deps.py
│   │   │   ├── auth.py
│   │   │   ├── outlets.py
│   │   │   ├── menu.py
│   │   │   ├── orders.py
│   │   │   └── staff.py
│   │   ├── database.py
│   │   ├── seed.py
│   │   └── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts
│   │   ├── context/
│   │   │   └── AuthContext.tsx
│   │   ├── store/
│   │   │   └── useCartStore.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── utils/
│   │   │   └── formatters.ts
│   │   ├── components/
│   │   │   ├── Navbar.tsx
│   │   │   ├── CustomizerModal.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── pages/
│   │   │   ├── OutletSelectPage.tsx
│   │   │   ├── MenuPage.tsx
│   │   │   ├── CheckoutPage.tsx
│   │   │   ├── OrderTrackingPage.tsx
│   │   │   ├── StaffDashboardPage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   └── RegisterPage.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tailwind.config.js
│   └── Dockerfile
├── API_CONTRACT.md
├── docker-compose.yml
└── render.yaml
```

---

## Getting Started

### 1. Prerequisites

- **Node.js** v18.0.0 or later
- **npm** v9.0.0 or later
- **Python** 3.10+ (for the backend)
- **Docker & Docker Compose** (optional, for containerized setup)

### 2. Backend Setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables (database URL, JWT secret, etc.)
cp .env.example .env   # create/edit as needed

# (Optional) seed the database with demo data
python -m app.seed

# Run the API
uvicorn app.main:app --reload --port 8000
```

The API will be available at **`http://127.0.0.1:8000`**, with interactive docs at `http://127.0.0.1:8000/docs`.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure the backend URL
cp .env.example .env
```

`.env` contents:

```
VITE_API_BASE_URL=http://localhost:8000/api
```

```bash
# Start the dev server
npm run dev
```

The app will be available at **`http://localhost:5173`**.

**Production build & verification:**

```bash
npm run build      # type-check + build
npm run preview    # preview the production bundle locally
```

### 4. Running with Docker

From the repository root:

```bash
docker-compose up --build
```

This builds and starts both services:

| Service | Port |
|---|---|
| `backend` | `8000` |
| `frontend` | `80` |

The backend reads its configuration from `backend/.env`, and the frontend depends on the backend container being up first.

---

## Test Credentials

| Persona | Email | Password | Role | Access |
|---|---|---|---|---|
| **Customer** | `alex@coffee.com` | `alex123` | `customer` | Full ordering, cart, tracking, loyalty ledger |
| **Staff / Barista** | `staff@coffee.com` | `staff123` | `staff` | Kitchen orders board (`/staff`, `/admin`), catalog management |

Quick-autofill buttons for both personas are available on the `/login` screen.

---

## Validation Coverage

| Form / Flow | Field | Validation Rules | Error Behavior |
|---|---|---|---|
| **Registration** | `full_name` | Required, 2–100 characters | Inline field error |
| | `email` | Required, valid RFC 5322 format | Inline field error |
| | `phone_number` | Required, 10–15 digits | Inline field error |
| | `password` | Required, 6–128 characters | Inline field error |
| **Login** | `email` / `password` | Required, non-empty, min 6 chars | Inline validation + HTTP 401 banner |
| **Cart & Checkout** | `outlet_id` | Must be selected in state | Blocks checkout, prompts outlet selection |
| | `pickup_type` | `'immediate'` or `'scheduled'` | Validated pre-submission |
| | `scheduled_pickup_time` | Must be future, within outlet hours, accounts for `avg_prep_minutes` | Inline warning, blocks modal |
| | `points_to_redeem` | ≥ 50 points; ≤ balance; ≤ payable total | Live warning, auto-capped |
| | `items` | ≥ 1 item; `quantity` ≥ 1 | Blocks checkout on empty cart |
| **Staff Dashboard** | Rejection Reason | Free-text, captured in modal | Sent via `PATCH /staff/orders/{id}/decision` |
| | Product Creation | Name required, base price > 0, valid category enum, modifiers validated | Submit disabled until valid |

---

## Backend Assumptions & Resilient Handling

While building strictly against `API_CONTRACT.md` and the live backend, a few real-world behaviors were discovered and handled **entirely on the frontend**, without touching backend code:

1. **Order Details Serialization Gotcha** (`GET /api/orders/{order_id}`)
   `get_order_details` in `backend/app/api/orders.py` omits a return statement in one code path, causing an HTTP `500`. `OrderTrackingPage.tsx` works around this with an automatic fallback: it calls `GET /orders` and filters client-side by `order.id`, keeping tracking 100% reliable.

2. **Loyalty Redemption Rules**
   The backend enforces a minimum redemption of **50 points** (1 point = ₹1.00), capped at the payable total. The frontend mirrors this with live client-side validation to prevent invalid payloads.

3. **Staff Role Gating**
   The backend's `get_current_staff` dependency only permits `role in ['staff', 'admin']` (HTTP `403` otherwise). The frontend's `ProtectedRoute` enforces the same `allowedRoles` set, without inventing any extra role hierarchy.

4. **Dynamic Pickup Slot Generation**
   Valid future pickup slots are computed client-side in 15-minute increments from an outlet's `opening_time`, `closing_time`, and `avg_prep_minutes`, preventing out-of-hours orders.

5. **Simulated Payment Gateway**
   The backend confirms payment via order creation/status updates. The frontend wraps this in a realistic simulated checkout flow (including failure testing) that submits directly to the real order and payment endpoints.

---

## Deployment

- **`render.yaml`** — a Render.com blueprint for deploying the backend (and optionally the frontend) as managed services.
- **`docker-compose.yml`** — spins up both services locally for integration testing.
- **Live demo** is hosted on Vercel: [kaffee-coffee-shop-indol.vercel.app](https://kaffee-coffee-shop-indol.vercel.app).

---

## Contributing

1. Fork the repository and create a feature branch.
2. Keep frontend changes contract-compliant with `API_CONTRACT.md` — avoid backend modifications where a frontend-side fallback is possible.
3. Run `npm run build` (frontend) and ensure the backend starts cleanly before opening a PR.
4. Open a pull request with a clear description of the change and any new environment variables required.

---

## License

No license file is currently present in this repository. Add a `LICENSE` file to clarify usage terms if you intend to open-source this project.
