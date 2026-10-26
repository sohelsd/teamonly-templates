-- Applied once, in file name order, on `npm run dev` (local) and on deploy (live).
-- Before the first deploy you can change this file freely. After a deploy, never edit it:
-- add 0002_something.sql instead.

CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  spent_on TEXT NOT NULL,                 -- YYYY-MM-DD, the day of the purchase
  receipt_key TEXT NOT NULL,              -- where the receipt file is in ctx.files
  receipt_name TEXT NOT NULL,
  receipt_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_by TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  decided_by TEXT,
  decided_by_name TEXT,
  decided_at TEXT,
  decision_note TEXT
);
CREATE INDEX expenses_created_by ON expenses (created_by, id);
CREATE INDEX expenses_status ON expenses (status, decided_at);

-- Roles inside the app, managed on the People page by the owner and admins.
-- The owner (the person who first deployed the app) always has every role and is not listed here.
-- role is one of: approver, finance, admin
CREATE TABLE roles (
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  added_by TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (email, role)
);
