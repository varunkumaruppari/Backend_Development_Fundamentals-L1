# Lab 3 Debugging Exercise

The faculty supplied a broken version of the project. The intentionally broken
file is [`broken-server.js`](./broken-server.js); the corrected minimal version
is [`fixed-server.js`](./fixed-server.js). The full corrected application is
[`../server.js`](../server.js).

The four bugs are listed in the order they should be fixed. The first one
prevents the process from starting, so fix it before trying to observe the
others.

| # | Bug | Symptom | Root cause | Fix |
|---|---|---|---|---|
| 1 | Port conflict | `Error: listen EADDRINUSE: address already in use :::3000` | Another process (often an earlier `npm start`) is already listening on the port, and the app has no `error` handler. | Stop the old process (`Ctrl+C`), run on another port (`PORT=3001 npm start`), or free the port. Add a `server.on("error")` handler that explains the conflict. |
| 2 | Wrong import path | `TypeError: open is not a function` | `open` is exported by the `sqlite` package, but the file imports it from `sqlite3`. | Change `const { open } = require("sqlite3")` to `const { open } = require("sqlite")`. Keep `sqlite3` only for `sqlite3.Database`. |
| 3 | Table-name typo | `SQLITE_ERROR: no such table: books` | The schema creates `book` (singular), but the query reads `books` (plural). | Use the same name everywhere: `SELECT * FROM book;`. Verify with `SELECT name FROM sqlite_master WHERE type = 'table';`. |
| 4 | Missing `await` | `GET /books` returns `200 {}` instead of an array | `db.all()` returns a Promise. Without `await`, `res.json()` serialises the Promise object, which has no enumerable rows. | `const books = await db.all("SELECT * FROM book;");` |

## Reproducing the port conflict

```bash
# Terminal 1
npm start

# Terminal 2 - this produces EADDRINUSE
npm start

# Options:
#   Ctrl+C the first server, or
#   PORT=3001 npm start
# On Windows PowerShell:
#   $env:PORT=3001; npm start
```

The corrected application also handles the error explicitly:

```js
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use.`);
    process.exit(1);
  }
  throw error;
});
```

## Reproducing the wrong import

```js
// Broken
const { open } = require("sqlite3");

// Fixed
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
```

## Reproducing the table-name typo

```bash
sqlite3 books.db
sqlite> .tables
book
sqlite> SELECT * FROM books;
Error: no such table: books
sqlite> SELECT * FROM book;
```

The server should use `book` in every query, including the `COUNT(*)` query.

## Reproducing the missing await

```js
// Broken: books is a Promise, so the client receives {}
const books = db.all("SELECT * FROM book;");
res.json(books);

// Fixed: wait for the rows before sending them
const books = await db.all("SELECT * FROM book;");
res.json(books);
```

The same rule applies to `db.get()`, `db.run()` and `db.exec()`: every database
call is asynchronous and must be awaited.

## Verification

After fixing all four bugs, run:

```bash
node debugging/fixed-server.js
curl http://localhost:3000/books
```

The response should be a JSON array of books. The full application can then be
checked with `npm test` (38 automated cases) and `npm run test:postman`
(31 requests, 69 assertions).
