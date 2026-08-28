const Database = require("better-sqlite3");
const path = require("path");

// Opening a SQLite file that doesn't exist yet creates it — that's our whole "install".
const dbPath = path.join(__dirname, "tasks.db");
const db = new Database(dbPath);

// ---------------------------------------------------------------------------
// Stage 0: create the table if it doesn't already exist.
// done is stored as 0/1 — SQLite has no native boolean type.
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0
  )
`);

// ---------------------------------------------------------------------------
// Seed three example tasks — but only the very first time (table is empty).
// Wrapped in a transaction so the three inserts are all-or-nothing.
// ---------------------------------------------------------------------------
const row = db.prepare("SELECT COUNT(*) AS count FROM tasks").get();

if (row.count === 0) {
  const insert = db.prepare("INSERT INTO tasks (title, done) VALUES (?, ?)");
  const seedAll = db.transaction((tasks) => {
    for (const t of tasks) insert.run(t.title, t.done ? 1 : 0);
  });

  seedAll([
    { title: "Buy milk", done: false },
    { title: "Walk the dog", done: false },
    { title: "Finish assignment", done: true },
  ]);

  console.log("Seeded 3 example tasks (first run).");
}

module.exports = db;