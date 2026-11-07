/**
 * Lab 3: REST API, Query Parameters, Validation and Debugging
 * Student: Uppari Varun Kumar
 * Registration Number: 252U1R7094
 * Section: CSE (FSD)-2B
 *
 * Technologies: Node.js, Express.js, SQLite (sqlite & sqlite3), Nodemon
 *
 * Endpoints are named as nouns (/books). The HTTP method expresses the action:
 *   GET    /books        -> list / search / sort / filter books
 *   GET    /books/:id    -> read one book
 *   POST   /books        -> create a book
 *   PUT    /books/:id    -> replace a book
 *   DELETE /books/:id    -> delete a book
 */

const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();

// Parse JSON and URL-encoded request bodies.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration. Every value can be overridden with an environment variable.
const PORT = Number(process.env.PORT) || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "books.db");

// The database connection is created before the server starts listening.
let db = null;

// Only these columns may be used in ORDER BY. Never interpolate raw user input
// into SQL: the value is looked up in this whitelist first.
const ORDER_BY_COLUMNS = new Map([
  ["id", "id"],
  ["title", "title"],
  ["author", "author"],
  ["price", "price"],
  ["pages", "pages"],
]);

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

// ============================================================================
// Validation helpers
// ============================================================================

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

/**
 * Accepts a JSON number or a numeric string. Returns null when the value is
 * missing or cannot be converted to a finite number.
 */
const toFiniteNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/**
 * Parses an integer query parameter and applies a default when it is absent.
 * Returns { value } on success or { error } on failure.
 */
const parseIntegerQuery = (rawValue, name, options) => {
  const { defaultValue, min, max } = options;

  if (rawValue === undefined || rawValue === "") {
    return { value: defaultValue };
  }
  if (Array.isArray(rawValue)) {
    return { error: `${name} must be supplied only once.` };
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value)) {
    return { error: `${name} must be an integer.` };
  }
  if (value < min) {
    return { error: `${name} must be greater than or equal to ${min}.` };
  }
  if (max !== undefined && value > max) {
    return { error: `${name} must be less than or equal to ${max}.` };
  }
  return { value };
};

/**
 * Parses an optional non-negative price query parameter.
 * Returns { value } where value may be null when the parameter is absent.
 */
const parseOptionalPrice = (rawValue, name) => {
  if (rawValue === undefined || rawValue === "") {
    return { value: null };
  }
  if (Array.isArray(rawValue)) {
    return { error: `${name} must be supplied only once.` };
  }
  const value = toFiniteNumber(rawValue);
  if (value === null) {
    return { error: `${name} must be a valid number.` };
  }
  if (value < 0) {
    return { error: `${name} must be greater than or equal to 0.` };
  }
  return { value };
};

/**
 * Validates the body of POST /books and PUT /books/:id.
 * Returns { errors, values } so the caller can report every problem at once.
 */
const validateBookBody = (body) => {
  const errors = [];
  const source = body && typeof body === "object" ? body : {};

  const title = source.title;
  const author = source.author;
  const price = source.price;
  const pages = source.pages;

  if (!isNonEmptyString(title)) {
    errors.push("title is required and must be a non-empty string.");
  }

  if (!isNonEmptyString(author)) {
    errors.push("author is required and must be a non-empty string.");
  }

  const numericPrice = toFiniteNumber(price);
  if (price === undefined || price === null || price === "") {
    errors.push("price is required and must be a number.");
  } else if (numericPrice === null) {
    errors.push("price must be a valid number (for example 499 or 499.50).");
  } else if (numericPrice < 0) {
    errors.push("price must be greater than or equal to 0.");
  }

  // pages is optional in Lab 3; when omitted it defaults to 0. If supplied it
  // must be a non-negative integer.
  let numericPages = 0;
  if (pages !== undefined && pages !== null && pages !== "") {
    const parsedPages = toFiniteNumber(pages);
    if (parsedPages === null) {
      errors.push("pages must be a valid number.");
    } else if (!Number.isInteger(parsedPages)) {
      errors.push("pages must be a whole number.");
    } else if (parsedPages < 0) {
      errors.push("pages must be greater than or equal to 0.");
    } else {
      numericPages = parsedPages;
    }
  }

  return {
    errors,
    values: {
      title: isNonEmptyString(title) ? title.trim() : null,
      author: isNonEmptyString(author) ? author.trim() : null,
      price: numericPrice,
      pages: numericPages,
    },
  };
};

