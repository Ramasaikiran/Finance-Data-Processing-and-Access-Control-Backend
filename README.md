# Finance Dashboard Backend

A production-structured REST API for a multi-role finance dashboard. Built with **Node.js + Express + SQLite**.

---
## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Defaults work out of the box no edits needed for local dev

# 3. Seed demo users + 60 sample records
npm run seed

# 4. Start
npm start          # production
npm run dev        # development (nodemon)
```

Server: **http://localhost:3000**

### Demo credentials

| Role    | Email                | Password    | Notes                    |
|---------|----------------------|-------------|--------------------------|
| Admin   | admin@demo.com       | admin123    | Full access              |
| Analyst | analyst@demo.com     | analyst123  | Read + insights          |
| Viewer  | viewer@demo.com      | viewer123   | Read-only dashboard      |

> Seed users are pre-verified. New users created via the API must verify their email before they can log in.

---

## Project Structure

```
finance-backend/
├── server.js                        # Entry point — binds port, nothing else
├── src/
│   ├── app.js                       # Express app (middleware + route wiring)
│   ├── config/
│   │   ├── database.js              # SQLite connection + versioned migrations
│   │   └── seed.js                  # Demo data script (npm run seed)
│   ├── middleware/
│   │   ├── auth.js                  # JWT verification → req.user
│   │   ├── rbac.js                  # authorize() / requireMinRole()
│   │   ├── validate.js              # express-validator result collector
│   │   └── errorHandler.js          # Global error → uniform JSON response
│   ├── routes/
│   │   ├── auth.js                  # /api/auth/*
│   │   ├── users.js                 # /api/users/*
│   │   ├── records.js               # /api/records/*
│   │   └── dashboard.js             # /api/dashboard/*
│   ├── services/
│   │   ├── authService.js           # Login, register, email verification
│   │   ├── emailService.js          # Nodemailer — real SMTP or console fallback
│   │   ├── userService.js           # User CRUD
│   │   ├── recordService.js         # Financial record CRUD + filtering
│   │   └── dashboardService.js      # Aggregation / analytics queries
│   └── utils/
│       ├── errors.js                # Typed AppError subclasses
│       └── response.js              # success() / created() / noContent()
```

**Separation of concerns:** routes validate input and call services; services contain all business logic and SQL; utilities are stateless helpers. No business logic lives in middleware or route handlers.

---

## Core Requirements — Implementation Map

### 1. User & Role Management

**Files:** `src/routes/users.js`, `src/routes/auth.js`, `src/services/userService.js`, `src/services/authService.js`

#### Roles

Three roles with an explicit hierarchy (`viewer < analyst < admin`), stored as a `CHECK` constraint in the DB:

| Role    | Capability                                              |
|---------|---------------------------------------------------------|
| viewer  | Read dashboard summary and recent activity              |
| analyst | Everything viewer can do + category totals and trends   |
| admin   | Full CRUD on records and users                          |

#### Endpoints

| Method | Path                      | Description                         |
|--------|---------------------------|-------------------------------------|
| POST   | /api/auth/login           | Authenticate, receive JWT           |
| POST   | /api/auth/register        | Admin creates a new user account    |
| GET    | /api/users                | List all users (paginated)          |
| GET    | /api/users/:id            | Get a single user                   |
| POST   | /api/users                | Create user                         |
| PUT    | /api/users/:id            | Update name, email, role, or status |
| PATCH  | /api/users/:id/status     | Activate or deactivate account      |
| DELETE | /api/users/:id            | Hard delete user                    |

Users cannot self-register. Only admins can create accounts, intentionally modelling an internal-tool scenario where access is controlled.

---

### 2. Financial Records Management

**Files:** `src/routes/records.js`, `src/services/recordService.js`

#### Record schema

| Field      | Type    | Notes                             |
|------------|---------|-----------------------------------|
| amount     | REAL    | Must be > 0 (DB + app constraint) |
| type       | TEXT    | `income` or `expense`             |
| category   | TEXT    | Free text, indexed for filtering  |
| date       | TEXT    | ISO-8601 date (YYYY-MM-DD)        |
| notes      | TEXT    | Optional description              |
| created_by | INTEGER | FK → users.id                     |
| deleted_at | TEXT    | NULL = active (soft delete)       |

#### Endpoints

| Method | Path              | Role    | Description                      |
|--------|-------------------|---------|----------------------------------|
| GET    | /api/records      | viewer+ | List with filters + pagination   |
| GET    | /api/records/:id  | viewer+ | Single record                    |
| POST   | /api/records      | admin   | Create record                    |
| PUT    | /api/records/:id  | admin   | Update record fields             |
| DELETE | /api/records/:id  | admin   | Soft-delete                      |

#### Filters available on `GET /api/records`

```
?type=income|expense
?category=Salary
?dateFrom=2024-01-01
?dateTo=2024-06-30
?search=rent           ← substring match on notes and category
?page=2&limit=10
```

All filters compose — `?type=expense&dateFrom=2024-01-01&search=rent` works as expected.

---

### 3. Dashboard Summary APIs

**Files:** `src/routes/dashboard.js`, `src/services/dashboardService.js`

All aggregation logic lives in `dashboardService.js` using SQLite's date functions (`strftime`). Routes are thin wrappers.

| Endpoint                          | Role     | Returns                                           |
|-----------------------------------|----------|---------------------------------------------------|
| GET /api/dashboard/summary        | viewer+  | Total income, total expense, net balance, count   |
| GET /api/dashboard/recent         | viewer+  | Last N records with creator name                  |
| GET /api/dashboard/category-totals| analyst+ | SUM and COUNT grouped by type + category          |
| GET /api/dashboard/trends/monthly | analyst+ | Income / expense / net per calendar month         |
| GET /api/dashboard/trends/weekly  | analyst+ | Income / expense / net per ISO week               |

**Example: `GET /api/dashboard/summary`**
```json
{
  "success": true,
  "data": {
    "total_income": 42580.00,
    "total_expense": 18320.75,
    "net_balance": 24259.25,
    "record_count": 60
  }
}
```

**Example: `GET /api/dashboard/trends/monthly?months=3`**
```json
{
  "success": true,
  "data": [
    { "month": "2024-01", "income": 7200.00, "expense": 2850.50, "net": 4349.50 },
    { "month": "2024-02", "income": 6800.00, "expense": 3100.00, "net": 3700.00 },
    { "month": "2024-03", "income": 8100.00, "expense": 2900.00, "net": 5200.00 }
  ]
}
```

The viewer/analyst split is enforced here: viewers only see totals and recent activity analysts and admins get the full category and trend data.

---

### 4. Access Control Logic

**Files:** `src/middleware/auth.js`, `src/middleware/rbac.js`

Access control is implemented as composable Express middleware at the route level. Two helpers are exported from `rbac.js`:

```js
// Explicit allowlist — only the listed roles pass
authorize("analyst", "admin")

