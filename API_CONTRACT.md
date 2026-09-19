# Artisan Coffee App — Backend API Contract & Specification

> **Notice**: This document serves as the single source of truth for the frontend application consuming the Artisan Coffee backend. All details reflect the existing, immutable backend code in `backend/`.

---

## Table of Contents
1. [Backend Overview & Runtime](#1-backend-overview--runtime)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Data Models & Schemas](#3-data-models--schemas)
4. [Enums, States & Constants](#4-enums-states--constants)
5. [Business Logic & Calculation Rules](#5-business-logic--calculation-rules)
6. [Complete REST API Endpoints Specification](#6-complete-rest-api-endpoints-specification)
   - [System & Health](#system--health)
   - [Authentication & User Profile (`/api/auth`)](#authentication--user-profile-apiauth)
   - [Outlets (`/api/outlets`)](#outlets-apioutlets)
   - [Menu & Products (`/api/menu`)](#menu--products-apimenu)
   - [Orders & Checkout (`/api/orders`)](#orders--checkout-apiorders)
   - [Staff Operations (`/api/staff`)](#staff-operations-apistaff)
   - [Customer Favorites (`/api/favorites`)](#customer-favorites-apifavorites)
7. [Database Seed Data & Fixtures](#7-database-seed-data--fixtures)
8. [Critical Frontend Discrepancies & Clarifications](#8-critical-frontend-discrepancies--clarifications)

---

## 1. Backend Overview & Runtime

- **Language & Runtime**: Python 3.11+
- **Web Framework**: [FastAPI](https://fastapi.tiangolo.com) (`v0.110.0`) with [Pydantic v2](https://docs.pydantic.dev) (`v2.6.4`) & `pydantic-settings` (`v2.2.1`)
- **Database & ORM**: PostgreSQL via [asyncpg](https://github.com/MagicStack/asyncpg) (`v0.29.0`) and [SQLAlchemy 2.0](https://www.sqlalchemy.org) (`v2.0.28`) async engine with connection pooling (`pool_size=10`, `max_overflow=20`)
- **API Documentation**:
  - Interactive Swagger UI: `http://localhost:8000/docs`
  - ReDoc: `http://localhost:8000/redoc`
  - OpenAPI JSON: `http://localhost:8000/openapi.json`
- **Starting the Server**:
  ```bash
  # Local Development (from backend/ folder)
  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  # Or using docker-compose / Dockerfile
  docker build -t coffee-backend ./backend
  docker run -p 8000:8000 coffee-backend
  ```
- **CORS Configuration**:
  - Whitelisted Origins: `http://localhost:3000`, `http://localhost:5173`, `http://127.0.0.1:3000`, `http://127.0.0.1:5173`
  - Credentials: `True`
  - Allowed Methods: `*`
  - Allowed Headers: `*`
- **Base URL Prefix**:
  - Root: `http://localhost:8000`
  - API v1 Router Prefix: `/api` (configured via `settings.API_V1_STR = "/api"`)
  - Health check endpoint: `/health` (unprefixed)

---

## 2. Authentication & Authorization

### Overview
Authentication is implemented via **stateless JSON Web Tokens (JWT)** signed using the `HS256` symmetric algorithm and verified with `SECRET_KEY`.

### Token Details
- **Signing Algorithm**: `HS256`
- **Default Lifespan**: 7 days (`10080` minutes, configured in `.env`)
- **JWT Claims Payload**:
  ```json
  {
    "sub": "3fa85f64-5717-4562-b3fc-2c963f66afa6",  // User UUID (as string)
    "role": "customer",                             // "customer" | "staff" | "admin"
    "email": "alex@coffee.com",
    "name": "Alex Turner",
    "iat": 1726660000,                              // Issued at timestamp
    "exp": 1727264800                               // Expiration timestamp
  }
  ```

### Protected Routes Authorization Header
All endpoints requiring authentication expect the standard HTTP `Authorization` header:
```http
Authorization: Bearer <jwt_access_token>
```
If missing, invalid, or expired, the backend returns:
```json
{
  "detail": "Could not validate credentials"
}
```
HTTP Status: `401 Unauthorized`, Header: `WWW-Authenticate: Bearer`.

### Role-Based Access Control (RBAC)
- **Customer Endpoints**: Require a valid token belonging to an active user (`get_current_user`).
- **Staff / Admin Endpoints** (`/api/staff/*`): Require `role` to be either `"staff"` or `"admin"` (`get_current_staff`). If a customer token is provided, returns:
  ```json
  {
    "detail": "The user does not have enough privileges"
  }
  ```
  HTTP Status: `403 Forbidden`.

### Authentication Flow Diagram
```
  [ Frontend Client ]                               [ Backend API ]
          │                                                │
          │── 1. POST /api/auth/register (name,email,phone,pw) ──▶│ (Creates User in DB)
          │◀─ 2. Returns UserOut (HTTP 201 Created) ──────────────│ (Does NOT return token)
          │                                                │
          │── 3. POST /api/auth/login (email, password) ─────────▶│ (Verifies bcrypt hash)
          │◀─ 4. Returns Token {access_token, token_type, role, user_id} ─│
          │                                                │
          │ (Store access_token in localStorage)           │
          │                                                │
          │── 5. GET /api/auth/me [Bearer <token>] ──────────────▶│ (Validates JWT sub)
          │◀─ 6. Returns UserOut profile data ────────────────────│
          │                                                │
          │── 7. Subsequent Protected API Calls ──────────────────▶│
          │      Header: Authorization: Bearer <token>     │
```

---

## 3. Data Models & Schemas

### 3.1 `User` (Table: `users`)
| Field | DB Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | No | Primary Key (`uuid4`) |
| `full_name` | VARCHAR(100) | No | User's display name |
| `phone` | VARCHAR(20) | No | Unique, indexed phone number |
| `email` | VARCHAR(120) | No | Unique, indexed email address |
| `hashed_password` | TEXT | No | Bcrypt password hash |
| `role` | VARCHAR(20) | No | `'customer'`, `'staff'`, or `'admin'` (default: `'customer'`) |
| `loyalty_balance` | INTEGER | No | Check constraint: `loyalty_balance >= 0` (default: `0`) |
| `created_at` | TIMESTAMPTZ | No | Timestamp of creation (`UTC`) |

### 3.2 `Outlet` (Table: `outlets`)
| Field | DB Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | No | Primary Key (`uuid4`) |
| `name` | VARCHAR(100) | No | Store location name (e.g., "Downtown Roastery") |
| `address` | TEXT | No | Full street address |
| `is_active` | BOOLEAN | No | Operational switch (default: `True`) |
| `opening_time` | TIME | No | Opening hour (e.g., `07:00:00`) |
| `closing_time` | TIME | No | Closing hour (e.g., `22:00:00`) |
| `avg_prep_minutes` | INTEGER | No | Estimated kitchen preparation time (default: `15`) |

### 3.3 `Product` (Table: `products`)
| Field | DB Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | No | Primary Key (`uuid4`) |
| `category` | VARCHAR(50) | No | Category key (e.g., `'hot_coffee'`, `'cold_coffee'`, `'matcha'`, `'food'`, `'add_ons'`) |
| `name` | VARCHAR(100) | No | Display name of beverage or food item |
| `description` | TEXT | Yes | Product description / tasting notes |
| `base_price` | NUMERIC(10, 2) | No | Base price in INR (₹) before modifiers |
| `image_url` | TEXT | Yes | High-resolution image CDN URL |
| `is_available` | BOOLEAN | No | Global availability flag (default: `True`) |

### 3.4 `ProductModifier` (Table: `product_modifiers`)
| Field | DB Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | No | Primary Key (`uuid4`) |
| `product_id` | UUID | No | Foreign Key to `products.id` (ON DELETE CASCADE) |
| `modifier_group` | VARCHAR(50) | No | Group: `'size'`, `'milk'`, `'sugar'`, `'add_ons'` |
| `option_name` | VARCHAR(50) | No | Name: e.g. `'Regular (250ml)'`, `'Oat Milk'`, `'Extra Shot'` |
| `price_delta` | NUMERIC(10, 2) | No | Additional price in INR (₹) (e.g., `45.00`, default `0.00`) |

### 3.5 `OutletProductAvailability` (Table: `outlet_product_availability`)
| Field | DB Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | No | Primary Key (`uuid4`) |
| `outlet_id` | UUID | No | Foreign Key to `outlets.id` (ON DELETE CASCADE), Indexed |
| `product_id` | UUID | No | Foreign Key to `products.id` (ON DELETE CASCADE), Indexed |
| `is_available` | BOOLEAN | No | Specific stock override for this product at this outlet |
*Constraint: Unique constraint on `(outlet_id, product_id)` (`uq_outlet_product`).*

### 3.6 `Order` (Table: `orders`)
| Field | DB Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | No | Primary Key (`uuid4`) |
| `user_id` | UUID | No | Foreign Key to `users.id` |
| `outlet_id` | UUID | No | Foreign Key to `outlets.id` |
| `status` | VARCHAR(30) | No | State Machine status (indexed, default: `'ORDER_RECEIVED'`) |
| `pickup_type` | VARCHAR(20) | No | `'immediate'` or `'scheduled'` (default: `'immediate'`) |
| `scheduled_pickup_time`| TIMESTAMPTZ | Yes | Scheduled ISO datetime if `pickup_type == 'scheduled'` |
| `subtotal` | NUMERIC(10, 2) | No | Sum of `(unit_price * quantity)` for all items |
| `tax` | NUMERIC(10, 2) | No | 5% GST (`subtotal * 0.05` quantized to 2 decimals) |
| `discount_amount` | NUMERIC(10, 2) | No | Loyalty discount applied (`₹1` per point redeemed) |
| `points_redeemed` | INTEGER | No | Number of points redeemed on this order (default: `0`) |
| `final_payable` | NUMERIC(10, 2) | No | `max(0.00, subtotal + tax - discount_amount)` |
| `payment_status` | VARCHAR(20) | No | `'PAID'` (default on checkout) or `'REFUNDED'` |
| `created_at` | TIMESTAMPTZ | No | Timestamp of placement (`UTC`) |

### 3.7 `OrderItem` (Table: `order_items`)
| Field | DB Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | No | Primary Key (`uuid4`) |
| `order_id` | UUID | No | Foreign Key to `orders.id` (ON DELETE CASCADE) |
| `product_id` | UUID | No | Foreign Key to `products.id` |
| `product_name` | VARCHAR(100) | No | Snapshot of product name at order time |
| `quantity` | INTEGER | No | Quantity ordered (>= 1, default: `1`) |
| `selected_modifiers` | JSONB | No | Array snapshot of selected options with `modifier_id`, `group`, `option_name`, `price_delta` |
| `unit_price` | NUMERIC(10, 2) | No | `base_price + sum(modifiers.price_delta)` |
| `total_price` | NUMERIC(10, 2) | No | `unit_price * quantity` |

### 3.8 `LoyaltyTransaction` (Table: `loyalty_transactions`)
| Field | DB Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | No | Primary Key (`uuid4`) |
| `user_id` | UUID | No | Foreign Key to `users.id` |
| `order_id` | UUID | Yes | Foreign Key to `orders.id` (ON DELETE SET NULL) |
| `points_change` | INTEGER | No | Positive (+) for earnings, negative (-) for redemptions |
| `reason` | VARCHAR(50) | No | `'CHECKOUT_REDEEM'`, `'ORDER_EARN'`, `'CANCELLED_REFUND'`, `'ORDER_REJECTED_REFUND'`, `'REVERSAL'` |
| `created_at` | TIMESTAMPTZ | No | Timestamp of transaction (`UTC`) |

### 3.9 `UserFavorite` (Table: `user_favorites`)
| Field | DB Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | No | Primary Key (`uuid4`) |
| `user_id` | UUID | No | Foreign Key to `users.id` (ON DELETE CASCADE) |
| `product_id` | UUID | No | Foreign Key to `products.id` (ON DELETE CASCADE) |
| `label` | VARCHAR(100) | Yes | Custom name (e.g., "My Morning Brew") |
| `selected_modifiers` | JSONB | No | Saved choices: `[{"modifier_id": "...", "group": "...", "option_name": "...", "price_delta": ...}]` |
| `created_at` | TIMESTAMPTZ | No | Timestamp of creation (`UTC`) |

---

## 4. Enums, States & Constants

### 4.1 User Roles
- `'customer'`
- `'staff'`
- `'admin'`

### 4.2 Order Status & State Machine
The backend enforces a Finite State Machine (FSM) during staff updates (`PATCH /api/staff/orders/{order_id}/status`):

| Current State | Permitted Next States | Triggered By |
|---|---|---|
| `ORDER_RECEIVED` | `PREPARING`, `CANCELLED`, (`REJECTED` via decision endpoint) | Customer checkout (initial) |
| `PREPARING` | `READY_FOR_PICKUP`, `CANCELLED` | Staff accepted or updated |
| `READY_FOR_PICKUP` | `COMPLETED` | Staff updated |
| `COMPLETED` | *(Terminal)* | Staff completed order (triggers point earn) |
| `CANCELLED` | *(Terminal)* | Customer or staff cancelled (triggers refund) |
| `REJECTED` | *(Terminal)* | Staff rejected via `/decision` (triggers refund) |

```
               ┌──────────────────┐
               │  ORDER_RECEIVED  │
               └─────────┬────────┘
             ┌───────────┼───────────────┐
             │ (Staff    │ (Staff        │ (Customer Cancel /
             │  Accept)  │  Reject)      │  Staff Cancel)
             ▼           ▼               ▼
     ┌───────────┐  ┌──────────┐   ┌───────────┐
     │ PREPARING │  │ REJECTED │   │ CANCELLED │
     └─────┬─────┘  └──────────┘   └───────────┘
           │ (Staff Ready)
           ▼
 ┌───────────────────┐
 │ READY_FOR_PICKUP  │
 └─────────┬─────────┘
           │ (Staff Complete)
           ▼
     ┌───────────┐
     │ COMPLETED │
     └───────────┘
```

### 4.3 Payment Statuses
- `'PAID'`: Default upon placing order (mocked instant checkout).
- `'REFUNDED'`: Set automatically when order is `CANCELLED` or `REJECTED`.

### 4.4 Pickup Types
- `'immediate'`: Standard order prepared immediately according to outlet `avg_prep_minutes`.
- `'scheduled'`: Customer specifies a future pickup timestamp (`scheduled_pickup_time`).

### 4.5 Modifier Groups
- `'size'`
- `'milk'`
- `'sugar'`
- `'add_ons'`

### 4.6 Loyalty Reasons
- `'CHECKOUT_REDEEM'`: Negative points redeemed during checkout.
- `'ORDER_EARN'`: Positive points awarded when an order is marked `COMPLETED`.
- `'CANCELLED_REFUND'`: Refund of redeemed points when a customer cancels an `ORDER_RECEIVED` order.
- `'ORDER_REJECTED_REFUND'`: Refund of redeemed points when staff rejects an order.
- `'REVERSAL'`: Refund of redeemed points when staff moves an order directly to `CANCELLED`.

---

## 5. Business Logic & Calculation Rules

### 5.1 Item & Order Pricing
1. **Item Unit Price**:
   $$\text{unit\_price} = \text{base\_price} + \sum (\text{modifier.price\_delta})$$
2. **Item Total**:
   $$\text{total\_price} = \text{unit\_price} \times \text{quantity}$$
3. **Order Subtotal**:
   $$\text{subtotal} = \sum \text{total\_price}$$
4. **GST Tax (5%)**:
   $$\text{tax} = \text{round}(\text{subtotal} \times 0.05, 2)$$
5. **Discount (Loyalty Redemption)**:
   $$\text{discount\_amount} = \text{points\_redeemed} \times 1.00$$
6. **Final Payable Amount**:
   $$\text{final\_payable} = \max(0.00, \text{subtotal} + \text{tax} - \text{discount\_amount})$$

### 5.2 Loyalty Rules
- **Earn Rate**: 1 Loyalty Point for every ₹10 spent on `final_payable`:
  $$\text{points\_earned} = \lfloor \frac{\text{final\_payable}}{10} \rfloor$$
  *Points are awarded strictly when the order status reaches `COMPLETED`.*
- **Redemption Value**: 1 Loyalty Point = ₹1.00 discount (`LOYALTY_POINT_RUPEE_VALUE = 1.0`).
- **Minimum Redemption Threshold**: `50 points` (`LOYALTY_MIN_REDEMPTION_POINTS = 50`). If a user inputs `points_to_redeem` between 1 and 49, the request will fail with HTTP 400.
- **Maximum Redemption**: Cannot exceed current user's `loyalty_balance` or reduce `final_payable` below ₹0.00.

### 5.3 Product Availability Resolution
When fetching products via `GET /api/menu?outlet_id=<uuid>`:
- The product's global `Product.is_available` is evaluated.
- If an `outlet_id` is supplied, the backend joins `OutletProductAvailability` and dynamically overrides `ProductOut.is_available` if a specific record exists for that outlet.
- During order creation (`POST /api/orders`), the backend rejects the entire order with HTTP 400 if any selected product is globally unavailable or out-of-stock at that outlet.

---

## 6. Complete REST API Endpoints Specification

### System & Health

#### `GET /health`
Check system status and environment.
- **Auth**: None (Public)
- **Response**: `200 OK`
```json
{
  "status": "healthy",
  "service": "Artisan Coffee API",
  "environment": "development"
}
```

---

### Authentication & User Profile (`/api/auth`)

#### `POST /api/auth/register`
Create a new customer account.
- **Auth**: None (Public)
- **Status**: `201 Created`
- **Request Body**: `UserRegister`
```json
{
  "full_name": "Alex Turner",
  "email": "alex@coffee.com",
  "phone": "9123456780",
  "password": "mypassword123"
}
```
- **Validation**:
  - `full_name`: 2 - 100 chars
  - `email`: valid email format
  - `phone`: 10 - 15 chars
  - `password`: 6 - 128 chars
- **Success Response**: `UserOut`
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "full_name": "Alex Turner",
  "email": "alex@coffee.com",
  "phone": "9123456780",
  "role": "customer",
  "loyalty_balance": 0,
  "created_at": "2026-09-18T10:00:00.000Z"
}
```
- **Error Responses**:
  - `400 Bad Request`: `{"detail": "A user with this email or phone number already exists"}`
  - `422 Unprocessable Entity`: Validation failure (e.g. short password, invalid email)

#### `POST /api/auth/login`
Authenticate with email and password to receive a JWT access token.
- **Auth**: None (Public)
- **Status**: `200 OK`
- **Request Body**: `UserLogin`
```json
{
  "email": "alex@coffee.com",
  "password": "mypassword123"
}
```
- **Success Response**: `Token`
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "role": "customer",
  "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```
- **Error Responses**:
  - `401 Unauthorized`: `{"detail": "Invalid email or password"}`

#### `GET /api/auth/me`
Retrieve profile of currently authenticated user.
- **Auth**: Bearer Token (`Authorization: Bearer <token>`)
- **Status**: `200 OK`
- **Success Response**: `UserOut`
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "full_name": "Alex Turner",
  "email": "alex@coffee.com",
  "phone": "9123456780",
  "role": "customer",
  "loyalty_balance": 120,
  "created_at": "2026-09-18T10:00:00.000Z"
}
```
- **Error Responses**:
  - `401 Unauthorized`: Invalid, expired, or missing Bearer token.

#### `GET /api/auth/loyalty-history`
Fetch audit ledger of all loyalty points earned and redeemed by the authenticated user.
- **Auth**: Bearer Token
- **Status**: `200 OK`
- **Success Response**: `List[LoyaltyTransactionOut]`
```json
[
  {
    "id": "e4f8b2d1-0f4b-46cb-a316-09511116c4f8",
    "order_id": "7817b189-bc84-4860-93cb-3ea662ad7889",
    "points_change": -50,
    "reason": "CHECKOUT_REDEEM",
    "created_at": "2026-09-18T11:30:00.000Z"
  },
  {
    "id": "a1b2c3d4-0f4b-46cb-a316-09511116c4f8",
    "order_id": "3215b189-bc84-4860-93cb-3ea662ad7889",
    "points_change": 25,
    "reason": "ORDER_EARN",
    "created_at": "2026-09-17T15:20:00.000Z"
  }
]
```

---

### Outlets (`/api/outlets`)

#### `GET /api/outlets` (and `/api/outlets/`)
Retrieve all available coffee shop outlets.
- **Auth**: None (Public)
- **Status**: `200 OK`
- **Success Response**: `List[OutletOut]`
```json
[
  {
    "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "name": "Downtown Roastery",
    "address": "102 MG Road, Heritage District",
    "is_active": true,
    "opening_time": "07:00:00",
    "closing_time": "23:00:00",
    "avg_prep_minutes": 12
  },
  {
    "id": "1c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e",
    "name": "Cyber City Hub",
    "address": "Ground Floor, Tower B, Tech Park",
    "is_active": true,
    "opening_time": "08:00:00",
    "closing_time": "21:30:00",
    "avg_prep_minutes": 10
  }
]
```

#### `GET /api/outlets/{outlet_id}`
Retrieve a single outlet by ID.
- **Auth**: None (Public)
- **Status**: `200 OK`
- **Success Response**: `OutletOut`
```json
{
  "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "name": "Downtown Roastery",
  "address": "102 MG Road, Heritage District",
  "is_active": true,
  "opening_time": "07:00:00",
  "closing_time": "23:00:00",
  "avg_prep_minutes": 12
}
```
- **Error Responses**:
  - `404 Not Found`: `{"detail": "Outlet not found"}`

---

### Menu & Products (`/api/menu`)

#### `GET /api/menu`
List all menu products with their modifier configurations.
- **Auth**: None (Public)
- **Query Parameters**:
  - `outlet_id` (optional, UUID): If provided, `is_available` reflects outlet-specific stock status.
  - `category` (optional, string): If provided and not `"all"`, filters by category (`"hot_coffee"`, `"cold_coffee"`, `"matcha"`, `"food"`).
- **Status**: `200 OK`
- **Success Response**: `List[ProductOut]`
```json
[
  {
    "id": "7a35e82e-68bc-4526-9f84-5f7561858ce1",
    "category": "hot_coffee",
    "name": "Cortado",
    "description": "Equal parts double espresso and silky textured milk",
    "base_price": "210.00",
    "image_url": "https://images.unsplash.com/photo-1534778101976-62847782c213?w=500",
    "is_available": true,
    "modifiers": [
      {
        "id": "2d1f7c3e-8c44-4861-a0a4-37463f25608d",
        "modifier_group": "size",
        "option_name": "Regular (250ml)",
        "price_delta": "0.00"
      },
      {
        "id": "8d1f7c3e-8c44-4861-a0a4-37463f25608e",
        "modifier_group": "size",
        "option_name": "Large (350ml)",
        "price_delta": "50.00"
      },
      {
        "id": "4b2f7c3e-8c44-4861-a0a4-37463f25608f",
        "modifier_group": "milk",
        "option_name": "Oat Milk",
        "price_delta": "45.00"
      },
      {
        "id": "5c3f7c3e-8c44-4861-a0a4-37463f256090",
        "modifier_group": "sugar",
        "option_name": "Unsweetened (0%)",
        "price_delta": "0.00"
      },
      {
        "id": "6d4f7c3e-8c44-4861-a0a4-37463f256091",
        "modifier_group": "add_ons",
        "option_name": "Extra Espresso Shot",
        "price_delta": "55.00"
      }
    ]
  }
]
```

#### `GET /api/menu/{product_id}`
Retrieve a single product by UUID with modifiers.
- **Auth**: None (Public)
- **Status**: `200 OK`
- **Success Response**: `ProductOut`
- **Error Responses**:
  - `404 Not Found`: `{"detail": "Product not found"}`

---

### Orders & Checkout (`/api/orders`)

#### `POST /api/orders` (and `/api/orders/`)
Place a new pickup order.
- **Auth**: Bearer Token (`get_current_user`)
- **Status**: `201 Created`
- **Request Body**: `OrderCreate`
```json
{
  "outlet_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "pickup_type": "scheduled",
  "scheduled_pickup_time": "2026-09-18T18:30:00.000Z",
  "points_to_redeem": 50,
  "items": [
    {
      "product_id": "7a35e82e-68bc-4526-9f84-5f7561858ce1",
      "quantity": 2,
      "modifiers": [
        {
          "modifier_id": "8d1f7c3e-8c44-4861-a0a4-37463f25608e",
          "group": "size",
          "option_name": "Large (350ml)",
          "price_delta": 50.0
        },
        {
          "modifier_id": "4b2f7c3e-8c44-4861-a0a4-37463f25608f",
          "group": "milk",
          "option_name": "Oat Milk",
          "price_delta": 45.0
        }
      ]
    }
  ]
}
```
- **Validation Rules**:
  - `outlet_id` must exist and `is_active` must be `true` (otherwise 404 or 400).
  - `items` array must have at least 1 item (`min_length=1`).
  - `quantity` must be between 1 and 50.
  - If `points_to_redeem > 0`:
    - Must be `>= 50` (`LOYALTY_MIN_REDEMPTION_POINTS`).
    - Must not exceed user's current `loyalty_balance`.
  - If `scheduled_pickup_time` provided: must be a future datetime.
  - Each item must be currently available globally and at the selected outlet.
- **Success Response**: `OrderOut`
```json
{
  "id": "7817b189-bc84-4860-93cb-3ea662ad7889",
  "outlet_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "status": "ORDER_RECEIVED",
  "pickup_type": "scheduled",
  "scheduled_pickup_time": "2026-09-18T18:30:00.000Z",
  "subtotal": "610.00",
  "tax": "30.50",
  "discount_amount": "50.00",
  "points_redeemed": 50,
  "final_payable": "590.50",
  "payment_status": "PAID",
  "created_at": "2026-09-18T17:45:00.000Z",
  "items": [
    {
      "id": "1111b189-bc84-4860-93cb-3ea662ad7889",
      "product_id": "7a35e82e-68bc-4526-9f84-5f7561858ce1",
      "product_name": "Cortado",
      "quantity": 2,
      "unit_price": "305.00",
      "total_price": "610.00",
      "selected_modifiers": [
        {
          "modifier_id": "8d1f7c3e-8c44-4861-a0a4-37463f25608e",
          "group": "size",
          "option_name": "Large (350ml)",
          "price_delta": 50.0
        },
        {
          "modifier_id": "4b2f7c3e-8c44-4861-a0a4-37463f25608f",
          "group": "milk",
          "option_name": "Oat Milk",
          "price_delta": 45.0
        }
      ]
    }
  ]
}
```
- **Error Responses**:
  - `400 Bad Request`:
    - "Specified outlet is temporarily closed"
    - "Order must contain at least one item"
    - "'<Product>' is currently marked unavailable and cannot be ordered"
    - "'<Product>' is out of stock at this selected outlet"
    - "Minimum 50 loyalty points required for redemption"
    - "Insufficient loyalty points. Current balance: X"
  - `404 Not Found`: "Specified outlet does not exist" or "Product with ID ... no longer exists"

#### `GET /api/orders` (and `/api/orders/`)
List all previous and ongoing orders for the logged-in user.
- **Auth**: Bearer Token
- **Status**: `200 OK`
- **Success Response**: `List[OrderOut]` (ordered descending by `created_at`)

#### `GET /api/orders/{order_id}`
Get real-time details & tracking for a single order.
- **Auth**: Bearer Token (`get_current_user`)
- **Status**: `200 OK`
- **Access Control**: User can only view their own orders unless their role is `'staff'` or `'admin'`.
- **Success Response**: `OrderOut`
- **Error Responses**:
  - `404 Not Found`: `{"detail": "Order not found"}`
  - `403 Forbidden`: `{"detail": "Not authorized to access this order"}`

#### `PATCH /api/orders/{order_id}/cancel`
Cancel an order before the kitchen begins preparation.
- **Auth**: Bearer Token (`get_current_user`)
- **Status**: `200 OK`
- **Rules**:
  - Order must belong to the user.
  - `order.status` must be `"ORDER_RECEIVED"` (returns HTTP 400 if already `PREPARING` or beyond).
  - Automatically updates `order.status = "CANCELLED"` and `order.payment_status = "REFUNDED"`.
  - Automatically restores user's loyalty balance if points were redeemed (`reason = "CANCELLED_REFUND"`).
- **Success Response**: `OrderOut`
- **Error Responses**:
  - `400 Bad Request`: `{"detail": "Order cannot be cancelled because it is already 'PREPARING'"}`
  - `404 Not Found`: `{"detail": "Order not found"}`

#### `POST /api/orders/{order_id}/repeat`
Re-order a previous combination by checking live product availability and returning the pre-populated cart items.
- **Auth**: Bearer Token (`get_current_user`)
- **Status**: `200 OK`
- **Success Response**:
```json
{
  "outlet_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "outlet_name": "Downtown Roastery",
  "items": [
    {
      "product_id": "7a35e82e-68bc-4526-9f84-5f7561858ce1",
      "name": "Cortado",
      "unit_price": 305.0,
      "quantity": 2,
      "modifiers": [
        {
          "modifier_id": "8d1f7c3e-8c44-4861-a0a4-37463f25608e",
          "group": "size",
          "option_name": "Large (350ml)",
          "price_delta": 50.0
        }
      ]
    }
  ]
}
```
- **Error Responses**:
  - `400 Bad Request`: `{"detail": "Item '<Product>' is currently unavailable and cannot be reordered"}`
  - `404 Not Found`: `{"detail": "Order not found"}`

---

### Staff Operations (`/api/staff`)
*All endpoints in this router require a Bearer token with `role: "staff"` or `role: "admin"`.*

#### `GET /api/staff/orders`
List all customer orders across the system for kitchen/POS display.
- **Auth**: Bearer Token (`staff` / `admin`)
- **Status**: `200 OK`
- **Success Response**: `List[OrderOut]` (ordered descending by `created_at`)

#### `PATCH /api/staff/orders/{order_id}/decision`
Accept or reject an incoming customer order in `ORDER_RECEIVED` status.
- **Auth**: Bearer Token (`staff` / `admin`)
- **Status**: `200 OK`
- **Request Body**: `StaffOrderDecision`
```json
{
  "action": "ACCEPT", // "ACCEPT" or "REJECT"
  "rejection_reason": "Out of fresh whole milk" // optional
}
```
- **Behavior**:
  - If `action == "ACCEPT"`: updates `order.status = "PREPARING"`.
  - If `action == "REJECT"`: updates `order.status = "REJECTED"`, `order.payment_status = "REFUNDED"`, and refunds customer loyalty points with reason `"ORDER_REJECTED_REFUND"`.
- **Success Response**: `OrderOut`
- **Error Responses**:
  - `400 Bad Request`: If order is not in `ORDER_RECEIVED` status or action is invalid.
  - `404 Not Found`: Order not found.

#### `PATCH /api/staff/orders/{order_id}/status`
Transition an order through the Kitchen FSM.
- **Auth**: Bearer Token (`staff` / `admin`)
- **Status**: `200 OK`
- **Request Body**: `OrderStatusUpdate`
```json
{
  "status": "READY_FOR_PICKUP"
}
```
- **FSM Transitions**:
  - `ORDER_RECEIVED` -> `PREPARING` | `CANCELLED`
  - `PREPARING` -> `READY_FOR_PICKUP` | `CANCELLED`
  - `READY_FOR_PICKUP` -> `COMPLETED`
- **Side Effects**:
  - Transitioning to `COMPLETED`: Awards `floor(final_payable / 10)` points to customer's account (`reason = "ORDER_EARN"`).
  - Transitioning to `CANCELLED`: Reverses points redeemed back to customer (`reason = "REVERSAL"`).
- **Success Response**: `OrderOut`
- **Error Responses**:
  - `400 Bad Request`: `{"detail": "Invalid state transition: 'ORDER_RECEIVED' to 'COMPLETED'"}`

#### `PATCH /api/staff/products/{product_id}/availability`
Toggle product global availability on or off.
- **Auth**: Bearer Token (`staff` / `admin`)
- **Status**: `200 OK`
- **Request Body**: `ProductAvailabilityUpdate`
```json
{
  "is_available": false
}
```
- **Success Response**: `ProductOut`

#### `PATCH /api/staff/products/{product_id}/outlet-availability`
Toggle product stock for a specific outlet.
- **Auth**: Bearer Token (`staff` / `admin`)
- **Status**: `200 OK`
- **Request Body**: `OutletStockToggle`
```json
{
  "outlet_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "is_available": false
}
```
- **Success Response**:
```json
{
  "detail": "Availability updated for outlet 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
}
```

#### `POST /api/staff/products`
Add a new product with customization modifiers to the catalog.
- **Auth**: Bearer Token (`staff` / `admin`)
- **Status**: `201 Created`
- **Request Body**: `ProductCreate`
```json
{
  "category": "hot_coffee",
  "name": "Flat White",
  "description": "Double espresso with microfoam steamed milk",
  "base_price": 220.0,
  "image_url": "https://images.unsplash.com/photo-1577968897966-3d4325b36b61?w=500",
  "modifiers": [
    {
      "modifier_group": "size",
      "option_name": "Large",
      "price_delta": 40.0
    },
    {
      "modifier_group": "milk",
      "option_name": "Almond Milk",
      "price_delta": 35.0
    }
  ]
}
```
- **Success Response**: `ProductOut`

#### `DELETE /api/staff/products/{product_id}`
Delete a product and all its associated modifiers from the catalog.
- **Auth**: Bearer Token (`staff` / `admin`)
- **Status**: `200 OK`
- **Success Response**:
```json
{
  "message": "Product 'Flat White' deleted successfully",
  "id": "7a35e82e-68bc-4526-9f84-5f7561858ce1"
}
```

---

### Customer Favorites (`/api/favorites`)

#### `GET /api/favorites`
List all saved customized drink presets for the logged-in customer.
- **Auth**: Bearer Token (`get_current_user`)
- **Status**: `200 OK`
- **Success Response**: `List[FavoriteOut]`
```json
[
  {
    "id": "5fa23d11-1234-5678-9abc-def012345678",
    "product_id": "7a35e82e-68bc-4526-9f84-5f7561858ce1",
    "product_name": "Cortado",
    "product_image": "https://images.unsplash.com/photo-1534778101976-62847782c213?w=500",
    "base_price": "210.00",
    "label": "My Morning Roastery Brew",
    "selected_modifiers": [
      {
        "modifier_id": "8d1f7c3e-8c44-4861-a0a4-37463f25608e",
        "group": "size",
        "option_name": "Large (350ml)",
        "price_delta": 50.0
      },
      {
        "modifier_id": "4b2f7c3e-8c44-4861-a0a4-37463f25608f",
        "group": "milk",
        "option_name": "Oat Milk",
        "price_delta": 45.0
      }
    ],
    "calculated_price": "305.00",
    "is_available": true,
    "created_at": "2026-09-18T12:00:00.000Z"
  }
]
```

#### `POST /api/favorites`
Save a customized drink preset for quick re-ordering.
- **Auth**: Bearer Token (`get_current_user`)
- **Status**: `201 Created`
- **Request Body**: `FavoriteCreate`
```json
{
  "product_id": "7a35e82e-68bc-4526-9f84-5f7561858ce1",
  "label": "My Morning Roastery Brew",
  "selected_modifiers": [
    {
      "modifier_id": "8d1f7c3e-8c44-4861-a0a4-37463f25608e",
      "group": "size",
      "option_name": "Large (350ml)",
      "price_delta": 50.0
    },
    {
      "modifier_id": "4b2f7c3e-8c44-4861-a0a4-37463f25608f",
      "group": "milk",
      "option_name": "Oat Milk",
      "price_delta": 45.0
    }
  ]
}
```
*Note: `SelectedModifierInFavorite` accepts either `"modifier_id"` or `"id"`, and either `"group"` or `"modifier_group"`.*
- **Success Response**: `FavoriteOut`

#### `DELETE /api/favorites/{favorite_id}`
Delete a favorite preset.
- **Auth**: Bearer Token (`get_current_user`)
- **Status**: `200 OK`
- **Success Response**: `{"detail": "Favorite preset removed"}`
- **Error Responses**:
  - `404 Not Found`: `{"detail": "Favorite preset not found"}`

---

## 7. Database Seed Data & Fixtures

Located in `backend/app/seed.py`:

### 7.1 Seeded Outlets
1. **Downtown Roastery**
   - Address: `102 MG Road, Heritage District`
   - Opening Hours: `07:00` - `23:00`
   - Average Prep: `12 minutes`
2. **Cyber City Hub**
   - Address: `Ground Floor, Tower B, Tech Park`
   - Opening Hours: `08:00` - `21:30`
   - Average Prep: `10 minutes`

### 7.2 Seeded Users & Test Credentials
| Full Name | Email | Password | Phone | Role | Initial Loyalty Balance |
|---|---|---|---|---|---|
| **Outlet Staff** | `staff@coffee.com` | `staff123` | `9876543210` | `staff` | `0` |
| **Alex Turner** | `alex@coffee.com` | `alex123` | `9123456780` | `customer` | `120` *(test redemption)* |

### 7.3 Seeded Products
| Product Name | Category | Base Price | Modifiers Attached |
|---|---|---|---|
| **Cortado** | `hot_coffee` | ₹210.00 | Sizes, Milks, Sugars, Add-ons |
| **Cold Brew Tonic** | `cold_coffee` | ₹260.00 | Sizes, Milks, Sugars, Add-ons |
| **Iced Strawberry Matcha Latte** | `matcha` | ₹320.00 | Sizes, Milks, Sugars, Add-ons |
| **Almond Croissant** | `food` | ₹190.00 | *(No modifiers)* |

### 7.4 Seeded Modifier Groups & Options (for beverages)
- **Size (`size`)**:
  - Regular (250ml): +₹0.00
  - Large (350ml): +₹50.00
- **Milk Choice (`milk`)**:
  - Whole Milk: +₹0.00
  - Oat Milk: +₹45.00
  - Almond Milk: +₹45.00
- **Sugar Level (`sugar`)**:
  - Unsweetened (0%): +₹0.00
  - Mild (50%): +₹0.00
  - Standard (100%): +₹0.00
- **Add-ons (`add_ons`)**:
  - Extra Espresso Shot: +₹55.00
  - Vanilla Bean Syrup: +₹35.00

---

## 8. Critical Frontend Discrepancies & Clarifications

Reviewing the existing frontend codebase (`frontend/src/`) reveals several assumptions that will break against the live backend unless reconciled in the frontend client:

1. **Authentication Register Response**:
   - **Backend Reality**: `POST /api/auth/register` takes `full_name`, `email`, `phone`, `password` and returns `UserOut` (`id`, `full_name`, `email`, `phone`, `role`, `loyalty_balance`, `created_at`). It does **not** issue a JWT token.
   - **Frontend Current Code**: `AuthContext.tsx` assumes register returns `{ access_token, user }` and does not supply `phone`.
   - **Frontend Action Required**: Frontend registration form must include `phone` (10-15 chars), and after successful registration, it should either call `/api/auth/login` automatically or prompt the user to login.

2. **Authentication Login Response**:
   - **Backend Reality**: `POST /api/auth/login` returns `Token` (`{ access_token: str, token_type: "bearer", role: str, user_id: UUID }`). It does **not** include the nested `user` profile object.
   - **Frontend Current Code**: `AuthContext.tsx` attempts `setUser(res.data.user)`.
   - **Frontend Action Required**: After login returns `access_token`, the frontend must immediately fetch `GET /api/auth/me` with the bearer token to load the full `User` object.

3. **Missing "city" on Outlet**:
   - **Backend Reality**: `OutletOut` has `id`, `name`, `address`, `is_active`, `opening_time`, `closing_time`, `avg_prep_minutes`. There is no `city` column.
   - **Frontend Types**: `frontend/src/types/index.ts` defined `city: string`.
   - **Frontend Action Required**: Remove `city` from frontend `Outlet` interface, or parse city from `address`.

4. **Modifier Field Names**:
   - **Backend Reality**: `ProductOut.modifiers` returns `ModifierOut` with `id`, `modifier_group`, `option_name`, `price_delta`.
   - **Frontend Types**: `ModifierOption` in frontend types was expecting `group` and `is_available`.
   - **Frontend Action Required**: Align frontend types to expect `modifier_group`. (When creating orders, `ModifierSelection` accepts `group: str`).

5. **Pickup Slots Representation**:
   - **Backend Reality**: There is **no separate "Pickup Slots" database table or endpoint**.
   - **Pickup Mechanism**: Orders use `pickup_type: "immediate" | "scheduled"`, and `scheduled_pickup_time: Optional[datetime]`. The outlet provides `opening_time`, `closing_time`, and `avg_prep_minutes`.
   - **Frontend Action Required**: The frontend UI generates pickup slot time chips dynamically based on the current outlet's operating hours and preparation buffer.

6. **Payment Flow**:
   - **Backend Reality**: There is no payment gateway integration (Stripe/Razorpay) or separate Payments table. Orders default to `payment_status: "PAID"` immediately on `POST /api/orders`.
   - **Frontend Action Required**: Treat checkout as an instant confirmation flow without an external payment gateway redirect.

7. **Order Status "REJECTED"**:
   - **Backend Reality**: In `Order` model comments and `OrderStatusUpdate` schema, statuses are `ORDER_RECEIVED`, `PREPARING`, `READY_FOR_PICKUP`, `COMPLETED`, `CANCELLED`. However, the `/api/staff/orders/{order_id}/decision` endpoint sets `order.status = "REJECTED"`.
   - **Frontend Action Required**: The frontend order tracking and staff dashboard must recognize `"REJECTED"` as a valid terminal status alongside `"CANCELLED"`.
