import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'confido.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT,
    erp_system TEXT,
    default_currency TEXT,
    is_active BOOLEAN NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS retailers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    canonical_name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dispute_reasons (
    code TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    category TEXT,
    typically_disputable BOOLEAN NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS deductions (
    id INTEGER PRIMARY KEY,
    company_id INTEGER,
    retailer_id INTEGER REFERENCES retailers(id),
    reason_code TEXT REFERENCES dispute_reasons(code),
    invoice_number TEXT,
    amount_cents INTEGER,
    deducted_at TEXT,
    original_status TEXT,
    original_retailer_name TEXT,
    has_data_issues BOOLEAN DEFAULT 0,
    data_issue_notes TEXT
  );

  CREATE TABLE IF NOT EXISTS disputes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deduction_id INTEGER UNIQUE REFERENCES deductions(id),
    status TEXT CHECK(status IN ('new','in_review','submitted','accepted','partial','rejected')) DEFAULT 'new',
    amount_disputed_cents INTEGER,
    amount_recovered_cents INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS dispute_activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dispute_id INTEGER REFERENCES disputes(id),
    from_status TEXT,
    to_status TEXT,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

export default db;