/**
 * Parses and validates the :bookId path parameter.
 */
const parseBookId = (rawId) => {
  const value = Number(rawId);
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
};

// ============================================================================
// Database initialisation
// ============================================================================

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS book (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    price REAL NOT NULL CHECK (price >= 0),
    pages INTEGER NOT NULL DEFAULT 0
  );
`;

const SEED_SQL = `
  INSERT INTO book (title, author, price, pages) VALUES
  ('The Great Gatsby', 'F. Scott Fitzgerald', 399, 180),
  ('To Kill a Mockingbird', 'Harper Lee', 499, 324),
  ('1984', 'George Orwell', 299, 328),
  ('Pride and Prejudice', 'Jane Austen', 249, 279),
  ('The Hobbit', 'J.R.R. Tolkien', 599, 310),
  ('The Catcher in the Rye', 'J.D. Salinger', 350, 234),
  ('Crime and Punishment', 'Fyodor Dostoevsky', 450, 671),
  ('Clean Code', 'Robert C. Martin', 899, 464),
  ('The Pragmatic Programmer', 'David Thomas, Andrew Hunt', 950, 352),
  ('Introduction to Algorithms', 'Thomas H. Cormen', 1499, 1312),
  ('Atomic Habits', 'James Clear', 550, 320),
  ('Deep Work', 'Cal Newport', 650, 296),
  ('The Alchemist', 'Paulo Coelho', 299, 208),
  ('Sapiens', 'Yuval Noah Harari', 799, 498),
  ('Thinking, Fast and Slow', 'Daniel Kahneman', 720, 499);
`;

/**
 * Opens SQLite, creates the table if needed, seeds it when empty, then starts
 * Express. Keeping the listen call after the awaits avoids requests hitting an
 * uninitialised database (a common "missing await" bug).
 */
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    });

    await db.exec(SCHEMA_SQL);

    const countResult = await db.get("SELECT COUNT(*) AS total FROM book;");
    if (countResult.total === 0) {
      await db.exec(SEED_SQL);
      console.log("Seeded 15 sample books.");
    }

    const server = app.listen(PORT, () => {
      console.log(`Connected to SQLite database at: ${DB_PATH}`);
      console.log(`Server is running at http://localhost:${PORT}/`);
    });

    // A clear message is much easier to debug than an unhandled EADDRINUSE
    // stack trace.
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(
          `Port ${PORT} is already in use. Stop the other process or run with PORT=<free-port> npm start.`
        );
      } else {
        console.error("Server error:", error.message);
      }
      process.exit(1);
    });

    return server;
  } catch (error) {
    console.error("Database connection or initialisation error:", error.message);
    process.exit(1);
  }
};

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /
 * Small discovery endpoint so a reviewer can see the available routes.
 */
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Bookstore REST API - Lab 3",
    student: {
      name: "Uppari Varun Kumar",
      registrationNumber: "252U1R7094",
      section: "CSE (FSD)-2B",
    },
    endpoints: [
      {
        method: "GET",
        path: "/books",
        description:
          "List books with search_q, order_by, order, limit, offset, min_price and max_price.",
      },
      { method: "GET", path: "/books/:id", description: "Get one book by id." },
      { method: "POST", path: "/books", description: "Create a book." },
      { method: "PUT", path: "/books/:id", description: "Replace a book." },
      { method: "DELETE", path: "/books/:id", description: "Delete a book." },
    ],
  });
});

/**
 * GET /books
 *
 * Query parameters (all optional, all with defaults):
 *   search_q   partial title match, default ""
 *   order_by   id | title | author | price | pages, default "id"
 *   order      ASC | DESC, default "ASC"
 *   limit      integer 1..100, default 10
 *   offset     integer >= 0, default 0
 *   min_price  number >= 0, no default
 *   max_price  number >= 0, no default
 */
