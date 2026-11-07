/**
 * Corrected minimal version of the debugging exercise.
 *
 * Compare this file with broken-server.js:
 *   1. PORT is configurable and EADDRINUSE is handled.
 *   2. `open` is imported from the correct package (`sqlite`).
 *   3. The query uses the real table name (`book`).
 *   4. `db.all()` is awaited before the result is sent.
 *
 * The full Lab 3 application is ../server.js.
 */

const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;
const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "books.db");

let db = null;

const start = async () => {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  app.get("/books", async (req, res) => {
    // Correct table name and a real await.
    const books = await db.all("SELECT * FROM book;");
    res.json(books);
  });

  const server = app.listen(PORT, () => {
    console.log(`Fixed server is running at http://localhost:${PORT}/`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${PORT} is already in use. Stop the other process or set PORT to a free port.`
      );
      process.exit(1);
    }
    throw error;
  });
};

start();
