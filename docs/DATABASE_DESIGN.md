# WasteNot Database Design

WasteNot uses exactly four application tables.

## 1. users

| Column | Type | Constraints / purpose |
|---|---|---|
| id | SERIAL | Primary key |
| name | VARCHAR(100) | Required |
| email | VARCHAR(255) | Required, unique |
| password | VARCHAR(255) | Required, bcrypt hash |
| location | VARCHAR(120) | Required locality/city |
| created_at | TIMESTAMPTZ | Creation timestamp |

Stores registered users.

## 2. surplus_food

| Column | Type | Constraints / purpose |
|---|---|---|
| id | SERIAL | Primary key |
| user_id | INTEGER | FK → users.id |
| food_name | VARCHAR(150) | Required |
| category | VARCHAR(50) | Controlled category values |
| quantity | NUMERIC(10,2) | Must be > 0 |
| unit | VARCHAR(30) | kg, portions, loaves, etc. |
| available_until | TIMESTAMPTZ | Deadline |
| location | VARCHAR(120) | Stored locality/city |
| description | TEXT | Optional description |
| status | VARCHAR(20) | AVAILABLE / CLAIMED / REDISTRIBUTED / EXPIRED |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last modification timestamp |

This is the main CRUD entity.

## 3. claims

| Column | Type | Constraints / purpose |
|---|---|---|
| id | SERIAL | Primary key |
| surplus_id | INTEGER | FK → surplus_food.id |
| user_id | INTEGER | FK → users.id |
| organization_id | INTEGER nullable | FK → organizations.id |
| quantity | NUMERIC(10,2) | Must be > 0 |
| claim_type | VARCHAR(20) | PERSONAL / REDISTRIBUTION |
| status | VARCHAR(20) | COMPLETED |
| claimed_at | TIMESTAMPTZ | Claim timestamp |

A personal claim has `organization_id = NULL`. Redistribution requires an organization.

A partial unique index ensures at most one completed claim per surplus listing.

## 4. organizations

| Column | Type | Constraints / purpose |
|---|---|---|
| id | SERIAL | Primary key |
| name | VARCHAR(150) | Organization name |
| type | VARCHAR(80) | NGO, trust, community organization, etc. |
| location | VARCHAR(120) | Matching locality/city |
| contact | VARCHAR(150) | Demo contact detail |

Stores registered redistribution recipients.

## Relationships

```text
users.id
   │
   └────────< surplus_food.user_id

surplus_food.id
   │
   └────────< claims.surplus_id

users.id
   │
   └────────< claims.user_id

organizations.id
   │
   └────────< claims.organization_id
```

## Location matching

No GPS, maps, live distance or external API is used. Redistribution uses a case-insensitive text comparison between `surplus_food.location` and `organizations.location`.

## Data integrity

The schema uses primary keys, foreign keys, unique email, NOT NULL constraints, positive quantity checks, controlled status/category values, and claim-type/organization consistency checks.
