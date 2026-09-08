# WasteNot API Documentation

Base URL locally: `http://localhost:3000`

Protected endpoints require:

```http
Authorization: Bearer <token>
```

## Response convention

Successful responses generally use:

```json
{ "success": true, "message": "...", "...": "data" }
```

Errors use:

```json
{ "success": false, "message": "Reason" }
```

## 1. Health

### GET `/api/health`

Purpose: Verify that the Express server and PostgreSQL database are reachable.

Success `200`:

```json
{ "success": true, "message": "WasteNot API is running", "database": "connected" }
```

Database failure: `503`.

## 2. Register

### POST `/api/users`

Purpose: Create a user account.

Request:

```json
{
  "name": "Divya",
  "email": "divya@example.com",
  "password": "secret123",
  "location": "Chennai"
}
```

Success: `201` with the safe user fields (never the password).

Errors: `400` validation, `409` duplicate email, `500` unexpected error.

## 3. Login

### POST `/api/users/login`

Request:

```json
{ "email": "divya@wastenot.demo", "password": "demo123" }
```

Success `200` returns a signed bearer token and safe user information.

Errors: `400` missing fields, `401` invalid credentials.

## 4. Users

### GET `/api/users`

Returns registered users without passwords.

### GET `/api/users/:id`

Returns one user without the password.

Errors: `400` invalid ID, `404` not found.

## 5. Surplus CRUD

### POST `/api/surplus`

Creates a listing owned by the authenticated user.

Request:

```json
{
  "food_name": "Vegetable Biryani",
  "category": "Cooked Food",
  "quantity": 10,
  "unit": "portions",
  "available_until": "2026-09-09T21:00",
  "location": "Chennai",
  "description": "Fresh surplus portions."
}
```

Success: `201`.

Errors: `400` invalid input.

### GET `/api/surplus`

Returns listings. Useful filters:

- `?location=Chennai`
- `?status=AVAILABLE`
- `?category=Bakery`
- `?mine=true`

Expired AVAILABLE listings are marked `EXPIRED` by the backend before results are returned.

### GET `/api/surplus/:id`

Returns one listing and applies expiry handling.

Errors: `400`, `404`.

### PUT `/api/surplus/:id`

Updates an authenticated user's eligible `AVAILABLE` or `EXPIRED` listing. A completed `CLAIMED` or `REDISTRIBUTED` listing cannot be changed.

Errors: `400`, `403`, `404`, `409`.

### DELETE `/api/surplus/:id`

Deletes an authenticated user's eligible `AVAILABLE` or `EXPIRED` listing. Completed listings cannot be deleted.

Errors: `400`, `403`, `404`, `409`.

## 6. Claims

### POST `/api/claims`

Creates a completed personal claim or redistribution inside a PostgreSQL transaction.

Personal request:

```json
{
  "surplus_id": 1,
  "quantity": 5,
  "claim_type": "PERSONAL",
  "organization_id": null
}
```

Redistribution request:

```json
{
  "surplus_id": 1,
  "quantity": 10,
  "claim_type": "REDISTRIBUTION",
  "organization_id": 2
}
```

Rules enforced by the backend:

1. Surplus must exist.
2. Status must be `AVAILABLE`.
3. Deadline must not have passed.
4. Quantity must be positive and no greater than the listing quantity.
5. Redistribution organization must exist.
6. Redistribution organization location must match the food location.
7. A completed claim cannot already exist for the surplus.
8. Claim insertion and surplus status update commit together.

Success: `201`.

Errors: `400`, `404`, `409`, `500`.

### GET `/api/claims`

Returns claims involving the authenticated user: claims they made and claims associated with their own surplus listings.

### GET `/api/claims/:id`

Returns a claim the authenticated user is entitled to view.

Errors: `400`, `403`, `404`.

## 7. Organizations

### GET `/api/organizations`

Returns organizations. Optional filter:

`GET /api/organizations?location=Chennai`

### GET `/api/organizations/:id`

Returns one organization.

Errors: `400`, `404`.

## 8. Dashboard

### GET `/api/dashboard`

Calculates statistics from PostgreSQL; values are never hard-coded.

Example shape:

```json
{
  "success": true,
  "totalListings": 10,
  "availableListings": 4,
  "claimedListings": 4,
  "redistributedListings": 2,
  "foodWastePrevented": 125
}
```

`foodWastePrevented` is the sum of `claims.quantity` where `claims.status = 'COMPLETED'`.
