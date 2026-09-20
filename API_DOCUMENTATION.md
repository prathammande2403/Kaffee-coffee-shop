# Kaffee API Documentation

Complete REST API reference for the Kaffee (Artisan Coffee) backend — a FastAPI service backing the coffee ordering and roastery management app.

- **Base URL (local):** `http://localhost:8000`
- **API prefix:** `/api` (all routes below except `/health`)
- **Interactive docs:** Swagger UI at `/docs`, ReDoc at `/redoc`, OpenAPI JSON at `/openapi.json`
- **Content type:** `application/json` for all requests and responses

---

## Table of Contents

- [Authentication](#authentication)
- [Conventions](#conventions)
- [System & Health](#system--health)
- [Auth & Profile](#auth--profile-apiauth)
- [Outlets](#outlets-apioutlets)
- [Menu & Products](#menu--products-apimenu)
- [Orders & Checkout](#orders--checkout-apiorders)
- [Staff Operations](#staff-operations-apistaff)
- [Customer Favorites](#customer-favorites-apifavorites)
- [Enums & Constants Reference](#enums--constants-reference)
- [Error Format](#error-format)

---

## Authentication

Authentication is **stateless JWT**, signed with `HS256`.

1. Register — `POST /api/auth/register` (returns the user profile, **not** a token).
2. Log in — `POST /api/auth/login` (returns `access_token`).
3. Attach the token to every subsequent request:

```
Authorization: Bearer <access_token>
```

**JWT claims:**

```json
{
  "sub": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "role": "customer",
  "email": "alex@coffee.com",
  "name": "Alex Turner",
  "iat": 1726660000,
  "exp": 1727264800
}
```

- Token lifetime: **7 days** (10080 minutes).
- Missing / invalid / expired token → `401 Unauthorized`, header `WWW-Authenticate: Bearer`, body `{"detail": "Could not validate credentials"}`.
- Valid token but insufficient role (customer hitting a staff-only route) → `403 Forbidden`, body `{"detail": "The user does not have enough privileges"}`.

**Roles:** `customer` | `staff` | `admin`. Endpoints under `/api/staff/*` require `staff` or `admin`.

---

## Conventions

- All IDs (`id`, `*_id`) are UUIDs, sent and received as strings.
- All monetary fields (`base_price`, `price_delta`, `subtotal`, `tax`, `discount_amount`, `final_payable`, `unit_price`, `total_price`) are decimal strings with 2 places, in ₹ (INR).
- All timestamps are ISO-8601 UTC (`TIMESTAMPTZ`), e.g. `"2026-09-18T10:00:00.000Z"`.
- Endpoints that both accept and omit a trailing slash (`/api/orders` and `/api/orders/`) behave identically.
- Auth requirement per endpoint is noted as **Public**, **Bearer (any user)**, or **Bearer (staff/admin)**.

---

## System & Health

### `GET /health`

Check service status.

- **Auth:** Public
- **Response — `200 OK`:**
```json
{
  "status": "healthy",
  "service": "Artisan Coffee API",
  "environment": "development"
}
```

---

## Auth & Profile (`/api/auth`)

### `POST /api/auth/register`

Create a new customer account.

- **Auth:** Public
- **Status:** `201 Created`

**Request body:**
```json
{
  "full_name": "Alex Turner",
  "email": "alex@coffee.com",
  "phone": "9123456780",
  "password": "mypassword123"
}
```

| Field | Rule |
|---|---|
| `full_name` | 2–100 chars |
| `email` | valid email format |
| `phone` | 10–15 chars |
| `password` | 6–128 chars |

**Response — `201 Created`:**
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

**Errors:**
| Status | Body |
|---|---|
| `400` | `{"detail": "A user with this email or phone number already exists"}` |
| `422` | Validation failure (short password, invalid email, etc.) |

> Registration does **not** return a token — follow up with a login call.

---

### `POST /api/auth/login`

Exchange credentials for a JWT.

- **Auth:** Public
- **Status:** `200 OK`

**Request body:**
```json
{
  "email": "alex@coffee.com",
  "password": "mypassword123"
}
```

**Response — `200 OK`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "role": "customer",
  "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

**Errors:**
| Status | Body |
|---|---|
| `401` | `{"detail": "Invalid email or password"}` |

> The login response has no nested `user` object — call `GET /api/auth/me` next to load the full profile.

---

### `GET /api/auth/me`

Fetch the authenticated user's profile.

- **Auth:** Bearer (any user)
- **Status:** `200 OK`

**Response:**
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

**Errors:** `401` — invalid, expired, or missing token.

---

### `GET /api/auth/loyalty-history`

Fetch the authenticated user's full loyalty ledger.

- **Auth:** Bearer (any user)
- **Status:** `200 OK`

**Response — `List[LoyaltyTransactionOut]`:**
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

## Outlets (`/api/outlets`)

### `GET /api/outlets`

List all outlets.

- **Auth:** Public
- **Status:** `200 OK`

**Response — `List[OutletOut]`:**
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

### `GET /api/outlets/{outlet_id}`

Fetch a single outlet.

- **Auth:** Public
- **Status:** `200 OK`
- **Errors:** `404` — `{"detail": "Outlet not found"}`

---

## Menu & Products (`/api/menu`)

### `GET /api/menu`

List products, with modifiers, optionally scoped to an outlet and/or category.

- **Auth:** Public
- **Status:** `200 OK`

**Query parameters:**
| Param | Type | Notes |
|---|---|---|
| `outlet_id` | UUID (optional) | If set, `is_available` reflects that outlet's stock override |
| `category` | string (optional) | `hot_coffee` \| `cold_coffee` \| `matcha` \| `food` (omit or `"all"` for everything) |

**Response — `List[ProductOut]`:**
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
      { "id": "2d1f7c3e-...", "modifier_group": "size", "option_name": "Regular (250ml)", "price_delta": "0.00" },
      { "id": "8d1f7c3e-...", "modifier_group": "size", "option_name": "Large (350ml)", "price_delta": "50.00" },
      { "id": "4b2f7c3e-...", "modifier_group": "milk", "option_name": "Oat Milk", "price_delta": "45.00" },
      { "id": "5c3f7c3e-...", "modifier_group": "sugar", "option_name": "Unsweetened (0%)", "price_delta": "0.00" },
      { "id": "6d4f7c3e-...", "modifier_group": "add_ons", "option_name": "Extra Espresso Shot", "price_delta": "55.00" }
    ]
  }
]
```

### `GET /api/menu/{product_id}`

Fetch a single product with its modifiers.

- **Auth:** Public
- **Status:** `200 OK`
- **Errors:** `404` — `{"detail": "Product not found"}`

---

## Orders & Checkout (`/api/orders`)

### `POST /api/orders`

Place a new order.

- **Auth:** Bearer (any user)
- **Status:** `201 Created`

**Request body:**
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
        { "modifier_id": "8d1f7c3e-...", "group": "size", "option_name": "Large (350ml)", "price_delta": 50.0 },
        { "modifier_id": "4b2f7c3e-...", "group": "milk", "option_name": "Oat Milk", "price_delta": 45.0 }
      ]
    }
  ]
}
```

**Validation:**
| Rule | Detail |
|---|---|
| `outlet_id` | Must exist and be `is_active: true` |
| `items` | ≥ 1 item |
| `quantity` (per item) | 1–50 |
| `points_to_redeem` | If > 0: must be ≥ 50, and ≤ user's current `loyalty_balance` |
| `scheduled_pickup_time` | Required if `pickup_type = "scheduled"`; must be a future datetime |
| items | Each must be available globally **and** at the selected outlet |

**Response — `201 Created` (`OrderOut`):**
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
        { "modifier_id": "8d1f7c3e-...", "group": "size", "option_name": "Large (350ml)", "price_delta": 50.0 },
        { "modifier_id": "4b2f7c3e-...", "group": "milk", "option_name": "Oat Milk", "price_delta": 45.0 }
      ]
    }
  ]
}
```

**Errors:**
| Status | Message |
|---|---|
| `400` | "Specified outlet is temporarily closed" |
| `400` | "Order must contain at least one item" |
| `400` | "'<Product>' is currently marked unavailable and cannot be ordered" |
| `400` | "'<Product>' is out of stock at this selected outlet" |
| `400` | "Minimum 50 loyalty points required for redemption" |
| `400` | "Insufficient loyalty points. Current balance: X" |
| `404` | "Specified outlet does not exist" |
| `404` | "Product with ID ... no longer exists" |

---

### `GET /api/orders`

List the authenticated user's own orders, newest first.

- **Auth:** Bearer (any user)
- **Status:** `200 OK`
- **Response:** `List[OrderOut]`

---

### `GET /api/orders/{order_id}`

Get live tracking details for a single order.

- **Auth:** Bearer (any user)
- **Status:** `200 OK`
- **Access control:** Owner-only, unless caller's role is `staff` or `admin`
- **Response:** `OrderOut`

**Errors:**
| Status | Body |
|---|---|
| `404` | `{"detail": "Order not found"}` |
| `403` | `{"detail": "Not authorized to access this order"}` |

> ⚠️ **Known issue:** the success path of this endpoint can fall through without a `return` statement, occasionally producing an unexpected `500`. Client code should fall back to `GET /api/orders` and filter by `id` if this happens.

---

### `PATCH /api/orders/{order_id}/cancel`

Cancel an order before the kitchen starts preparing it.

- **Auth:** Bearer (any user, must own the order)
- **Status:** `200 OK`

**Rules:**
- Only allowed while `status == "ORDER_RECEIVED"`.
- Sets `status = "CANCELLED"`, `payment_status = "REFUNDED"`.
- Restores any redeemed points (`reason = "CANCELLED_REFUND"`).

**Response:** `OrderOut`

**Errors:**
| Status | Body |
|---|---|
| `400` | `{"detail": "Order cannot be cancelled because it is already 'PREPARING'"}` |
| `404` | `{"detail": "Order not found"}` |

---

### `POST /api/orders/{order_id}/repeat`

Re-check availability for a past order and return a pre-populated cart.

- **Auth:** Bearer (any user)
- **Status:** `200 OK`

**Response:**
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
        { "modifier_id": "8d1f7c3e-...", "group": "size", "option_name": "Large (350ml)", "price_delta": 50.0 }
      ]
    }
  ]
}
```

**Errors:**
| Status | Body |
|---|---|
| `400` | `{"detail": "Item '<Product>' is currently unavailable and cannot be reordered"}` |
| `404` | `{"detail": "Order not found"}` |

---

## Staff Operations (`/api/staff`)

> All endpoints in this section require a Bearer token with role `staff` or `admin`. Otherwise: `403 Forbidden`.

### `GET /api/staff/orders`

List every order in the system, newest first — for the kitchen/POS board.

- **Auth:** Bearer (staff/admin)
- **Status:** `200 OK`
- **Response:** `List[OrderOut]`

---

### `PATCH /api/staff/orders/{order_id}/decision`

Accept or reject an incoming order (must be `ORDER_RECEIVED`).

- **Auth:** Bearer (staff/admin)
- **Status:** `200 OK`

**Request body:**
```json
{
  "action": "ACCEPT",
  "rejection_reason": "Out of fresh whole milk"
}
```
`action` is `"ACCEPT"` or `"REJECT"`; `rejection_reason` is optional.

**Behavior:**
| Action | Effect |
|---|---|
| `ACCEPT` | `status → "PREPARING"` |
| `REJECT` | `status → "REJECTED"`, `payment_status → "REFUNDED"`, points refunded (`ORDER_REJECTED_REFUND`) |

**Response:** `OrderOut`

**Errors:**
| Status | Cause |
|---|---|
| `400` | Order not in `ORDER_RECEIVED`, or invalid `action` |
| `404` | Order not found |

---

### `PATCH /api/staff/orders/{order_id}/status`

Move an order through the kitchen state machine.

- **Auth:** Bearer (staff/admin)
- **Status:** `200 OK`

**Request body:**
```json
{ "status": "READY_FOR_PICKUP" }
```

**Allowed transitions:**
| From | To |
|---|---|
| `ORDER_RECEIVED` | `PREPARING`, `CANCELLED` |
| `PREPARING` | `READY_FOR_PICKUP`, `CANCELLED` |
| `READY_FOR_PICKUP` | `COMPLETED` |

**Side effects:**
- → `COMPLETED`: awards `floor(final_payable / 10)` points (`ORDER_EARN`).
- → `CANCELLED`: reverses any redeemed points (`REVERSAL`).

**Response:** `OrderOut`

**Errors:**
| Status | Body |
|---|---|
| `400` | `{"detail": "Invalid state transition: '<from>' to '<to>'"}` |

---

### `PATCH /api/staff/products/{product_id}/availability`

Toggle a product's global availability.

- **Auth:** Bearer (staff/admin)
- **Status:** `200 OK`

**Request body:**
```json
{ "is_available": false }
```

**Response:** `ProductOut`

---

### `PATCH /api/staff/products/{product_id}/outlet-availability`

Toggle a product's stock at one specific outlet.

- **Auth:** Bearer (staff/admin)
- **Status:** `200 OK`

**Request body:**
```json
{
  "outlet_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "is_available": false
}
```

**Response:**
```json
{ "detail": "Availability updated for outlet 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" }
```

---

### `POST /api/staff/products`

Add a new product, with its modifiers, to the catalog.

- **Auth:** Bearer (staff/admin)
- **Status:** `201 Created`

**Request body:**
```json
{
  "category": "hot_coffee",
  "name": "Flat White",
  "description": "Double espresso with microfoam steamed milk",
  "base_price": 220.0,
  "image_url": "https://images.unsplash.com/photo-1577968897966-3d4325b36b61?w=500",
  "modifiers": [
    { "modifier_group": "size", "option_name": "Large", "price_delta": 40.0 },
    { "modifier_group": "milk", "option_name": "Almond Milk", "price_delta": 35.0 }
  ]
}
```

**Response:** `ProductOut` (`201 Created`)

---

### `DELETE /api/staff/products/{product_id}`

Delete a product and all of its modifiers.

- **Auth:** Bearer (staff/admin)
- **Status:** `200 OK`

**Response:**
```json
{
  "message": "Product 'Flat White' deleted successfully",
  "id": "7a35e82e-68bc-4526-9f84-5f7561858ce1"
}
```

---

## Customer Favorites (`/api/favorites`)

### `GET /api/favorites`

List the authenticated customer's saved drink presets.

- **Auth:** Bearer (any user)
- **Status:** `200 OK`

**Response — `List[FavoriteOut]`:**
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
      { "modifier_id": "8d1f7c3e-...", "group": "size", "option_name": "Large (350ml)", "price_delta": 50.0 },
      { "modifier_id": "4b2f7c3e-...", "group": "milk", "option_name": "Oat Milk", "price_delta": 45.0 }
    ],
    "calculated_price": "305.00",
    "is_available": true,
    "created_at": "2026-09-18T12:00:00.000Z"
  }
]
```

### `POST /api/favorites`

Save a customized drink as a favorite preset.

- **Auth:** Bearer (any user)
- **Status:** `201 Created`

**Request body:**
```json
{
  "product_id": "7a35e82e-68bc-4526-9f84-5f7561858ce1",
  "label": "My Morning Roastery Brew",
  "selected_modifiers": [
    { "modifier_id": "8d1f7c3e-...", "group": "size", "option_name": "Large (350ml)", "price_delta": 50.0 },
    { "modifier_id": "4b2f7c3e-...", "group": "milk", "option_name": "Oat Milk", "price_delta": 45.0 }
  ]
}
```
> Each entry in `selected_modifiers` accepts either `modifier_id` or `id`, and either `group` or `modifier_group`.

**Response:** `FavoriteOut` (`201 Created`)

### `DELETE /api/favorites/{favorite_id}`

Remove a saved favorite.

- **Auth:** Bearer (any user)
- **Status:** `200 OK`
- **Response:** `{"detail": "Favorite preset removed"}`
- **Errors:** `404` — `{"detail": "Favorite preset not found"}`

---

## Enums & Constants Reference

**User roles:** `customer` | `staff` | `admin`

**Order status:** `ORDER_RECEIVED` | `PREPARING` | `READY_FOR_PICKUP` | `COMPLETED` | `CANCELLED` | `REJECTED`

**Payment status:** `PAID` | `REFUNDED`

**Pickup type:** `immediate` | `scheduled`

**Product category:** `hot_coffee` | `cold_coffee` | `matcha` | `food` | `add_ons`

**Modifier group:** `size` | `milk` | `sugar` | `add_ons`

**Loyalty transaction reason:**
| Reason | Trigger |
|---|---|
| `CHECKOUT_REDEEM` | Points spent at checkout |
| `ORDER_EARN` | Order marked `COMPLETED` |
| `CANCELLED_REFUND` | Customer self-cancel of an `ORDER_RECEIVED` order |
| `ORDER_REJECTED_REFUND` | Staff rejects an order |
| `REVERSAL` | Staff force-cancels an order via the status endpoint |

**Business constants:**
| Constant | Value |
|---|---|
| GST rate | 5% of subtotal |
| Loyalty earn rate | 1 point per ₹10 of `final_payable` |
| Loyalty point value | ₹1.00 per point |
| Minimum redemption | 50 points |

---

## Error Format

Errors follow FastAPI's default shape:

```json
{ "detail": "Human-readable message" }
```

| Status | Meaning |
|---|---|
| `400` | Bad request — business rule violation (closed outlet, insufficient points, invalid state transition, etc.) |
| `401` | Missing, invalid, or expired bearer token |
| `403` | Valid token, insufficient role, or not the resource owner |
| `404` | Resource not found |
| `422` | Request body failed schema validation (Pydantic) |

Validation errors (`422`) return FastAPI's standard array-of-errors body, e.g.:
```json
{
  "detail": [
    {
      "loc": ["body", "password"],
      "msg": "String should have at least 6 characters",
      "type": "string_too_short"
    }
  ]
}
```
