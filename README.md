# WasteNot — Food Surplus Redistribution Platform

WasteNot is a full-stack Cloud Computing project that helps people redistribute safe edible surplus food instead of wasting it. A user can publish surplus food, another user can claim it for personal use, or it can be redistributed to a registered organization in the same stored locality.

## Features

- User registration, login and logout
- bcrypt password hashing
- Surplus food CRUD operations
- Personal food claiming
- Organization redistribution
- Simple city/locality matching
- AVAILABLE → CLAIMED / REDISTRIBUTED / EXPIRED workflow
- Backend-enforced expiry and validation
- PostgreSQL transactions for claims
- Live dashboard statistics from PostgreSQL
- Food Waste Prevented metric based on completed claim quantities
- REST APIs documented for Postman
- Responsive HTML/CSS/Vanilla JavaScript frontend
- Supabase-hosted PostgreSQL readiness
- Render deployment readiness

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js, Express.js |
| Database | PostgreSQL / Supabase |
| DB driver | pg |
| Configuration | dotenv |
| Password security | bcrypt |
| API testing | Postman |
| Version control | GitHub |
| Deployment | Render |
| Diagrams | draw.io (optional) |

## Architecture

```text
User Browser
    ↓
HTML + CSS + Vanilla JavaScript
    ↓ REST / JSON
Node.js + Express.js
    ↓ parameterized SQL
PostgreSQL
    ↓
Supabase Cloud PostgreSQL
```

For cloud deployment:

```text
User Browser → Render Web Service → Node.js/Express → Supabase PostgreSQL
```

See `docs/ARCHITECTURE.md` for the college-project explanation.

## Database

WasteNot uses exactly four application tables:

1. `users` — registered users
2. `surplus_food` — all food listings
3. `claims` — successful claim/redistribution records
4. `organizations` — registered NGOs/organizations

See `database/schema.sql` and `docs/DATABASE_DESIGN.md`.

## API overview

- `GET /api/health`
- `POST /api/users`
- `POST /api/users/login`
- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/surplus`
- `GET /api/surplus`
- `GET /api/surplus/:id`
- `PUT /api/surplus/:id`
- `DELETE /api/surplus/:id`
- `POST /api/claims`
- `GET /api/claims`
- `GET /api/claims/:id`
- `GET /api/organizations`
- `GET /api/organizations/:id`
- `GET /api/dashboard`

Authenticated endpoints require `Authorization: Bearer <token>` after login.

## Local setup

### 1. Prerequisites

Install:

- Node.js 18 or later
- npm
- A PostgreSQL database (local PostgreSQL or Supabase)

### 2. Install dependencies

```bash
npm install
```

### 3. Create environment configuration

Copy `.env.example` to `.env` and fill in the values:

```env
DATABASE_URL=your-postgresql-connection-string
PORT=3000
AUTH_SECRET=your-long-random-secret
DB_SSL=false
```

Never commit `.env`.

### 4. Initialize the database

Run the contents of `database/schema.sql` first. Then run `database/seed.sql`.

For a local PostgreSQL installation you can use `psql`:

```bash
psql "YOUR_DATABASE_URL" -f database/schema.sql
psql "YOUR_DATABASE_URL" -f database/seed.sql
```

Or paste each SQL file into the PostgreSQL/Supabase SQL editor.

### 5. Start the application

```bash
npm start
```

Open `http://localhost:3000` in your browser.

### Demo account

The seed file contains fictional demo users. Their password is:

`demo123`

Example:

`divya@wastenot.demo`

## Environment variables

- `DATABASE_URL` — PostgreSQL/Supabase connection string
- `PORT` — Render supplies this automatically in deployment; locally 3000 is fine
- `AUTH_SECRET` — long random secret used to sign lightweight login tokens
- `DB_SSL` — set to `true` when the database provider requires SSL (recommended for Supabase)

## Supabase setup

1. Create a Supabase project.
2. Open the project's SQL Editor.
3. Run `database/schema.sql`.
4. Run `database/seed.sql`.
5. Obtain the PostgreSQL connection string from the Supabase database connection settings.
6. Prefer the provider's connection/pooler option suitable for your deployment environment.
7. Put the connection string into `DATABASE_URL`.
8. Set `DB_SSL=true` if required by the selected Supabase connection.
9. Start the application and check `GET /api/health`.

Do not put the Supabase password into source code, SQL files, or GitHub.

## Render deployment

1. Push the complete `WasteNot` folder to a GitHub repository.
2. Create a new **Web Service** on Render and connect the repository.
3. Runtime: Node.
4. Build command: `npm install`.
5. Start command: `npm start`.
6. Add these Render environment variables:
   - `DATABASE_URL` = your Supabase PostgreSQL connection string
   - `AUTH_SECRET` = a strong random secret
   - `DB_SSL` = `true` if required by your Supabase connection
7. Deploy.
8. Test the generated Render URL by opening the site and calling `/api/health`.

The project is **deployment-ready**, but this repository does not claim that a deployment has already been performed.

## Project structure

```text
WasteNot/
├── server.js
├── package.json
├── package-lock.json              # created by npm install
├── .env.example
├── .gitignore
├── README.md
├── database/
│   ├── schema.sql
│   └── seed.sql
├── routes/
│   ├── users.js
│   ├── surplus.js
│   ├── claims.js
│   ├── organizations.js
│   └── dashboard.js
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
└── docs/
    ├── API_DOCUMENTATION.md
    ├── DATABASE_DESIGN.md
    ├── ARCHITECTURE.md
    └── TESTING.md
```

## Testing

Use Postman against `http://localhost:3000` locally or your Render URL after deployment. Follow `docs/TESTING.md`.

## Future improvements

- Role-based organization accounts
- Email notifications
- Admin moderation
- Partial quantity allocation with multiple claims
- Better locality normalization
- Audit logging

These are intentionally outside the current scope so the four-table student architecture remains understandable.

## Manual configuration still required

1. Install Node.js/npm if not already installed.
2. Create a PostgreSQL database or Supabase project.
3. Run `database/schema.sql` and `database/seed.sql`.
4. Create `.env` from `.env.example` and add the database URL and authentication secret.
5. Run `npm install` and `npm start`.
6. If deploying, create the GitHub repository and Render Web Service, then add the environment variables.
7. Test the deployed service before stating that deployment is complete.
