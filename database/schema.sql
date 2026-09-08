-- WasteNot PostgreSQL schema: exactly four application tables.

DROP TABLE IF EXISTS claims CASCADE;
DROP TABLE IF EXISTS surplus_food CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL CHECK (length(trim(name)) > 0),
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  location VARCHAR(120) NOT NULL CHECK (length(trim(location)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(80) NOT NULL,
  location VARCHAR(120) NOT NULL,
  contact VARCHAR(150) NOT NULL
);

CREATE TABLE surplus_food (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_name VARCHAR(150) NOT NULL CHECK (length(trim(food_name)) > 0),
  category VARCHAR(50) NOT NULL CHECK (category IN ('Cooked Food','Groceries','Bakery','Fruits & Vegetables','Beverages','Other')),
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  unit VARCHAR(30) NOT NULL CHECK (length(trim(unit)) > 0),
  available_until TIMESTAMPTZ NOT NULL,
  location VARCHAR(120) NOT NULL CHECK (length(trim(location)) > 0),
  description TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','CLAIMED','REDISTRIBUTED','EXPIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE claims (
  id SERIAL PRIMARY KEY,
  surplus_id INTEGER NOT NULL REFERENCES surplus_food(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id INTEGER NULL REFERENCES organizations(id) ON DELETE SET NULL,
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  claim_type VARCHAR(20) NOT NULL CHECK (claim_type IN ('PERSONAL','REDISTRIBUTION')),
  status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((claim_type = 'PERSONAL' AND organization_id IS NULL) OR (claim_type = 'REDISTRIBUTION' AND organization_id IS NOT NULL))
);

CREATE INDEX idx_surplus_location ON surplus_food (location);
CREATE INDEX idx_surplus_status ON surplus_food (status);
CREATE UNIQUE INDEX one_completed_claim_per_surplus ON claims (surplus_id) WHERE status = 'COMPLETED';
