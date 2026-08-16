const express = require("express");
const swaggerUi = require("swagger-ui-express");
const openapiSpec = require("./openapi.json");

const app = express();
const PORT = 3000;

// Express doesn't parse JSON bodies by default — this middleware does it for us.
app.use(express.json());

// ---------------------------------------------------------------------------
// Stage 2: in-memory "database" — just a plain array that lives in RAM.
// It resets every time the server restarts. That's expected for this week.
// ---------------------------------------------------------------------------
let tasks = [
  { id: 1, title: "Buy milk", done: false },
  { id: 2, title: "Walk the dog", done: false },
  { id: 3, title: "Finish assignment", done: true },
];

// nextId tracks the next free id to hand out on create.
let nextId = 4;

// ---------------------------------------------------------------------------
// Stage 1: root and health endpoints
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
  res.json({ status: "ok" });
});

// ---------------------------------------------------------------------------
// Stage 2: Read — list all tasks, get a single task
// ---------------------------------------------------------------------------
app.get("/tasks", (req, res) => {
  let result = tasks;

  // Extra: filter by done=true/false
  if (req.query.done !== undefined) {
    const wantDone = req.query.done === "true";
    result = result.filter((t) => t.done === wantDone);
  }

  // Extra: search by title substring (case-insensitive)
  if (req.query.search) {
    const term = req.query.search.toLowerCase();
    result = result.filter((t) => t.title.toLowerCase().includes(term));
  }

  // Stretch: pagination with limit/offset
  if (req.query.limit !== undefined || req.query.offset !== undefined) {
    const offset = Number(req.query.offset) || 0;
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : result.length;
    result = result.slice(offset, offset + limit);
  }

  res.json(result);
});

app.get("/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  const task = tasks.find((t) => t.id === id);

  if (!task) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  res.json(task);
});

// ---------------------------------------------------------------------------
// Stage 3: Create — POST a new task, with validation
// ---------------------------------------------------------------------------
app.post("/tasks", (req, res) => {
  const { title } = req.body || {};

  if (!title || typeof title !== "string" || title.trim() === "") {
    return res.status(400).json({ error: "title is required and must be a non-empty string" });
  }

  const newTask = {
    id: nextId++,
    title: title.trim(),
    done: false,
  };

  tasks.push(newTask);
  res.status(201).json(newTask);
});

// ---------------------------------------------------------------------------
// Stage 4: Update & Delete
// ---------------------------------------------------------------------------
app.put("/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  const task = tasks.find((t) => t.id === id);

  if (!task) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  const { title, done } = req.body || {};

  // At least one valid field must be present, and title (if given) can't be empty.
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

  if (hasTitle) task.title = title.trim();
  if (hasDone) task.done = done;

  res.json(task);
});

app.delete("/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  const index = tasks.findIndex((t) => t.id === id);

  if (index === -1) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  tasks.splice(index, 1);
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Extras (optional, ungraded but handy): filtering, search, stats, reset
// ---------------------------------------------------------------------------
app.get("/stats", (req, res) => {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  res.json({ total, done, open: total - done });
});

app.post("/reset", (req, res) => {
  tasks = [
    { id: 1, title: "Buy milk", done: false },
    { id: 2, title: "Walk the dog", done: false },
    { id: 3, title: "Finish assignment", done: true },
  ];
  nextId = 4;
  res.json({ status: "reset", tasks });
});

// ---------------------------------------------------------------------------
// Stage 5: Swagger UI — reads openapi.json, serves interactive docs at /docs
// ---------------------------------------------------------------------------
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.listen(PORT, () => {
  console.log(`Task API listening on http://localhost:${PORT}`);
  console.log(`Swagger docs at http://localhost:${PORT}/docs`);
});