// Minimum rank — passes for the named role and anything above it
requireMinRole("analyst")
```

Routes compose these with the JWT middleware:

```js
router.use(authenticate);               // verify token on all routes in file
router.post("/", authorize("admin"), …) // then gate individual routes
```

**Complete permission matrix**

| Action                          | Viewer | Analyst | Admin |
|---------------------------------|:------:|:-------:|:-----:|
| Login / verify email            | ✓      | ✓       | ✓     |
| GET /api/auth/me                | ✓      | ✓       | ✓     |
| GET /api/records                | ✓      | ✓       | ✓     |
| GET /api/dashboard/summary      | ✓      | ✓       | ✓     |
| GET /api/dashboard/recent       | ✓      | ✓       | ✓     |
| GET /api/dashboard/category-totals | ✗   | ✓       | ✓     |
| GET /api/dashboard/trends/*     | ✗      | ✓       | ✓     |
| POST/PUT/DELETE /api/records    | ✗      | ✗       | ✓     |
| Any /api/users endpoint         | ✗      | ✗       | ✓     |

Attempting a forbidden action returns:
```json
{ "success": false, "code": "FORBIDDEN", "message": "This action requires one of the following roles: admin" }
```

---

### 5. Validation & Error Handling

**Files:** `src/middleware/validate.js`, `src/middleware/errorHandler.js`, `src/utils/errors.js`

#### Input validation

Validation chains are declared with `express-validator` inline in each route, immediately above the handler, so it is obvious what each route accepts without jumping between files. The `validate` middleware collects all failures and rejects the request with a combined message before it reaches the service layer.

```
POST /api/records  { amount: -50, type: "salary" }

