# Lab 3: REST API, query parameters, validation, debugging

**Uppari Varun Kumar** · Registration number **252U1R7094** · Section **CSE (FSD)-2B**

**Live link:** https://bdf-lab-03-varun.vercel.app/

Course: Backend Development Fundamentals — Year II Term II — Aurora
Faculty: Joel Prashanth D

> The live server stores its database in `/tmp`, the only writable folder on Vercel. Creating, updating and deleting books works, but the data returns to the 10 starting rows when the server restarts.

## Objective

Turn the Lab 2 CRUD routes into a clean REST API: nouns in the paths, HTTP methods for the actions, search, sorting, pagination and price filters in `GET /books/`, strict validation of input, the correct status code for every case, and one consistent JSON shape for every response.

## Technologies used

- Node.js (v18 or later)
- Express.js 4
- SQLite (`sqlite` and `sqlite3` packages)
- nodemon (development only)
- Postman
- SQLite command-line shell

## Project structure

```text
lab-03/
├── api/
│   └── index.js                  # Vercel entry point (imports the Express app)
├── screenshots/
│   ├── bad-query-param.png
│   ├── db-after.png
│   ├── db-before.png
│   ├── delete.png
│   ├── errors-404.png
│   ├── get-all.png
│   ├── get-one.png
│   ├── invalid-id.png
│   ├── post-bad-price.png
│   ├── post-missing-author.png
│   ├── post.png
│   ├── put.png
│   ├── query-filter-sort.png
│   ├── query-pagination.png
│   ├── query-price-filter.png
│   └── query-search.png
├── .gitignore
├── books.db                      # SQLite database file (10 starting rows)
├── init.sql                      # Table definition and the 10 rows
├── package.json
├── package-lock.json
├── postman_collection.json       # 14 success and failure requests
├── seed.js                       # Rebuilds books.db from init.sql
├── server.js                     # Express server with the API routes
├── vercel.json                   # Sends all requests to api/index.js
└── README.md
```

## How to run

Open a terminal in this `lab-03` folder:

```bash
npm install
npm run dev
```

`npm run dev` starts the server with nodemon. The terminal prints:

```text
Server running on port 3000
```

Use `npm start` to run it with plain Node. The API is then at `http://localhost:3000`.

### Database

`books.db` is committed, so the project works straight after cloning. To rebuild it:

```bash
sqlite3 books.db < init.sql
```

or, without the SQLite CLI:

```bash
npm run seed
npm run seed -- --reset
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Port the server listens on. Falls back to `3000` when it is not set. |

No database password, API key or `.env` file is used in this lab.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/` | Lists the available endpoints. |
| GET | `/books/` | Returns books, with optional search, filter, sort and pagination. |
| GET | `/books/:bookId/` | Returns one book by id. |
| POST | `/books/` | Creates a book and returns 201 with the new id. |
| PUT | `/books/:bookId/` | Replaces the details of an existing book. |
| DELETE | `/books/:bookId/` | Deletes a book. |

## Query parameters for `GET /books/`

| Parameter | Default | Description |
|---|---|---|
| `search_q` | empty | Partial, case-insensitive match on the title using `LIKE`. |
| `order_by` | `id` | Column to sort by: `id`, `title`, `author`, `price` or `pages`. |
| `order` | `ASC` | Sort direction: `ASC` or `DESC`. |
| `limit` | `10` | Maximum number of rows returned. |
| `offset` | `0` | Number of rows skipped, used with `limit` for pages. |
| `min_price` | `0` | Smallest price to include. |
| `max_price` | `1000000` | Largest price to include. |

Examples:

```text
/books/?search_q=habit
/books/?min_price=300&max_price=400&order_by=price&order=DESC
/books/?limit=2&offset=8
```

`order_by` is checked against a fixed list of column names, because a column name cannot be passed as a `?` placeholder. Every value that comes from the user is still sent as a placeholder.

## Status codes and error messages

Every error uses the same shape: `{ "message": "..." }`.

| Case | Status | Example message |
|---|---|---|
| Invalid `bookId` (not a positive whole number) | 400 | `Book id must be a positive whole number` |
| Missing or empty `title` | 400 | `title is required` |
| Missing or empty `author` | 400 | `author is required` |
| `price` not a number, or negative | 400 | `price must be a number` |
| `pages` missing, zero or negative | 400 | `pages must be a positive number` |
| Bad `order_by`, `order`, `limit`, `offset`, `min_price` or `max_price` | 400 | `order must be ASC or DESC` |
| `min_price` greater than `max_price` | 400 | `min_price cannot be greater than max_price` |
| Body is not valid JSON | 400 | `Request body must be valid JSON` |
| Book does not exist | 404 | `Book not found` |
| Unknown route | 404 | `Route not found` |
| Successful create | 201 | `Book added successfully` |
| Successful update or delete | 200 | `Book updated successfully` |

## Debugging exercise

The four faults in the broken version handed out for this lab, and the fix that is present in this project:

| Symptom | Cause | Fix |
|---|---|---|
| `Error: listen EADDRINUSE :::3000` on start | Another process (usually the previous server or the `http` server from Lab 1) was still holding port 3000. | Stop the running server, or start on a free port with `PORT=3001 npm start`. The server already reads `process.env.PORT`. |
| `Error: Cannot find module './routes/books'` | The import path did not match the file layout. | Use the correct relative path (`./server` from `api/index.js`), and keep one entry file. |
| `SQLITE_ERROR: no such table: books` | The query used `books` while the table is created as `book`. | Table name in every query matches the `CREATE TABLE book` statement. |
| Response body is empty or `undefined` in the handler | The database call was used without `await`, so the promise was read instead of the rows. | `await` every `db.all()`, `db.get()` and `db.run()` call before using its result. |

