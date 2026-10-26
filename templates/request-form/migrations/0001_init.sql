-- Applied once, in file name order, on `npm run dev` (local) and on deploy (live).
-- Before the first deploy you can change this file freely. After a deploy, never edit it:
-- add 0002_something.sql instead.

CREATE TABLE requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  needed_by TEXT,                          -- YYYY-MM-DD, optional
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'done')),
  reply TEXT,                              -- note from the team, shown to the person who asked
  assigned_to TEXT,
  assigned_to_name TEXT,
  created_by TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_by_name TEXT,
  done_at TEXT
);
CREATE INDEX requests_status ON requests (status, id);
CREATE INDEX requests_created_by ON requests (created_by, id);

-- Roles inside the app, managed on the People page by the owner and admins.
-- The owner (the person who first deployed the app) always has every role and is not listed here.
-- role is one of: handler, admin
CREATE TABLE roles (
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  added_by TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (email, role)
);
