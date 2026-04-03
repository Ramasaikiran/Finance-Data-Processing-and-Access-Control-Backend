// src/services/dashboardService.js
// All aggregation queries live here so routes stay thin.
// SQLite's date functions handle grouping by month/week.

const { getDb } = require("../config/database");

/** High-level totals: total income, total expense, net balance. */
function getSummary() {
  const db = getDb();

  const { total_income } = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total_income
    FROM records
    WHERE type = 'income' AND deleted_at IS NULL
  `).get();

  const { total_expense } = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total_expense
    FROM records
    WHERE type = 'expense' AND deleted_at IS NULL
  `).get();

  return {
    total_income,
    total_expense,
    net_balance: total_income - total_expense,
    record_count: db.prepare("SELECT COUNT(*) AS n FROM records WHERE deleted_at IS NULL").get().n,
  };
}

/** Totals broken down by category for each type. */
function getCategoryTotals({ type } = {}) {
  const db    = getDb();
  const where = type ? `AND type = '${type === "income" ? "income" : "expense"}'` : "";

  return db.prepare(`
    SELECT   type, category,
             ROUND(SUM(amount), 2)  AS total,
             COUNT(*)               AS count
    FROM     records
    WHERE    deleted_at IS NULL ${where}
    GROUP BY type, category
    ORDER BY type, total DESC
  `).all();
}

/**
 * Monthly trend: income and expense totals per calendar month.
 * Returns the last `months` months (default 6).
 */
function getMonthlyTrends({ months = 6 } = {}) {
  const db = getDb();

  return db.prepare(`
    SELECT   strftime('%Y-%m', date)          AS month,
             ROUND(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END), 2) AS income,
             ROUND(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 2) AS expense,
             ROUND(
               SUM(CASE WHEN type='income'  THEN amount ELSE 0 END) -
               SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 2
             )                                                               AS net
    FROM     records
    WHERE    deleted_at IS NULL
      AND    date >= date('now', '-${Number(months)} months')
    GROUP BY month
    ORDER BY month ASC
  `).all();
}

/**
 * Weekly trend: totals per ISO week.
 */
function getWeeklyTrends({ weeks = 8 } = {}) {
  const db = getDb();

  return db.prepare(`
    SELECT   strftime('%Y-W%W', date)          AS week,
             ROUND(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END), 2) AS income,
             ROUND(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 2) AS expense,
             ROUND(
               SUM(CASE WHEN type='income'  THEN amount ELSE 0 END) -
               SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 2
             )                                                               AS net
    FROM     records
    WHERE    deleted_at IS NULL
      AND    date >= date('now', '-${Number(weeks)} weeks')
    GROUP BY week
    ORDER BY week ASC
  `).all();
}

/** Most recent N records with their creator name. */
function getRecentActivity({ limit = 10 } = {}) {
  return getDb().prepare(`
    SELECT r.id, r.amount, r.type, r.category, r.date, r.notes,
           u.name AS created_by_name, r.created_at
    FROM   records r
    JOIN   users   u ON u.id = r.created_by
    WHERE  r.deleted_at IS NULL
    ORDER  BY r.created_at DESC
    LIMIT  ?
  `).all(limit);
}

module.exports = { getSummary, getCategoryTotals, getMonthlyTrends, getWeeklyTrends, getRecentActivity };
