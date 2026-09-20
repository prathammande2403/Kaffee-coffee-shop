# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Monorepo for a coffee-ordering app ("Artisan Coffee" backend / "Kaffa Coffee Roasters" frontend): a FastAPI + async SQLAlchemy backend (`backend/`) and a React 18 + TypeScript + Vite frontend (`frontend/`). There are no automated tests and no linter configured in either half.

[API_CONTRACT.md](API_CONTRACT.md) is the reference for endpoints, schemas, the order state machine, pricing/loyalty rules, and seed data. Read it before changing anything that crosses the backend/frontend boundary. Section 8 lists places where earlier frontend assumptions diverged from the backend (register returns no JWT, login returns no `user`, no `city` on outlets, `modifier_group` vs `group`, `REJECTED` status).

## Commands

Backend (run from `backend/`; Python 3.11, a `venv/` exists at repo root and is gitignored):
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000     # Swagger at /docs, health at /health
python -m app.seed                            # seed outlets/users/menu (no-op if DB already has data)
```

Frontend (run from `frontend/`):
```bash
npm install
npm run dev        # Vite on :3000 (proxies /api -> http://127.0.0.1:8000)
npm run build      # `tsc && vite build` — the type check is the only static check available
```

Full stack via Docker: `docker-compose up --build` (backend :8000 from `backend/.env`, frontend on nginx :80).

## Configuration

- Backend reads `backend/.env` (gitignored): `DATABASE_URL`, `SECRET_KEY`, `ENVIRONMENT`, `BACKEND_CORS_ORIGINS`, etc. — see [config.py](backend/app/core/config.py). A PostgreSQL database is required; there is no SQLite fallback (the engine in [database.py](backend/app/database.py) forces `ssl: require`, so a local Postgres without SSL will fail to connect).
- `DATABASE_URL` is rewritten by a validator in `config.py`: `postgres://`/`postgresql://` become `postgresql+asyncpg://`, and one specific Supabase direct host is rewritten to its pooler (IPv6-only issue on Render). Don't "clean up" that hardcoded host without checking the deployment.
- Frontend: `VITE_API_BASE_URL` (see `frontend/.env.example`). [client.ts](frontend/src/api/client.ts) normalizes it — defaults to `/api`, and appends `/api` if a full URL lacks it.
- Deployment: backend on Render ([render.yaml](render.yaml), health check `/health`), frontend on Vercel (`vercel.json` SPA rewrite).

## Backend architecture

- `app/main.py` — the lifespan hook runs `Base.metadata.create_all` on startup. **There is no Alembic/migrations**: adding a column to an existing table in `models/models.py` will not alter a deployed database.
- Every router is mounted twice — under `settings.API_V1_STR` (`/api`) and at the root — and list/create routes are declared for both `""` and `"/"` to avoid redirects. Preserve this when adding routes.
- CORS is configured inline in `main.py` (hardcoded origins plus a `*.vercel.app` regex). `settings.BACKEND_CORS_ORIGINS` exists but is **not** what `main.py` uses.
- Layering: `api/*.py` (routers, contain the business logic directly — no service layer) → `schemas/schemas.py` (Pydantic v2) → `models/models.py` (SQLAlchemy 2.0 models). DB access is always async via the `get_db` dependency.
- Auth: JWT bearer (`core/security.py`), `deps.get_current_user` / `deps.get_current_staff` (role in `staff`/`admin`). Roles are plain strings: `customer`, `staff`, `admin`.
- Business rules live in `api/orders.py` and `api/staff.py`: pricing (unit price = base + modifier deltas, 5% GST, loyalty discount), loyalty earn on `COMPLETED` and refunds on cancel/reject, and the order status FSM. Loyalty constants come from `settings`.
- Known bug: `get_order_details` in [orders.py](backend/app/api/orders.py) has no `return` statement, so `GET /orders/{id}` returns 500. The frontend works around it by falling back to `GET /orders` and filtering (`OrderTrackingPage.tsx`). Fixing the backend means the fallback becomes redundant, not wrong.

## Frontend architecture

- Routing in `App.tsx`: public (`/`, `/menu`, `/login`, `/register`), customer-protected (`/cart`, `/checkout` [both render CheckoutPage], `/orders`, `/orders/:orderId`, `/loyalty`, `/profile`), staff-protected (`/staff` and `/admin` both render StaffDashboardPage via `ProtectedRoute allowedRoles`).
- State split: server state via TanStack Query (`main.tsx`; order pages and the staff board poll every ~3s with `refetchInterval`); client state via Zustand [useCartStore.ts](frontend/src/store/useCartStore.ts) (persisted to localStorage as `coffee-shop-cart`) holding the selected outlet plus cart; auth via [AuthContext.tsx](frontend/src/context/AuthContext.tsx) (JWT in localStorage `access_token`).
- Auth flow: login returns only a token, so `AuthContext` immediately calls `/auth/me`; register calls `/auth/register` then auto-logs in. The axios interceptor in `client.ts` attaches the bearer token and, on any 401, clears the token and hard-redirects to `/login`.
- Cart invariants: changing outlet empties the cart; `cart_item_id` is `productId-sortedModifierIds`, so identical configurations merge. Cart tax/total math (`getTax`, `getTotal`) mirrors the backend's 2-decimal 5% GST — keep the two in sync if pricing rules change.
- Payment is simulated: the backend marks orders `PAID` immediately on `POST /orders`; `PaymentModal` is a client-side mock that then submits the real order.
- Pickup slots are generated client-side from the outlet's `opening_time`, `closing_time`, and `avg_prep_minutes` (no backend slot endpoint).
- Shared types are in `src/types/index.ts`; keep them aligned with the backend schemas (modifiers use `modifier_group` on read but `group` on order creation).
- Seeded test logins: `alex@coffee.com` / `alex123` (customer, 120 loyalty points), `staff@coffee.com` / `staff123` (staff).