app.get(["/books", "/books/"], async (req, res) => {
  // --- search_q -----------------------------------------------------------
  if (Array.isArray(req.query.search_q)) {
    return res
      .status(400)
      .json({ message: "search_q must be supplied only once." });
  }
  const searchQ =
    typeof req.query.search_q === "string" ? req.query.search_q.trim() : "";

  // --- order_by -----------------------------------------------------------
  const orderByRaw =
    typeof req.query.order_by === "string"
      ? req.query.order_by.trim().toLowerCase()
      : "id";
  if (!ORDER_BY_COLUMNS.has(orderByRaw)) {
    return res.status(400).json({
      message:
        "Invalid order_by. Allowed values: id, title, author, price, pages.",
    });
  }
  const orderByColumn = ORDER_BY_COLUMNS.get(orderByRaw);

  // --- order --------------------------------------------------------------
  const orderRaw =
    typeof req.query.order === "string"
      ? req.query.order.trim().toUpperCase()
      : "ASC";
  if (orderRaw !== "ASC" && orderRaw !== "DESC") {
    return res
      .status(400)
      .json({ message: "Invalid order. Allowed values: ASC, DESC." });
  }

  // --- limit / offset -----------------------------------------------------
  const limitResult = parseIntegerQuery(req.query.limit, "limit", {
    defaultValue: DEFAULT_LIMIT,
    min: 1,
    max: MAX_LIMIT,
  });
  if (limitResult.error) {
    return res.status(400).json({ message: limitResult.error });
  }

  const offsetResult = parseIntegerQuery(req.query.offset, "offset", {
    defaultValue: 0,
    min: 0,
  });
  if (offsetResult.error) {
    return res.status(400).json({ message: offsetResult.error });
  }

  // --- min_price / max_price ---------------------------------------------
  const minPriceResult = parseOptionalPrice(req.query.min_price, "min_price");
  if (minPriceResult.error) {
    return res.status(400).json({ message: minPriceResult.error });
  }

  const maxPriceResult = parseOptionalPrice(req.query.max_price, "max_price");
  if (maxPriceResult.error) {
    return res.status(400).json({ message: maxPriceResult.error });
  }

  const minPrice = minPriceResult.value;
  const maxPrice = maxPriceResult.value;

  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    return res.status(400).json({
      message: "min_price cannot be greater than max_price.",
    });
  }

  try {
    // Values use ? placeholders. Only the whitelisted column name and the
    // ASC/DESC keyword are inserted into the SQL string.
    const conditions = ["title LIKE ?"];
    const params = [`%${searchQ}%`];

    if (minPrice !== null) {
      conditions.push("price >= ?");
      params.push(minPrice);
    }
    if (maxPrice !== null) {
      conditions.push("price <= ?");
      params.push(maxPrice);
    }

    const whereClause = conditions.join(" AND ");

    const countRow = await db.get(
      `SELECT COUNT(*) AS total FROM book WHERE ${whereClause};`,
      params
    );

    const books = await db.all(
      `SELECT * FROM book
       WHERE ${whereClause}
       ORDER BY ${orderByColumn} ${orderRaw}
       LIMIT ? OFFSET ?;`,
      [...params, limitResult.value, offsetResult.value]
    );

    return res.status(200).json({
      message: "Books retrieved successfully.",
      count: books.length,
      total: countRow.total,
      limit: limitResult.value,
      offset: offsetResult.value,
      data: books,
    });
  } catch (error) {
    console.error("Error retrieving books:", error.message);
    return res.status(500).json({ message: "Failed to retrieve books." });
  }
});

/**
 * GET /books/:id
 */
