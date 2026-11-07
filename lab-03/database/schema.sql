-- Lab 3: Bookstore schema
-- The table name is "book" (singular). A typo here produces the classic
-- "SQLITE_ERROR: no such table" debugging exercise.

CREATE TABLE IF NOT EXISTS book (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  price REAL NOT NULL CHECK (price >= 0),
  pages INTEGER NOT NULL DEFAULT 0
);
