-- Lab 3: combined setup script for the SQLite CLI.
-- Usage: sqlite3 books.db < database/setup.sql

.read database/schema.sql
.read database/seed.sql
