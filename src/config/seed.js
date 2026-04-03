// src/config/seed.js
// Run once:  npm run seed
// Creates demo users (one per role) and 40 sample financial records so
// the dashboard endpoints return meaningful data immediately.

require("dotenv").config();
const bcrypt = require("bcryptjs");
const { getDb } = require("./database");

const db = getDb();

// ── Demo users ────────────────────────────────────────────────────────────────
const users = [
  { name: "Alice Admin",  email: "admin@demo.com",   password: "admin123",   role: "admin"   },
  { name: "Ana Analyst",  email: "analyst@demo.com", password: "analyst123", role: "analyst" },
  { name: "Vera Viewer",  email: "viewer@demo.com",  password: "viewer123",  role: "viewer"  },
];

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (name, email, password, role, email_verified)
  VALUES (@name, @email, @password, @role, 1)
`);

let adminId;
const insertUsers = db.transaction(() => {
  for (const u of users) {
    const hash = bcrypt.hashSync(u.password, 10);
    insertUser.run({ ...u, password: hash, email_verified: 1 });
  }
  adminId = db.prepare("SELECT id FROM users WHERE email = ?").get("admin@demo.com").id;
});
insertUsers();

// ── Sample records ────────────────────────────────────────────────────────────
const categories = {
  income:  ["Salary", "Freelance", "Investments", "Rental", "Bonus"],
  expense: ["Rent", "Groceries", "Utilities", "Transport", "Entertainment", "Healthcare", "Subscriptions"],
};

function randomDate(start, end) {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().slice(0, 10);
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const insertRecord = db.prepare(`
  INSERT OR IGNORE INTO records (amount, type, category, date, notes, created_by)
  VALUES (@amount, @type, @category, @date, @notes, @created_by)
`);

const seedRecords = db.transaction(() => {
  const end   = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - 5, 1); // last ~6 months

  for (let i = 0; i < 60; i++) {
    const type     = Math.random() < 0.4 ? "income" : "expense";
    const catList  = categories[type];
    const category = pick(catList);
    const amount   = parseFloat((Math.random() * (type === "income" ? 8000 : 3000) + 100).toFixed(2));
    insertRecord.run({
      amount,
      type,
      category,
      date:       randomDate(start, end),
      notes:      `Sample ${type} – ${category}`,
      created_by: adminId,
    });
  }
});
seedRecords();

console.log("✅  Seed complete.");
console.log("   admin@demo.com   / admin123");
console.log("   analyst@demo.com / analyst123");
console.log("   viewer@demo.com  / viewer123");
