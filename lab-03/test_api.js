/**
 * Lab 3 automated API test suite.
 *
 * The script starts its own server on port 3100 with a throw-away SQLite file,
 * waits until it is ready, runs every success and failure case, then shuts the
 * server down and removes the test database. This means `npm test` works
 * without manually starting the server first.
 */

const assert = require("assert");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const TEST_PORT = 3100;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const TEST_DB_PATH = path.join(__dirname, "test-books.db");

let passed = 0;
let failed = 0;
const results = [];

const request = async (method, endpoint, body, headers = {}) => {
  const options = { method, headers: { ...headers } };

  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const text = await response.text();

  let json = null;
  try {
    json = text === "" ? null : JSON.parse(text);
  } catch (error) {
    json = text;
  }

  return { status: response.status, body: json };
};

const test = async (name, fn) => {
  try {
    await fn();
    passed += 1;
    results.push({ name, status: "PASS" });
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed += 1;
    results.push({ name, status: "FAIL", error: error.message });
    console.error(`FAIL  ${name}`);
    console.error(`      ${error.message}`);
  }
};

const waitForServer = async (timeoutMs = 15000) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/`);
      if (response.ok) {
        return;
      }
    } catch (error) {
      // The server is not listening yet; try again shortly.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Server did not start on ${BASE_URL} within ${timeoutMs}ms`);
};

const stopServer = (server) =>
  new Promise((resolve) => {
    if (!server || server.killed) {
      resolve();
      return;
    }
    server.once("exit", () => resolve());
    server.kill();
    setTimeout(resolve, 3000);
  });