## Testing

All 14 cases are in `postman_collection.json`: import it into Postman and press Send on each request. The collection variable `baseUrl` is set to `http://localhost:3000`.

| # | Request | Expected |
|---|---|---|
| 01 | `GET /books/` | 200, first 10 books |
| 02 | `GET /books/?search_q=habit` | 200, only titles containing "habit" |
| 03 | `GET /books/?min_price=300&max_price=400` | 200, four books in the range |
| 04 | `GET /books/?order_by=price&order=DESC&limit=3` | 200, three most expensive first |
| 05 | `GET /books/?limit=2&offset=8` | 200, the last two rows |
| 06 | `GET /books/1/` | 200, one book |
| 07 | `POST /books/` valid body | 201, new id |
| 08 | `POST /books/` without `author` | 400, `author is required` |
| 09 | `POST /books/` with `"price": "free"` | 400, `price must be a number` |
| 10 | `PUT /books/1/` valid body | 200, updated |
| 11 | `DELETE /books/10/` | 200, deleted |
| 12 | `GET /books/999/` | 404, `Book not found` |
| 13 | `GET /books/abc/` | 400, invalid id |
| 14 | `GET /books/?order_by=price;DROP%20TABLE%20book` | 400, `order_by must be one of ...` |

## Screenshots

Every request below was sent from Postman to the running server, using the requests in `postman_collection.json`. The Postman workspace is named **varun**.

### Database before testing

Table structure and the 10 starting rows.

![Database before testing](./screenshots/db-before.png)

### GET /books/ — default query

Returns the first 10 books with status 200.

![GET all books](./screenshots/get-all.png)

### Search — `?search_q=habit`

Partial title match with `LIKE`; only titles containing "habit" come back.

![Search by title](./screenshots/query-search.png)

### Price filter — `?min_price=300&max_price=400`

Returns only books priced between 300 and 400.

![Price filter](./screenshots/query-price-filter.png)

### Sort — `?order_by=price&order=DESC&limit=3`

The three most expensive books, highest first.

![Sort by price](./screenshots/query-filter-sort.png)

### Pagination — `?limit=2&offset=8`

Skips the first eight rows and returns two.

![Pagination](./screenshots/query-pagination.png)

### GET /books/1/ — one book

Returns a single book with status 200.

![GET one book](./screenshots/get-one.png)

### POST /books/ — create

Request body and the 201 response with the new book id.

![POST add book](./screenshots/post.png)

### POST /books/ — missing author

Returns 400 with `author is required`.

![POST missing author](./screenshots/post-missing-author.png)

### POST /books/ — price is not a number

A string in `price` is rejected with 400 and `price must be a number`.

![POST bad price](./screenshots/post-bad-price.png)

### PUT /books/1/ — update

Request body and the 200 response after replacing the fields.

![PUT update book](./screenshots/put.png)

### DELETE /books/10/ — delete

Returns 200 after removing the row.

![DELETE book](./screenshots/delete.png)

### GET /books/abc/ — invalid id

A non-numeric id returns 400, not 404.

![Invalid id](./screenshots/invalid-id.png)

### GET /books/ — bad query parameter

An `order_by` value that is not a column name returns 400.

![Bad query parameter](./screenshots/bad-query-param.png)

### GET /books/999/ — not found

A missing book returns 404 with the same JSON shape.

![Not found](./screenshots/errors-404.png)

### Database after testing

Row 1 is updated, row 10 is deleted and the book created with POST has id 11.

![Database after testing](./screenshots/db-after.png)

## Notes: problems faced and how they were solved

1. **SQL injection through sorting.** A column name cannot be a `?` placeholder, so `order_by` is checked against the fixed list `id`, `title`, `author`, `price`, `pages`. The direction is limited to `ASC`/`DESC`. All values still use placeholders.
2. **`sqlite` versus `sqlite3`.** `open()` comes from the `sqlite` package, while `sqlite3.Database` is the driver. Importing `open` from `sqlite3` gives `TypeError: open is not a function`; this is one of the debugging-exercise bugs.
3. **Missing `await`.** `db.all()`, `db.get()` and `db.run()` return promises. Without `await`, the response body is empty or the row count is wrong. Every database call is awaited before the result is used.
4. **Port conflict.** Running the server twice produces `EADDRINUSE`. The port is configurable with `PORT`, and the README explains how to free the port or use another one.
5. **Table-name typo.** The schema creates `book`, so a query using `books` fails with `no such table: books`. The table name is consistent in every query.
6. **Vercel read-only filesystem.** Vercel only allows writes in `/tmp`. `server.js` copies the committed `books.db` to `/tmp/books.db` on the first request, so create/update/delete work. The data resets when the function restarts.
7. **Postman screenshots.** The collection was imported into Postman and every request was sent from the Postman desktop app. The screenshots show the request, the status code and the response body.

## Viva questions (short answers)

**Query parameter vs path parameter?**
A path parameter identifies a resource (`/books/1/` — book id 1). A query parameter modifies how a collection is returned (`/books/?search_q=habit&limit=5` — search and paginate the list).

**What does stateless mean?**
Each HTTP request contains all the information the server needs. The server does not keep client session state between requests; state lives in the database.

**Which status code for bad input vs a missing record?**
Bad input is `400 Bad Request`. A valid request for a record that does not exist is `404 Not Found`.

## Rules for all labs — compliance

- `.env` is not committed; only the optional `PORT` variable is documented.
- `node_modules/` is not committed; it is excluded by `.gitignore`.
- No passwords are stored or logged (the lab does not use authentication).
- Every route returns the correct status code.
- All SQL values use parameterised `?` placeholders; sort columns are whitelisted.
- The code, tests and documentation were written for this lab.
