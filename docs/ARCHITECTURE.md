# WasteNot Architecture

## Application architecture

```text
┌──────────────────────────────┐
│          User Browser        │
│ HTML + CSS + Vanilla JS     │
└──────────────┬───────────────┘
               │ REST / JSON
               ▼
┌──────────────────────────────┐
│       Node.js + Express      │
│ Routes + validation + auth   │
└──────────────┬───────────────┘
               │ parameterized SQL
               ▼
┌──────────────────────────────┐
│         PostgreSQL           │
│         4 tables             │
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│     Supabase Cloud DB        │
└──────────────────────────────┘
```

Express serves the static frontend from the same Node.js application, allowing the project to run as one Render web service.

## Components

### Frontend

HTML provides page structure, CSS provides responsive presentation, and Vanilla JavaScript handles navigation, forms, API requests, rendering, validation feedback, authentication state and claim actions.

### Backend

Express exposes REST endpoints. Route modules are separated by resource: users, surplus, claims, organizations and dashboard.

### REST API

The frontend communicates with the backend using JSON over HTTP. CRUD is implemented for the main `surplus_food` resource.

### Database

PostgreSQL stores persistent application data. SQL queries use parameters rather than string concatenation to reduce SQL injection risk.

### Supabase

Supabase supplies hosted PostgreSQL for the cloud database layer. The application does not depend on Supabase-specific application SDKs; it connects through PostgreSQL using `pg`.

### Render

Render can host the Node.js/Express application as a Web Service. Environment variables provide the cloud database URL and authentication secret.

## Authentication approach

The project uses bcrypt for password hashing. After login, the server creates a lightweight signed bearer token using Node's built-in `crypto` module. No authentication table is needed, preserving the required four-table model. The token contains basic user identity and is verified with an HMAC signature before protected routes execute.

Logout is handled by clearing the token from the browser. This is intentionally simpler than introducing JWT/OAuth/session frameworks for a 10-mark student project.

## Claim transaction

Claiming/redistributing food requires two related database operations:

```text
BEGIN
  lock surplus row
  validate availability + deadline + quantity
  validate organization when needed
  INSERT claim
  UPDATE surplus status
COMMIT
```

If any operation fails, the backend rolls the transaction back.

## Cloud deployment flow

```text
Local development
      ↓
GitHub repository
      ↓
Render Web Service
      ↓
Node.js + Express
      ↓
Supabase PostgreSQL
```

This demonstrates cloud hosting, managed cloud database usage, environment-based configuration, and a deployable client-server architecture without adding Docker, Kubernetes or microservices.