→ 400 Bad Request
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "amount: amount must be a positive number; type: type must be 'income' or 'expense'"
}
```

#### Error class hierarchy

```
AppError (base)
  ├── ValidationError   → 400
  ├── UnauthorizedError → 401
  ├── ForbiddenError    → 403
  ├── NotFoundError     → 404
  ├── ConflictError     → 409
  └── (unhandled)       → 500
```

Services throw typed errors; the global `errorHandler` middleware converts them to the right status code. No status-code logic leaks into individual route handlers.

#### HTTP status codes used

| Code | Situation                                          |
|------|----------------------------------------------------|
| 200  | Successful read or update                          |
| 201  | Resource created                                   |
| 204  | Delete (no body)                                   |
| 400  | Validation failure or bad request                  |
| 401  | Missing/expired/invalid JWT, or unverified email   |
| 403  | Authenticated but insufficient role                |
| 404  | Record or user not found                           |
| 409  | Duplicate email on register/update                 |
| 500  | Unhandled server error (message hidden in prod)    |

---

### 6. Data Persistence

**File:** `src/config/database.js`

**Database:** SQLite via `better-sqlite3` (synchronous API — no callback pyramid, easy to read).

**Schema** (two tables):

```sql
users (
  id, name, email, password, role, status,
  email_verified, verification_token, verification_token_expires_at,
  created_at, updated_at
)

records (
  id, amount, type, category, date, notes,
  created_by → users.id,
  deleted_at,     ← soft delete
  created_at, updated_at
)
```

**Migrations** are versioned via a `_migrations` table. Each migration runs exactly once; new columns are added as new version entries, never by altering existing `CREATE TABLE` statements. This means the schema can evolve safely on an existing database.

```js
run(1, `CREATE TABLE IF NOT EXISTS users ...`);
run(2, `ALTER TABLE users ADD COLUMN email_verified ...`);
// → run(3, ...) for the next change
```

**Indexes** on `records.type`, `records.category`, and `records.date` (with `WHERE deleted_at IS NULL`) keep filtered list queries fast.

**WAL mode** is enabled (`PRAGMA journal_mode = WAL`) for safer concurrent reads and **foreign keys** are enforced (`PRAGMA foreign_keys = ON`).

---

## Optional Enhancements

| Enhancement          | Implemented | Detail                                                      |
|----------------------|:-----------:|-------------------------------------------------------------|
| JWT authentication   | ✓           | `src/middleware/auth.js` — Bearer token, 24h expiry         |
| Email verification   | ✓           | `src/services/emailService.js` — Nodemailer, dev console fallback |
| Pagination           | ✓           | All list endpoints: `?page=&limit=`, response includes `meta` |
| Search               | ✓           | `?search=` on records — substring match on notes + category |
| Soft delete          | ✓           | `deleted_at` timestamp on records; hard delete on users     |
| Rate limiting        | ✗           | Not implemented. Would add `express-rate-limit` per-IP      |
| Tests                | ✗           | Not implemented. Would use `jest` + `supertest`             |
| API documentation    | ✓           | This README                                                 |

---

## Complete API Reference

### Auth

```
POST   /api/auth/login
POST   /api/auth/register          (admin only)
GET    /api/auth/verify-email?token=<hex>
POST   /api/auth/resend-verification
GET    /api/auth/me                (any authenticated role)
```

### Users (admin only)

```
GET    /api/users?page=1&limit=20
GET    /api/users/:id
POST   /api/users
PUT    /api/users/:id
PATCH  /api/users/:id/status
DELETE /api/users/:id
```

### Records

```
GET    /api/records?type=&category=&dateFrom=&dateTo=&search=&page=&limit=
GET    /api/records/:id            (viewer+)
POST   /api/records                (admin)
PUT    /api/records/:id            (admin)
DELETE /api/records/:id            (admin — soft delete)
```

### Dashboard

```
GET    /api/dashboard/summary               (viewer+)
GET    /api/dashboard/recent?limit=10       (viewer+)
GET    /api/dashboard/category-totals?type= (analyst+)
GET    /api/dashboard/trends/monthly?months=6  (analyst+)
GET    /api/dashboard/trends/weekly?weeks=8    (analyst+)
```

### Health

```
GET    /health     (unauthenticated)
```

---

## Authentication Flow

```
1. POST /api/auth/login  { email, password }
   ← 200 { token, user }

