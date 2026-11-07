# Lab 3: REST API, query parameters, validation, debugging

**Name:** Uppari Varun Kumar
**Registration number:** 252U1R7094
**Section:** CSE (FSD)-2B
**Course:** Backend Development Fundamentals
**Faculty:** Joel Prashanth D
**Repository:** [varunkumaruppari/Backend_Development_Fundamentals-L1](https://github.com/varunkumaruppari/Backend_Development_Fundamentals-L1)
**Lab folder:** `lab-03/`

---

## Live link

**Not deployed.** No cloud hosting account or deployment credentials were available for this submission, so the API was run locally. The Postman/Newman screenshots below cover every endpoint, including the success and failure cases. The project is ready to deploy on Render, Railway or the NxtWave Cloud IDE by setting `PORT` and running `npm start`.

---

## Objective

Turn the Lab 2 CRUD routes into a clean REST API with:

- noun-based endpoints (`/books`) and HTTP methods for actions;
- search, sorting, pagination and price-range filtering through query parameters;
- request-body validation with clear `400` responses;
- correct status codes (`201` create, `200` read/update/delete, `404` missing record);
- a consistent `{ "message": "..." }` error format;
- a documented debugging exercise covering `EADDRINUSE`, a wrong import path, a table-name typo and a missing `await`.

---

## Technologies used

- **Runtime:** Node.js (v20+)
- **Framework:** Express.js (v5)
- **Database:** SQLite 3
- **Drivers:** `sqlite` (promise wrapper) and `sqlite3` (native driver)
- **Development:** Nodemon
- **API testing:** Postman collection + Newman (Postman CLI) + a native Node test suite
- **Version control:** Git and GitHub

---

## Project structure

```text
lab-03/
├── database/
│   ├── schema.sql              # book table definition
│   ├── seed.sql                # 15 sample books
│   └── setup.sql               # combined setup script for the SQLite CLI
├── debugging/
│   ├── broken-server.js        # intentionally broken version (4 bugs)
│   ├── fixed-server.js         # corrected minimal version
│   └── DEBUGGING.md            # symptom, cause and fix for every bug
├── screenshots/
│   ├── 01-postman-summary.png
│   ├── 02-postman-test-list.png
│   ├── 03-get-books-defaults.png
│   ├── ...
│   └── 19-npm-test-output.png
├── books.db                    # SQLite database (15 seeded rows)
├── package.json
├── package-lock.json
├── postman_collection.json     # importable Postman Collection v2.1 (31 requests)
├── server.js                   # Express server and all route handlers
├── test_api.js                 # self-contained 38-case API test suite
└── README.md
```

`node_modules/` and `.env` are excluded by the repository's root `.gitignore`.

---

## Database schema

The table is named `book` (singular). The same name is used in every query.

```sql
CREATE TABLE IF NOT EXISTS book (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  price REAL NOT NULL CHECK (price >= 0),
  pages INTEGER NOT NULL DEFAULT 0
);
```

The server creates the table automatically and seeds 15 books when the table is empty. The database can also be created manually:

```bash
cd lab-03
sqlite3 books.db < database/setup.sql
```

---

## How to run

### Prerequisites

- Node.js 20 or newer
- npm

### Install and start

```bash
cd lab-03
npm install
npm start
```

The terminal prints:

```text
Connected to SQLite database at: .../lab-03/books.db
Server is running at http://localhost:3000/
```

### Available commands

| Command | Action |
|---|---|
| `npm start` | Start the server with `node server.js` |
| `npm run dev` | Start with Nodemon (restarts on file changes) |
| `npm test` | Run the 38-case automated API test suite |
| `npx newman run postman_collection.json` | Run the Postman collection from the command line |

### Environment variables

No real values are committed. Both variables are optional.

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | HTTP port the server listens on |
| `DB_PATH` | No | `./books.db` | Path to the SQLite database file |

Example (PowerShell):

```powershell
$env:PORT = "3001"
$env:DB_PATH = "C:\path\to\books.db"
npm start
```

Never commit a `.env` file. The repository's `.gitignore` already excludes `.env` and `node_modules/`.

---

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | API overview with the student details and endpoint list. |
| `GET` | `/books` | List books with search, sorting, pagination and price filtering. |
| `GET` | `/books/:id` | Read one book by its numeric id. |
| `POST` | `/books` | Create a book after validating `title`, `author` and `price`. |
| `PUT` | `/books/:id` | Replace an existing book after validating the body. |
| `DELETE` | `/books/:id` | Delete a book by its numeric id. |

### Query parameters for `GET /books`

Every parameter is optional and has a default. Invalid values return `400` with a `{ message }` body.

| Parameter | Default | Validation | Description |
|---|---|---|---|
| `search_q` | `""` | string | Partial, case-insensitive title match using `LIKE '%value%'`. |
| `order_by` | `id` | `id`, `title`, `author`, `price`, `pages` | Column used for sorting. The value is whitelisted, never interpolated raw. |
| `order` | `ASC` | `ASC` or `DESC` | Sort direction. |
| `limit` | `10` | integer `1..100` | Maximum number of rows returned. |
| `offset` | `0` | integer `>= 0` | Number of rows to skip. |
| `min_price` | none | number `>= 0` | Lower bound for `price` (inclusive). |
| `max_price` | none | number `>= 0` | Upper bound for `price` (inclusive). `min_price` must not exceed it. |

### Status codes

| Code | When it is returned |
|---|---|
| `200 OK` | List, read, update or delete succeeded. |
| `201 Created` | A new book was created. |
| `400 Bad Request` | Invalid query parameter, invalid id, missing/invalid body field, or malformed JSON. |
| `404 Not Found` | The book id does not exist, or the route does not exist. |
| `500 Internal Server Error` | An unexpected database or server error. |

### Response format

Success:

```json
{
  "message": "Books retrieved successfully.",
  "count": 3,
  "total": 3,
  "limit": 10,
  "offset": 0,
  "data": []
}
```

Validation error:

```json
{
  "message": "Validation failed. Please correct the highlighted fields.",
  "errors": [
    "title is required and must be a non-empty string.",
    "price must be a valid number (for example 499 or 499.50)."
  ]
}
```

Not found:

```json
{
  "message": "Book with id 9999 was not found."
}
```

---

## Example requests

### Search, sort, filter and paginate

```bash
curl "http://localhost:3000/books?search_q=the&order_by=price&order=DESC&limit=3&offset=0"
curl "http://localhost:3000/books?min_price=500&max_price=800"
curl "http://localhost:3000/books?limit=5&offset=5"
```

### Read one book

```bash
curl "http://localhost:3000/books/1"
```

### Create a book

```bash
curl -X POST "http://localhost:3000/books" \
  -H "Content-Type: application/json" \
  -d '{"title":"The Testing Book","author":"Lab Student","price":499,"pages":220}'
```

Expected: `201 Created`.

### Update a book

```bash
curl -X PUT "http://localhost:3000/books/16" \
  -H "Content-Type: application/json" \
  -d '{"title":"The Testing Book - Updated","author":"Lab Student","price":599,"pages":240}'
```

Expected: `200 OK`.

### Delete a book

```bash
curl -X DELETE "http://localhost:3000/books/16"
```

Expected: `200 OK`.

### Failure examples

```bash
# 400: missing title
curl -X POST "http://localhost:3000/books" \
  -H "Content-Type: application/json" \
  -d '{"author":"Lab Student","price":100}'

# 400: non-numeric price
curl -X POST "http://localhost:3000/books" \
  -H "Content-Type: application/json" \
  -d '{"title":"Bad Price","author":"Lab Student","price":"abc"}'

# 400: invalid query parameter
curl "http://localhost:3000/books?limit=abc"

# 404: missing record
curl "http://localhost:3000/books/9999"
```

---

## Postman test list

Import [`postman_collection.json`](./postman_collection.json) into Postman. The collection uses a `baseUrl` variable (default `http://localhost:3000`) and contains **31 requests** in three folders with **69 assertions**.

| # | Method | Path | Case | Expected |
|---|---|---|---|---|
| 1 | GET | `/` | API overview | 200 |
| 2 | GET | `/books` | Defaults: `limit=10`, `offset=0`, `order_by=id`, `order=ASC` | 200 |
| 3 | GET | `/books?search_q=the` | Partial title match | 200 |
| 4 | GET | `/books?order_by=price&order=DESC&limit=3` | Sort by price descending | 200 |
| 5 | GET | `/books?min_price=500&max_price=800` | Price-range filter | 200 |
| 6 | GET | `/books?limit=5&offset=5` | Pagination, second page | 200 |
| 7 | GET | `/books/1` | Read one book | 200 |
| 8 | GET | `/books/9999` | Missing record | 404 |
| 9 | GET | `/books/abc` | Non-numeric id | 400 |
| 10 | POST | `/books` | Valid body | 201 |
| 11 | GET | `/books/{{createdBookId}}` | Read the created book | 200 |
| 12 | PUT | `/books/{{createdBookId}}` | Valid update | 200 |
| 13 | GET | `/books/{{createdBookId}}` | Verify the update persisted | 200 |
| 14 | PUT | `/books/9999` | Update a missing record | 404 |
| 15 | DELETE | `/books/{{createdBookId}}` | Delete the created book | 200 |
| 16 | GET | `/books/{{createdBookId}}` | Read after delete | 404 |
| 17 | DELETE | `/books/9999` | Delete a missing record | 404 |
| 18 | POST | `/books` | Missing `title` | 400 |
| 19 | POST | `/books` | Missing `author` | 400 |
| 20 | POST | `/books` | Non-numeric `price` | 400 |
| 21 | POST | `/books` | Negative `price` | 400 |
| 22 | POST | `/books` | Empty body (multiple errors) | 400 |
| 23 | GET | `/books?limit=abc` | `limit` is not an integer | 400 |
| 24 | GET | `/books?limit=0` | `limit` below the minimum | 400 |
| 25 | GET | `/books?offset=-1` | Negative `offset` | 400 |
| 26 | GET | `/books?order_by=password` | Column is not whitelisted | 400 |
| 27 | GET | `/books?order=sideways` | Direction is not `ASC`/`DESC` | 400 |
| 28 | GET | `/books?min_price=900&max_price=100` | `min_price > max_price` | 400 |
| 29 | DELETE | `/books/abc` | Non-numeric id | 400 |
| 30 | GET | `/not-a-real-route` | Unknown route | 404 |
| 31 | POST | `/books` | Malformed JSON body | 400 |

Run the whole collection without opening Postman:

```bash
npx newman run postman_collection.json
```

The run used for the screenshots finished with **31/31 requests and 69/69 assertions passing**.

> The screenshots show `http://localhost:3200` because the Newman run used a separate test port to avoid clashing with another local server. The collection's `baseUrl` variable defaults to `http://localhost:3000`, so importing it and running `npm start` works without changes.

> The Postman desktop GUI was not available in the environment used to prepare this submission, so the collection was executed with **Newman**, Postman's official command-line runner. The screenshots below are from Newman's HTML report and show the real request method, URL, status code, request body and response body for each case.

---

## Screenshots

### Postman / Newman summary and test list

![Newman summary: 31 requests, 69 assertions, 0 failed](screenshots/01-postman-summary.png)

![Postman test list: 9 read requests, 8 create/update/delete requests, 14 validation requests](screenshots/02-postman-test-list.png)

### Read, search, sort, filter and paginate

![GET / - API overview](screenshots/20-get-api-overview.png)

![GET /books with default query values](screenshots/03-get-books-defaults.png)

![GET /books?search_q=the - partial title match](screenshots/04-get-books-search.png)

![GET /books?order_by=price&order=DESC - sort by price](screenshots/05-get-books-sort.png)

![GET /books?min_price=500&max_price=800 - price range](screenshots/06-get-books-price-filter.png)

![GET /books?limit=5&offset=5 - pagination](screenshots/07-get-books-pagination.png)

![GET /books/1 - one book](screenshots/08-get-book-by-id.png)

### Create, update and delete

![POST /books - 201 Created](screenshots/09-post-book-201.png)

![PUT /books/16 - 200 OK](screenshots/14-put-book-200.png)

![DELETE /books/16 - 200 OK](screenshots/15-delete-book-200.png)

### Validation and error cases

![POST /books without a title - 400 Bad Request](screenshots/10-post-validation-title.png)

![POST /books with a non-numeric price - 400 Bad Request](screenshots/11-post-validation-price.png)

![GET /books/9999 - 404 Not Found](screenshots/12-get-book-404.png)

![GET /books/abc - 400 Bad Request](screenshots/13-get-book-invalid-id.png)

![POST /books with malformed JSON - 400 Bad Request](screenshots/16-malformed-json-400.png)

![Unknown route - 404 Not Found](screenshots/17-unknown-route-404.png)

### Database view

![SQLite table book with 15 seeded rows](screenshots/18-database-view.png)

### Automated test suite

![npm test - 38 tests passed, 0 failed](screenshots/19-npm-test-output.png)

---

## Debugging exercise

The faculty supplied a broken version of the project. The intentionally broken file is [`debugging/broken-server.js`](./debugging/broken-server.js); the corrected minimal version is [`debugging/fixed-server.js`](./debugging/fixed-server.js); the full corrected application is [`server.js`](./server.js). Full notes are in [`debugging/DEBUGGING.md`](./debugging/DEBUGGING.md).

| # | Bug | Symptom | Fix |
|---|---|---|---|
| 1 | Port conflict | `Error: listen EADDRINUSE: address already in use :::3000` | Stop the old process, run with a different `PORT`, or free the port. The fixed app also handles `server.on("error")` and prints a clear message. |
| 2 | Wrong import path | `TypeError: open is not a function` | Import `open` from `sqlite`, not `sqlite3`: `const { open } = require("sqlite");`. |
| 3 | Table-name typo | `SQLITE_ERROR: no such table: books` | Use the real table name everywhere: `SELECT * FROM book;`. |
| 4 | Missing `await` | `GET /books` returns `200 {}` instead of rows | `const books = await db.all("SELECT * FROM book;");`. |

The corrected server also uses parameterised queries (`?` placeholders) for every value and whitelists `order_by`/`order`, so user input is never joined into SQL.

---

## Notes: problems faced and how they were solved

1. **SQL injection through sorting.** `ORDER BY` cannot use a `?` placeholder for a column name. The solution was to map the incoming `order_by` value through a whitelist (`id`, `title`, `author`, `price`, `pages`) and only insert the mapped column name into the SQL string. `order` is restricted to `ASC`/`DESC`. All values still use `?` placeholders.
2. **`sqlite3` versus `sqlite`.** `open()` comes from the `sqlite` package, while `sqlite3.Database` is the driver. Importing `open` from `sqlite3` gives `TypeError: open is not a function`. This is one of the four debugging-exercise bugs.
3. **Missing `await`.** `db.all()` returns a Promise. Sending it with `res.json()` produces `{}` instead of the rows. Every database call is awaited before the response is sent.
4. **Port conflict.** Running `npm start` twice produces `EADDRINUSE`. The port is configurable with `PORT`, and `server.on("error")` turns the raw stack trace into a clear message.
5. **Table-name typo.** The schema creates `book`, so a query that uses `books` fails with `no such table: books`. The table name is kept consistent across the schema, seed script and all queries.
6. **Deterministic automated tests.** `npm test` starts its own server on port `3100` with a throw-away `test-books.db`, waits for readiness, runs 38 cases, then shuts the server down and removes the test database. This avoids depending on a manually started server or an existing database.
7. **Malformed JSON.** Express's JSON parser throws a `SyntaxError` before the route runs. A central error handler converts it into `400 { "message": "Invalid JSON body..." }` instead of leaking an HTML error page.
8. **Postman screenshots without the Postman GUI.** The collection was executed with Newman, Postman's official CLI. Its HTML report was used for the screenshots, so each image shows the real method, URL, status and response body.

---

## Viva questions (short answers)

**Query parameter vs path parameter?**
A path parameter identifies a resource (`/books/1` - book id 1). A query parameter modifies how a collection is returned (`/books?search_q=the&limit=5` - search and paginate the list).

**What does stateless mean?**
Each HTTP request contains all the information the server needs to process it. The server does not keep client session state between requests; state lives in the database, not in a particular server process.

**Which status code for bad input vs a missing record?**
Bad input (missing field, wrong type, invalid query value) is `400 Bad Request`. A valid request for a record that does not exist is `404 Not Found`.

---

## Rules for all labs - compliance

- `.env` is not committed; only optional environment-variable names and defaults are documented.
- `node_modules/` is not committed; it is excluded by `.gitignore`.
- No passwords are stored or logged (the lab does not use authentication).
- Every route returns the correct status code.
- All SQL values use parameterised `?` placeholders; sort columns are whitelisted.
- The code, tests and documentation were written for this lab.
