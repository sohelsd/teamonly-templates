-- Applied once, in file name order, on `npm run dev` (local) and on deploy (live).
-- Before the first deploy you can change this file freely. After a deploy, never edit it:
-- add 0002_something.sql instead.

CREATE TABLE docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('pdf', 'markdown', 'text')),
  file_key TEXT,                           -- the original file in ctx.files (null if file storage was off)
  size_bytes INTEGER NOT NULL,
  pages INTEGER,                           -- PDFs only
  passage_count INTEGER NOT NULL DEFAULT 0,
  uploaded_by TEXT NOT NULL,
  uploaded_by_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Each document split into passages of a few paragraphs, with the page (PDF) or heading (Markdown) they came from.
CREATE TABLE passages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id INTEGER NOT NULL REFERENCES docs (id),
  ord INTEGER NOT NULL,
  page INTEGER,
  heading TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL
);
CREATE INDEX passages_doc ON passages (doc_id, ord);

-- Full-text search over the passages (SQLite FTS5). rowid = passages.id.
CREATE VIRTUAL TABLE passages_fts USING fts5(heading, body, tokenize = 'porter unicode61');

-- Roles inside the app, managed on the People page by the owner and admins.
-- The owner (the person who first deployed the app) always has every role and is not listed here.
-- role is one of: editor, admin
CREATE TABLE roles (
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  added_by TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (email, role)
);
