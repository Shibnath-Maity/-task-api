require("dotenv").config();
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const openapiSpec = require("./openapi.json");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ---------------------------------------------------------------------------
// Stage 1: root and health endpoints (unchanged from Assignment 1)
// ---------------------------------------------------------------------------
app.get("/", (req, res) => {
  res.json({
    name: "Task API",
    version: "1.0",
    endpoints: [
      "GET /tasks",
      "GET /tasks/:id",
      "POST /tasks",
      "PUT /tasks/:id",
      "DELETE /tasks/:id",
    ],
  });
});

app.get("/health", (req, res) => {
  // Extra: a real health check pings the database too, not just the process.
  // Real companies gate deploys on exactly this.
  try {
    db.prepare("SELECT 1").get();
    res.json({ status: "ok", db: "ok" });
  } catch (err) {
    res.status(503).json({ status: "error", db: "unreachable" });
  }
});

// Turn a SQLite row (done: 0/1) into the same shape the API returned in A1 (done: true/false)
function toTask(row) {
  return { id: row.id, title: row.title, done: Boolean(row.done) };
}

// ---------------------------------------------------------------------------
// Stage 1: Read — now backed by SQL instead of Array.find/filter
// ---------------------------------------------------------------------------
app.get("/tasks", (req, res) => {
  let sql = "SELECT * FROM tasks WHERE 1=1";
  const params = [];

  // Extra: filter by done=true/false, done with SQL instead of a JS filter
  if (req.query.done !== undefined) {
    sql += " AND done = ?";
    params.push(req.query.done === "true" ? 1 : 0);
  }

  // Extra: search by title substring, done with SQL's LIKE instead of a JS .includes()
  if (req.query.search) {
    sql += " AND title LIKE ?";
    params.push(`%${req.query.search}%`);
  }

  sql += " ORDER BY id";

  // Stretch: pagination with limit/offset, done with SQL's LIMIT/OFFSET
  if (req.query.limit !== undefined || req.query.offset !== undefined) {
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : -1;
    const offset = Number(req.query.offset) || 0;
    sql += " LIMIT ? OFFSET ?";
    params.push(limit, offset);
  }

  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(toTask));
});

app.get("/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);

  if (!row) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  res.json(toTask(row));
});

// ---------------------------------------------------------------------------
// Stage 2: Create — INSERT instead of Array.push. Same validation as A1.
// ---------------------------------------------------------------------------
app.post("/tasks", (req, res) => {
  const { title } = req.body || {};

  if (!title || typeof title !== "string" || title.trim() === "") {
    return res.status(400).json({ error: "title is required and must be a non-empty string" });
  }

  const result = db
    .prepare("INSERT INTO tasks (title, done) VALUES (?, ?)")
    .run(title.trim(), 0);

  const newTask = db.prepare("SELECT * FROM tasks WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(toTask(newTask));
});

// ---------------------------------------------------------------------------
// Stage 3: Update & Delete — UPDATE / DELETE instead of splice/mutate
// ---------------------------------------------------------------------------
app.put("/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);

  if (!existing) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  const { title, done } = req.body || {};
  const hasTitle = title !== undefined;
  const hasDone = done !== undefined;

  if (!hasTitle && !hasDone) {
    return res.status(400).json({ error: "request body must include title and/or done" });
  }

  if (hasTitle && (typeof title !== "string" || title.trim() === "")) {
    return res.status(400).json({ error: "title must be a non-empty string" });
  }

  if (hasDone && typeof done !== "boolean") {
    return res.status(400).json({ error: "done must be a boolean" });
  }

  const newTitle = hasTitle ? title.trim() : existing.title;
  const newDone = hasDone ? (done ? 1 : 0) : existing.done;

  db.prepare("UPDATE tasks SET title = ?, done = ? WHERE id = ?").run(newTitle, newDone, id);

  const updated = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  res.json(toTask(updated));
});

app.delete("/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  const result = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);

  if (result.changes === 0) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Extras: stats and reset, now computed/executed with SQL
// ---------------------------------------------------------------------------
app.get("/stats", (req, res) => {
  const total = db.prepare("SELECT COUNT(*) AS c FROM tasks").get().c;
  const done = db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE done = 1").get().c;
  res.json({ total, done, open: total - done });
});

app.post("/reset", (req, res) => {
  const resetAll = db.transaction(() => {
    db.exec("DELETE FROM tasks");
    const insert = db.prepare("INSERT INTO tasks (title, done) VALUES (?, ?)");
    insert.run("Buy milk", 0);
    insert.run("Walk the dog", 0);
    insert.run("Finish assignment", 1);
  });
  resetAll();

  const rows = db.prepare("SELECT * FROM tasks ORDER BY id").all();
  res.json({ status: "reset", tasks: rows.map(toTask) });
});

// ---------------------------------------------------------------------------
// Stage 5 (A1): Swagger UI — unchanged
// ---------------------------------------------------------------------------
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.listen(PORT, () => {
  console.log(`Task API listening on http://localhost:${PORT}`);
  console.log(`Swagger docs at http://localhost:${PORT}/docs`);
  console.log(`Data stored in tasks.db`);
});