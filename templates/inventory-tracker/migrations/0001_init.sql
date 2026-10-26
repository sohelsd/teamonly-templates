-- Applied once, in file name order, on `npm run dev` (local) and on deploy (live).
-- Before the first deploy you can change this file freely. After a deploy, never edit it:
-- add 0002_something.sql instead.

CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',      -- bin, shelf, room or site
  qty INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  reorder_level INTEGER NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX items_name ON items (name);
CREATE INDEX items_location ON items (location);
CREATE INDEX items_low ON items (qty, reorder_level);

-- Every change to a count, with who made it and why.
CREATE TABLE movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  change INTEGER NOT NULL,
  qty_after INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('received', 'used', 'damaged', 'count', 'new_item', 'import')),
  note TEXT NOT NULL DEFAULT '',
  by_email TEXT NOT NULL,
  by_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX movements_item ON movements (item_id, id);

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
