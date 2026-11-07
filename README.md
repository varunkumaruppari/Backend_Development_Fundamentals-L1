# Backend Development Fundamentals — Lab Reports

**Uppari Varun Kumar** · Registration number **252U1R7094** · Section **CSE (FSD)-2B**

Course: Backend Development Fundamentals — Year II Term II — Aurora
Faculty: Joel Prashanth D

One folder per lab. Each folder is a self-contained project with its own `README.md`, source code and screenshots.

## Labs

| Lab | Title | Topics | Folder |
|---|---|---|---|
| Lab 01 | Node.js and Express server | Node.js `http` module, Express routes, status codes, 404 handling | [`lab-01/`](./lab-01) |
| Lab 02 | SQLite database and CRUD routes | SQLite, parameterised queries, REST CRUD, status codes | [`lab-02/`](./lab-02) |
| Lab 03 | REST API, query parameters, validation | Search, sorting, pagination, price filters, validation, debugging | [`lab-03/`](./lab-03) |

## Running a lab

```bash
cd lab-03
npm install
npm run dev
```

Each lab's `README.md` documents its endpoints, environment variables and screenshots.

- Lab 01 live: https://backend-development-fundamentals-l1.onrender.com
- Lab 03 live: https://bdf-lab-03-varun.vercel.app

## Rules followed

- `node_modules` is never committed; every folder has a `.gitignore`.
- No `.env` file or real secret values are committed.
- Every route returns the correct HTTP status code.
- All database queries use `?` placeholders for user input.
