/**
 * INTENTIONALLY BROKEN FILE - Lab 3 debugging exercise.
 *
 * This file contains four classic bugs. Read debugging/DEBUGGING.md, fix them
 * one at a time, and compare your result with debugging/fixed-server.js.
 *
 * Do not run this file as part of the normal application.
 */

const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");

// BUG 2 - wrong import path.
// `open` belongs to the `sqlite` package, not `sqlite3`. Running this gives:
//   TypeError: open is not a function
const { open } = require("sqlite3");

const app = express();
app.use(express.json());

// BUG 1 - fixed port with no EADDRINUSE handling.
// Starting a second copy gives:
//   Error: listen EADDRINUSE: address already in use :::3000
const PORT = 3000;
const dbPath = path.join(__dirname, "..", "books.db");

let db = null;

const start = async () => {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  app.get("/books", async (req, res) => {
    // BUG 3 - table-name typo: the schema creates `book`, not `books`.
    // BUG 4 - missing await: db.all() returns a Promise, so res.json(books)
    // serialises to `{}` instead of the rows.
    const books = db.all("SELECT * FROM books;");

    res.json(books);
  });

  // BUG 1 (continued) - no server.on("error") handler for EADDRINUSE.
  app.listen(PORT, () => {
    console.log(`Broken server is running at http://localhost:${PORT}/`);
  });
};

start();