2. All subsequent requests:
   Authorization: Bearer <token>

3. Token expires after JWT_EXPIRES_IN (default 24h).
   Client must re-login to get a new token.
```

---

## Email Verification Flow

```
Admin registers a user via POST /api/auth/register or POST /api/users
  → DB: email_verified = 0, verification_token = <random hex>, expires in 24h
  → Email sent with link: GET /api/auth/verify-email?token=<hex>

User clicks link
  → DB: email_verified = 1, token cleared
  → User can now log in

If the link expires:
  POST /api/auth/resend-verification { email }
  → Fresh token generated, new email sent
  → Always returns 200 (no user enumeration)
```

**Dev mode:** if `SMTP_HOST` is not configured, the verification link is printed to the terminal instead of sent.

---

## Response Envelope

Every response uses the same shape:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional human-readable note",
  "meta": { "total": 60, "page": 1, "limit": 20, "pages": 3 }
}
```

Error:
```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "amount: must be a positive number"
}
```

---

## Environment Variables

| Variable       | Default                      | Description                                |
|----------------|------------------------------|--------------------------------------------|
| PORT           | 3000                         | HTTP listen port                           |
| NODE_ENV       | development                  | Controls log verbosity and error detail    |
| DB_PATH        | ./finance.db                 | SQLite file path                           |
| JWT_SECRET     | dev_secret_change_me         | **Must be changed in production**          |
| JWT_EXPIRES_IN | 24h                          | Token lifetime (e.g. `1h`, `7d`)           |
| SMTP_HOST      | *(empty)*                    | SMTP server hostname                       |
| SMTP_PORT      | 587                          | SMTP port (465 enables TLS)                |
| SMTP_USER      | *(empty)*                    | SMTP username                              |
| SMTP_PASS      | *(empty)*                    | SMTP password or API key                   |
| SMTP_FROM      | Finance App \<noreply@…\>   | From address shown in emails               |
| APP_URL        | http://localhost:3000        | Base URL used in email verification links  |

---

## Design Decisions & Assumptions

**SQLite over PostgreSQL.** SQLite via `better-sqlite3` eliminates all infrastructure setup and keeps the code easy to follow during review. The schema uses standard SQL throughout and the migration pattern is directly portable to PostgreSQL — swapping the adapter is the only change required.

**No self-registration.** Users are created by admins only. This matches the stated scenario of an internal dashboard where access should be explicitly granted.

**Soft delete on records, hard delete on users.** Financial records should never be destroyed — they are soft-deleted (`deleted_at`) for auditability. User accounts have no equivalent audit requirement and are hard-deleted.

**Fire-and-forget email sending.** Email failures (e.g. SMTP misconfiguration) are logged but do not cause the HTTP response to fail. The user record is still created and the admin receives a 201. The user can request a resend via `POST /api/auth/resend-verification`.

**RBAC at the route layer, not the service layer.** Services contain only business logic and are unaware of roles. This keeps them independently testable and avoids role-checking logic being duplicated across service methods.

**No refresh tokens.** JWTs expire after 24 hours and the client re-authenticates. Refresh tokens would be the appropriate next step for a production system with longer sessions.

**Pagination max 100.** All list endpoints cap at `limit=100` per request to prevent accidental full-table reads.

---

## Known Tradeoffs

| Tradeoff | Detail |
|----------|--------|
| No rate limiting | `express-rate-limit` would be added before production. The `/api/auth/resend-verification` endpoint is the most exposure risk. 
| No refresh tokens | 24h JWT lifetime is a simplification. A production system would implement short-lived access tokens + long-lived refresh tokens. 
| SQLite concurrency | SQLite handles multiple concurrent readers well in WAL mode but serialises writers. A busy production service would switch to PostgreSQL. 
| Passwords in seed | Demo passwords are short and readable. Production seeding would use a secrets manager or an interactive prompt. 
