-- Applied once, in file name order, on `npm run dev` (local) and on deploy (live).
-- Before the first deploy you can change this file freely. After a deploy, never edit it:
-- add 0002_something.sql instead.

-- One row per customer from your spreadsheet or CRM export. Matched on the account number
-- (or the email when there is none) when a new file is uploaded, so notes stay attached.
-- Customers missing from the latest upload are kept and marked (in_latest = 0).
CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_key TEXT NOT NULL UNIQUE,
  account_number TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT '',
  account_manager TEXT NOT NULL DEFAULT '',
  customer_since TEXT NOT NULL DEFAULT '',
  search_text TEXT NOT NULL DEFAULT '',     -- every field in lowercase, for search
  last_import_id INTEGER,
  in_latest INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX customers_name ON customers (name);
CREATE INDEX customers_import ON customers (last_import_id);

CREATE TABLE notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers (id),
  body TEXT NOT NULL,
  author_email TEXT NOT NULL,
  author_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX notes_customer ON notes (customer_id, created_at);

-- One row per spreadsheet upload.
CREATE TABLE imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  uploaded_by_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done')),
  row_count INTEGER NOT NULL DEFAULT 0,
  removed_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  finished_at TEXT
);

-- Roles inside the app, managed on the People page by the owner and admins.
-- The owner (the person who first deployed the app) always has every role and is not listed here.
-- role is one of: admin
CREATE TABLE roles (
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  added_by TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (email, role)
);