const runTests = async () => {
  console.log("=== LAB 3 API TEST SUITE ===");
  console.log(`Base URL: ${BASE_URL}`);
  console.log("");

  // Start with a clean database so counts are deterministic.
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  const server = spawn(process.execPath, ["server.js"], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      DB_PATH: TEST_DB_PATH,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let serverOutput = "";
  server.stdout.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });

  try {
    await waitForServer();

    // ------------------------------------------------------------------
    // Read, search, sort, filter and pagination
    // ------------------------------------------------------------------
    await test("GET / returns 200 with the endpoint list", async () => {
      const response = await request("GET", "/");
      assert.strictEqual(response.status, 200);
      assert.ok(response.body.message);
      assert.ok(Array.isArray(response.body.endpoints));
    });

    await test("GET /books applies defaults (limit 10, offset 0, id ASC)", async () => {
      const response = await request("GET", "/books");
      assert.strictEqual(response.status, 200);
      assert.ok(Array.isArray(response.body.data));
      assert.strictEqual(response.body.data.length, 10);
      assert.strictEqual(response.body.total, 15);
      assert.strictEqual(response.body.limit, 10);
      assert.strictEqual(response.body.offset, 0);
      assert.deepStrictEqual(
        response.body.data.map((book) => book.id),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      );
    });

    await test("GET /books?limit=5&offset=5 returns the second page", async () => {
      const response = await request("GET", "/books?limit=5&offset=5");
      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(
        response.body.data.map((book) => book.id),
        [6, 7, 8, 9, 10]
      );
    });

    await test("GET /books?search_q=the does a partial title match", async () => {
      const response = await request("GET", "/books?search_q=the");
      assert.strictEqual(response.status, 200);
      assert.ok(response.body.count >= 5);
      for (const book of response.body.data) {
        assert.ok(book.title.toLowerCase().includes("the"));
      }
    });

    await test("GET /books?search_q=zzz returns an empty result set", async () => {
      const response = await request("GET", "/books?search_q=zzz");
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.count, 0);
      assert.strictEqual(response.body.total, 0);
      assert.deepStrictEqual(response.body.data, []);
    });

    await test("GET /books?order_by=price&order=DESC sorts by price", async () => {
      const response = await request(
        "GET",
        "/books?order_by=price&order=DESC&limit=3"
      );
      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(
        response.body.data.map((book) => book.price),
        [1499, 950, 899]
      );
    });

    await test("GET /books?order_by=title&order=ASC sorts by title", async () => {
      const response = await request(
        "GET",
        "/books?order_by=title&order=ASC&limit=3"
      );
      assert.strictEqual(response.status, 200);
      const titles = response.body.data.map((book) => book.title);
      const sortedTitles = [...titles].sort((a, b) => a.localeCompare(b));
      assert.deepStrictEqual(titles, sortedTitles);
    });

    await test("GET /books?min_price=500&max_price=800 filters the range", async () => {
      const response = await request(
        "GET",
        "/books?min_price=500&max_price=800"
      );
      assert.strictEqual(response.status, 200);
      assert.ok(response.body.count > 0);
      for (const book of response.body.data) {
        assert.ok(book.price >= 500 && book.price <= 800);
      }
    });

    await test("GET /books?min_price=500 keeps only books at or above 500", async () => {
      const response = await request("GET", "/books?min_price=500");
      assert.strictEqual(response.status, 200);
      for (const book of response.body.data) {
        assert.ok(book.price >= 500);
      }
    });

    await test("GET /books?max_price=300 keeps only books at or below 300", async () => {
      const response = await request("GET", "/books?max_price=300");
      assert.strictEqual(response.status, 200);
      for (const book of response.body.data) {
        assert.ok(book.price <= 300);
      }
    });

    await test("GET /books/1 returns 200 with one book", async () => {
      const response = await request("GET", "/books/1");
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.data.id, 1);
      assert.ok(response.body.data.title);
      assert.ok(response.body.data.author);
    });

    await test("GET /books/9999 returns 404", async () => {
      const response = await request("GET", "/books/9999");
      assert.strictEqual(response.status, 404);
      assert.ok(response.body.message.includes("not found"));
    });

    await test("GET /books/abc returns 400", async () => {
      const response = await request("GET", "/books/abc");
      assert.strictEqual(response.status, 400);
      assert.ok(response.body.message);
    });

    // ------------------------------------------------------------------
    // Query parameter validation
    // ------------------------------------------------------------------
    await test("GET /books?limit=abc returns 400", async () => {
      const response = await request("GET", "/books?limit=abc");
      assert.strictEqual(response.status, 400);
      assert.ok(response.body.message.includes("limit"));
    });

    await test("GET /books?limit=0 returns 400", async () => {
      const response = await request("GET", "/books?limit=0");
      assert.strictEqual(response.status, 400);
    });

    await test("GET /books?offset=-1 returns 400", async () => {
      const response = await request("GET", "/books?offset=-1");
      assert.strictEqual(response.status, 400);
    });

    await test("GET /books?order_by=password returns 400", async () => {
      const response = await request("GET", "/books?order_by=password");
      assert.strictEqual(response.status, 400);
      assert.ok(response.body.message.includes("order_by"));
    });

    await test("GET /books?order=sideways returns 400", async () => {
      const response = await request("GET", "/books?order=sideways");
      assert.strictEqual(response.status, 400);
      assert.ok(response.body.message.includes("order"));
    });

    await test("GET /books?min_price=900&max_price=100 returns 400", async () => {
      const response = await request(
        "GET",
        "/books?min_price=900&max_price=100"
      );
      assert.strictEqual(response.status, 400);
      assert.ok(response.body.message.includes("min_price"));
    });

    // ------------------------------------------------------------------
    // Create
    // ------------------------------------------------------------------
    let createdBookId = null;

    await test("POST /books with a valid body returns 201", async () => {
      const response = await request("POST", "/books", {
        title: "The Testing Book",
        author: "Lab Student",
        price: 123.5,
        pages: 100,
      });
      assert.strictEqual(response.status, 201);
      assert.ok(response.body.data.id);
      assert.strictEqual(response.body.data.title, "The Testing Book");
      createdBookId = response.body.data.id;
    });

    await test("GET the created book returns 200", async () => {
      const response = await request("GET", `/books/${createdBookId}`);
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.data.id, createdBookId);
    });

    await test("POST /books accepts a numeric string price", async () => {
      const response = await request("POST", "/books", {
        title: "String Price",
        author: "Lab Student",
        price: "250.75",
      });
      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.body.data.price, 250.75);
      assert.strictEqual(response.body.data.pages, 0);
      await request("DELETE", `/books/${response.body.data.id}`);
    });

    await test("POST /books rejects a missing title with 400", async () => {
      const response = await request("POST", "/books", {
        author: "Lab Student",
        price: 100,
      });
      assert.strictEqual(response.status, 400);
      assert.ok(response.body.errors.some((error) => error.includes("title")));
    });

    await test("POST /books rejects a missing author with 400", async () => {
      const response = await request("POST", "/books", {
        title: "No Author",
        price: 100,
      });
      assert.strictEqual(response.status, 400);
      assert.ok(response.body.errors.some((error) => error.includes("author")));
    });

    await test("POST /books rejects a non-numeric price with 400", async () => {
      const response = await request("POST", "/books", {
        title: "Bad Price",
        author: "Lab Student",
        price: "not-a-number",
      });
      assert.strictEqual(response.status, 400);
      assert.ok(response.body.errors.some((error) => error.includes("price")));
    });

    await test("POST /books rejects a negative price with 400", async () => {
      const response = await request("POST", "/books", {
        title: "Negative Price",
        author: "Lab Student",
        price: -5,
      });
      assert.strictEqual(response.status, 400);
      assert.ok(response.body.errors.some((error) => error.includes("price")));
    });

    await test("POST /books with an empty body returns 400 with all errors", async () => {
      const response = await request("POST", "/books", {});
      assert.strictEqual(response.status, 400);
      assert.ok(response.body.errors.length >= 3);
    });

    // ------------------------------------------------------------------
    // Update
    // ------------------------------------------------------------------
    await test("PUT /books/:id with a valid body returns 200", async () => {
      const response = await request("PUT", `/books/${createdBookId}`, {
        title: "The Testing Book - Updated",
        author: "Lab Student",
        price: 199.99,
        pages: 120,
      });
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.data.title, "The Testing Book - Updated");
      assert.strictEqual(response.body.data.price, 199.99);
    });

    await test("GET after PUT confirms the update persisted", async () => {
      const response = await request("GET", `/books/${createdBookId}`);
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.data.title, "The Testing Book - Updated");
      assert.strictEqual(response.body.data.pages, 120);
    });

    await test("PUT /books/9999 returns 404", async () => {
      const response = await request("PUT", "/books/9999", {
        title: "Ghost",
        author: "Nobody",
        price: 10,
      });
      assert.strictEqual(response.status, 404);
    });

    await test("PUT with an invalid price returns 400", async () => {
      const response = await request("PUT", `/books/${createdBookId}`, {
        title: "Still Here",
        author: "Lab Student",
        price: "abc",
      });
      assert.strictEqual(response.status, 400);
    });

    await test("PUT /books/abc returns 400", async () => {
      const response = await request("PUT", "/books/abc", {
        title: "Bad Id",
        author: "Lab Student",
        price: 10,
      });
      assert.strictEqual(response.status, 400);
    });

    // ------------------------------------------------------------------
    // Delete
    // ------------------------------------------------------------------
    await test("DELETE /books/:id returns 200", async () => {
      const response = await request("DELETE", `/books/${createdBookId}`);
      assert.strictEqual(response.status, 200);
      assert.ok(response.body.message.includes("deleted"));
    });

    await test("GET after DELETE returns 404", async () => {
      const response = await request("GET", `/books/${createdBookId}`);
      assert.strictEqual(response.status, 404);
    });

    await test("DELETE /books/9999 returns 404", async () => {
      const response = await request("DELETE", "/books/9999");
      assert.strictEqual(response.status, 404);
    });

    await test("DELETE /books/abc returns 400", async () => {
      const response = await request("DELETE", "/books/abc");
      assert.strictEqual(response.status, 400);
    });

    // ------------------------------------------------------------------
    // Generic error handling
    // ------------------------------------------------------------------
    await test("Unknown route returns 404 with a message", async () => {
      const response = await request("GET", "/not-a-real-route");
      assert.strictEqual(response.status, 404);
      assert.ok(response.body.message.includes("Route not found"));
    });

    await test("Malformed JSON returns 400 with a message", async () => {
      const response = await request(
        "POST",
        "/books",
        '{ "title": ',
        { "Content-Type": "application/json" }
      );
      assert.strictEqual(response.status, 400);
      assert.ok(response.body.message.includes("Invalid JSON"));
    });
  } finally {
    await stopServer(server);

    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch (error) {
        console.warn(`Could not remove ${TEST_DB_PATH}: ${error.message}`);
      }
    }
  }

  console.log("");
  console.log("=========================================");
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED:      ${passed}`);
  console.log(`FAILED:      ${failed}`);
  console.log("=========================================");

  if (failed > 0) {
    console.error("\nServer output:");
    console.error(serverOutput);
    process.exitCode = 1;
  }
};

runTests().catch((error) => {
  console.error("Test runner crashed:", error);
  process.exitCode = 1;
});
