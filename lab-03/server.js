// Lab 3: REST API with query parameters, validation and consistent error messages.
// Run with: npm run dev   (nodemon, restarts on every change)
//           npm start     (plain node)
const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(express.json());

// Hosted platforms give the app a read-only filesystem, except for /tmp,
// so the database is copied there once and all writes go to that copy.
const isDeployed = Boolean(process.env.VERCEL);
const dbPath = isDeployed
  ? path.join("/tmp", "books.db")
  : path.join(__dirname, "books.db");

if (isDeployed && !fs.existsSync(dbPath)) {
  fs.copyFileSync(path.join(__dirname, "books.db"), dbPath);
}

let db = null;

// Opens the database first, and only starts listening once that worked.
const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS book (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        price INTEGER NOT NULL,
        pages INTEGER NOT NULL
      );
    `);

    const PORT = process.env.PORT || 3000;
    if (require.main === module) {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    }
  } catch (error) {
    console.error(`Database error: ${error.message}`);
    process.exit(1);
  }
};

// Only these columns may be used in ORDER BY. A column name cannot be passed
// as a ? placeholder, so a whitelist is the safe way to keep it out of SQL.
const ORDER_BY_COLUMNS = ["id", "title", "author", "price", "pages"];

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim() !== "";

const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

// Query parameters arrive as strings, so every numeric one is checked here.
const readWholeNumber = (value, name, fallback) => {
  if (value === undefined) return { value: fallback };
  if (!/^\d+$/.test(String(value))) {
    return { error: `${name} must be a whole number` };
  }
  return { value: Number(value) };
};

const readPrice = (value, name, fallback) => {
  if (value === undefined) return { value: fallback };
  if (!/^\d+(\.\d+)?$/.test(String(value))) {
    return { error: `${name} must be a number` };
  }
  return { value: Number(value) };
};

const validateBook = (body) => {
  if (!isNonEmptyString(body.title)) return "title is required";
  if (!isNonEmptyString(body.author)) return "author is required";
  if (!isNumber(body.price) || body.price < 0) return "price must be a number";
  if (!isNumber(body.pages) || body.pages <= 0) {
    return "pages must be a positive number";
  }
  return null;
};

// GET / -> quick description of the API
app.get("/", (request, response) => {
  response.status(200).json({
    message: "Book Store API is running",
    endpoints: [
      "GET /books/",
      "GET /books/:bookId/",
      "POST /books/",
      "PUT /books/:bookId/",
      "DELETE /books/:bookId/"
    ]
  });
});

// GET /books/ -> search, filter, sort and paginate the collection
app.get("/books/", async (request, response) => {
  const searchQ = request.query.search_q === undefined ? "" : String(request.query.search_q);

  const orderBy = String(request.query.order_by || "id").toLowerCase();
  if (!ORDER_BY_COLUMNS.includes(orderBy)) {
    return response.status(400).json({
      message: `order_by must be one of: ${ORDER_BY_COLUMNS.join(", ")}`
    });
  }

  const order = String(request.query.order || "ASC").toUpperCase();
  if (order !== "ASC" && order !== "DESC") {
    return response.status(400).json({ message: "order must be ASC or DESC" });
  }

  const limit = readWholeNumber(request.query.limit, "limit", 10);
  if (limit.error) {
    return response.status(400).json({ message: limit.error });
  }

  const offset = readWholeNumber(request.query.offset, "offset", 0);
  if (offset.error) {
    return response.status(400).json({ message: offset.error });
  }

  const minPrice = readPrice(request.query.min_price, "min_price", 0);
  if (minPrice.error) {
    return response.status(400).json({ message: minPrice.error });
  }

  const maxPrice = readPrice(request.query.max_price, "max_price", 1000000);
  if (maxPrice.error) {
    return response.status(400).json({ message: maxPrice.error });
  }

  if (minPrice.value > maxPrice.value) {
    return response.status(400).json({
      message: "min_price cannot be greater than max_price"
    });
  }

  try {
    const getBooksQuery = `
      SELECT *
      FROM book
      WHERE title LIKE ?
        AND price >= ?
        AND price <= ?
      ORDER BY ${orderBy} ${order}
      LIMIT ? OFFSET ?;
    `;

    const books = await db.all(getBooksQuery, [
      `%${searchQ}%`,
      minPrice.value,
      maxPrice.value,
      limit.value,
      offset.value
    ]);

    response.status(200).json(books);
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

// GET /books/:bookId/ -> one book
app.get("/books/:bookId/", async (request, response) => {
  const { bookId } = request.params;

  if (!/^\d+$/.test(bookId) || Number(bookId) <= 0) {
    return response.status(400).json({
      message: "Book id must be a positive whole number"
    });
  }

  try {
    const book = await db.get("SELECT * FROM book WHERE id = ?;", [bookId]);

    if (!book) {
      return response.status(404).json({ message: "Book not found" });
    }

    response.status(200).json(book);
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

// POST /books/ -> create a book
app.post("/books/", async (request, response) => {
  const invalid = validateBook(request.body);

  if (invalid) {
    return response.status(400).json({ message: invalid });
  }

  try {
    const { title, author, price, pages } = request.body;
    const result = await db.run(
      "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?);",
      [title, author, price, pages]
    );

    response.status(201).json({
      message: "Book added successfully",
      bookId: result.lastID
    });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

// PUT /books/:bookId/ -> replace the details of a book
app.put("/books/:bookId/", async (request, response) => {
  const { bookId } = request.params;

  if (!/^\d+$/.test(bookId) || Number(bookId) <= 0) {
    return response.status(400).json({
      message: "Book id must be a positive whole number"
    });
  }

  const invalid = validateBook(request.body);

  if (invalid) {
    return response.status(400).json({ message: invalid });
  }

  try {
    const existing = await db.get("SELECT * FROM book WHERE id = ?;", [bookId]);

    if (!existing) {
      return response.status(404).json({ message: "Book not found" });
    }

    const { title, author, price, pages } = request.body;
    await db.run(
      "UPDATE book SET title = ?, author = ?, price = ?, pages = ? WHERE id = ?;",
      [title, author, price, pages, bookId]
    );

    response.status(200).json({ message: "Book updated successfully" });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

// DELETE /books/:bookId/ -> remove a book
app.delete("/books/:bookId/", async (request, response) => {
  const { bookId } = request.params;

  if (!/^\d+$/.test(bookId) || Number(bookId) <= 0) {
    return response.status(400).json({
      message: "Book id must be a positive whole number"
    });
  }

  try {
    const existing = await db.get("SELECT * FROM book WHERE id = ?;", [bookId]);

    if (!existing) {
      return response.status(404).json({ message: "Book not found" });
    }

    await db.run("DELETE FROM book WHERE id = ?;", [bookId]);

    response.status(200).json({ message: "Book deleted successfully" });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

// Unknown route -> 404 with the same JSON shape as every other error
app.use((request, response) => {
  response.status(404).json({ message: "Route not found" });
});

// Malformed JSON in the request body -> 400 instead of an HTML page
app.use((error, request, response, next) => {
  if (error.type === "entity.parse.failed") {
    return response.status(400).json({ message: "Request body must be valid JSON" });
  }
  next(error);
});

initializeDBAndServer();

module.exports = app;