app.get(["/books/:bookId", "/books/:bookId/"], async (req, res) => {
  const bookId = parseBookId(req.params.bookId);
  if (bookId === null) {
    return res.status(400).json({
      message: "Invalid book id. The id must be a positive integer.",
    });
  }

  try {
    const book = await db.get("SELECT * FROM book WHERE id = ?;", [bookId]);
    if (!book) {
      return res
        .status(404)
        .json({ message: `Book with id ${bookId} was not found.` });
    }
    return res
      .status(200)
      .json({ message: "Book retrieved successfully.", data: book });
  } catch (error) {
    console.error(`Error retrieving book ${bookId}:`, error.message);
    return res.status(500).json({ message: "Failed to retrieve the book." });
  }
});

/**
 * POST /books
 */
app.post(["/books", "/books/"], async (req, res) => {
  const { errors, values } = validateBookBody(req.body);

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Validation failed. Please correct the highlighted fields.",
      errors,
    });
  }

  try {
    const result = await db.run(
      `INSERT INTO book (title, author, price, pages)
       VALUES (?, ?, ?, ?);`,
      [values.title, values.author, values.price, values.pages]
    );

    const createdBook = await db.get("SELECT * FROM book WHERE id = ?;", [
      result.lastID,
    ]);

    return res.status(201).json({
      message: "Book created successfully.",
      data: createdBook,
    });
  } catch (error) {
    console.error("Error creating book:", error.message);
    return res.status(500).json({ message: "Failed to create the book." });
  }
});

/**
 * PUT /books/:id
 */
app.put(["/books/:bookId", "/books/:bookId/"], async (req, res) => {
  const bookId = parseBookId(req.params.bookId);
  if (bookId === null) {
    return res.status(400).json({
      message: "Invalid book id. The id must be a positive integer.",
    });
  }

  const { errors, values } = validateBookBody(req.body);
  if (errors.length > 0) {
    return res.status(400).json({
      message: "Validation failed. Please correct the highlighted fields.",
      errors,
    });
  }

  try {
    const existingBook = await db.get("SELECT id FROM book WHERE id = ?;", [
      bookId,
    ]);
    if (!existingBook) {
      return res
        .status(404)
        .json({ message: `Book with id ${bookId} was not found.` });
    }

    await db.run(
      `UPDATE book
       SET title = ?, author = ?, price = ?, pages = ?
       WHERE id = ?;`,
      [values.title, values.author, values.price, values.pages, bookId]
    );

    const updatedBook = await db.get("SELECT * FROM book WHERE id = ?;", [
      bookId,
    ]);

    return res.status(200).json({
      message: "Book updated successfully.",
      data: updatedBook,
    });
  } catch (error) {
    console.error(`Error updating book ${bookId}:`, error.message);
    return res.status(500).json({ message: "Failed to update the book." });
  }
});

/**
 * DELETE /books/:id
 */
app.delete(["/books/:bookId", "/books/:bookId/"], async (req, res) => {
  const bookId = parseBookId(req.params.bookId);
  if (bookId === null) {
    return res.status(400).json({
      message: "Invalid book id. The id must be a positive integer.",
    });
  }

  try {
    const existingBook = await db.get("SELECT id FROM book WHERE id = ?;", [
      bookId,
    ]);
    if (!existingBook) {
      return res
        .status(404)
        .json({ message: `Book with id ${bookId} was not found.` });
    }

    await db.run("DELETE FROM book WHERE id = ?;", [bookId]);

    return res.status(200).json({
      message: "Book deleted successfully.",
      data: { id: bookId },
    });
  } catch (error) {
    console.error(`Error deleting book ${bookId}:`, error.message);
    return res.status(500).json({ message: "Failed to delete the book." });
  }
});

/**
 * Unknown routes return the same { message } error shape.
 */
app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

/**
 * Central error handler. It also converts malformed JSON into a 400 instead of
 * leaking an HTML stack trace to the client.
 */
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({
      message: "Invalid JSON body. Please send a valid JSON object.",
    });
  }

  console.error("Unhandled error:", error);
  return res.status(500).json({ message: "Internal server error." });
});

// ============================================================================
// Startup / shutdown
// ============================================================================

if (require.main === module) {
  initializeDBAndServer();
}

const shutdown = async () => {
  if (db) {
    try {
      await db.close();
    } catch (error) {
      // Ignore close errors during shutdown.
    }
  }
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

module.exports = { app, initializeDBAndServer };
