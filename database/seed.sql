-- Fictional demonstration data. Password for all demo users: demo123
-- The bcrypt hash is intentionally the same because the sample password is the same.

INSERT INTO users (name, email, password, location) VALUES
('Divya Keerthana', 'divya@wastenot.demo', '$2b$10$CclvhG085t0v8nd0Ba7Bh.MTO23M88lnn5y4CgkeZFAI3JqUGqPH.', 'Chennai'),
('Karthik Kumar', 'karthik@wastenot.demo', '$2b$10$CclvhG085t0v8nd0Ba7Bh.MTO23M88lnn5y4CgkeZFAI3JqUGqPH.', 'Chennai'),
('Meera Shah', 'meera@wastenot.demo', '$2b$10$CclvhG085t0v8nd0Ba7Bh.MTO23M88lnn5y4CgkeZFAI3JqUGqPH.', 'Bengaluru');

INSERT INTO organizations (name, type, location, contact) VALUES
('Chennai Community Kitchen', 'NGO', 'Chennai', 'contact@cck.example'),
('Hope Meals Foundation', 'Charitable Trust', 'Chennai', '044-4000-1234'),
('Bengaluru Food Rescue', 'Food Rescue NGO', 'Bengaluru', 'rescue@bfr.example'),
('Green Plate Collective', 'Community Organization', 'Coimbatore', 'contact@gpc.example');

INSERT INTO surplus_food (user_id, food_name, category, quantity, unit, available_until, location, description, status) VALUES
(1, 'Vegetable Biryani', 'Cooked Food', 15, 'portions', NOW() + INTERVAL '2 days', 'Chennai', 'Freshly prepared surplus portions, packed for safe redistribution.', 'AVAILABLE'),
(1, 'Bananas', 'Fruits & Vegetables', 8, 'kg', NOW() + INTERVAL '1 day', 'Chennai', 'Ripe bananas suitable for immediate consumption.', 'AVAILABLE'),
(2, 'Bread Loaves', 'Bakery', 12, 'loaves', NOW() + INTERVAL '3 days', 'Chennai', 'Sealed bakery surplus from a fictional local store.', 'AVAILABLE'),
(2, 'Cooked Rice', 'Cooked Food', 20, 'portions', NOW() - INTERVAL '1 day', 'Chennai', 'Demo listing used to show expiry handling.', 'EXPIRED'),
(3, 'Tomatoes', 'Fruits & Vegetables', 10, 'kg', NOW() - INTERVAL '2 days', 'Bengaluru', 'Demo listing already redistributed.', 'REDISTRIBUTED');

INSERT INTO claims (surplus_id, user_id, organization_id, quantity, claim_type, status, claimed_at) VALUES
(5, 2, 3, 10, 'REDISTRIBUTION', 'COMPLETED', NOW() - INTERVAL '1 day');
