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
    id INTEGER PRIMARY KEY,
    canonical_name TEXT UNIQUE NOT NULL,
    type TEXT,
    region TEXT
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
    amount_remaining_cents INTEGER,
    deducted_at TEXT,
    original_status TEXT,
    original_retailer_name TEXT,
    has_data_issues BOOLEAN DEFAULT 0,
    data_issue_notes TEXT
  );

  CREATE TABLE IF NOT EXISTS disputes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deduction_id INTEGER REFERENCES deductions(id),
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

// --- Migrations (safe to re-run) ---

// 1. Add amount_remaining_cents column if missing
const hasRemainingCol = db.prepare(`
  SELECT COUNT(*) AS c FROM pragma_table_info('deductions') WHERE name = 'amount_remaining_cents'
`).get() as { c: number };
if (hasRemainingCol.c === 0) {
  db.exec(`ALTER TABLE deductions ADD COLUMN amount_remaining_cents INTEGER`);
}

// 2. Remove UNIQUE constraint on disputes.deduction_id by recreating the table
const hasUniqueIdx = db.prepare(`
  SELECT COUNT(*) AS c FROM pragma_index_list('disputes')
  WHERE "unique" = 1 AND origin = 'u'
`).get() as { c: number };
if (hasUniqueIdx.c > 0) {
  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    db.exec(`
      CREATE TABLE disputes_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deduction_id INTEGER REFERENCES deductions(id),
        status TEXT CHECK(status IN ('new','in_review','submitted','accepted','partial','rejected')) DEFAULT 'new',
        amount_disputed_cents INTEGER,
        amount_recovered_cents INTEGER DEFAULT 0,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        resolved_at TEXT
      );
      INSERT INTO disputes_new SELECT * FROM disputes;
      DROP TABLE disputes;
      ALTER TABLE disputes_new RENAME TO disputes;
    `);
  })();
  db.pragma('foreign_keys = ON');
}

// 3. Backfill amount_remaining_cents for existing rows
db.exec(`
  UPDATE deductions
  SET amount_remaining_cents = MAX(0,
    COALESCE(amount_cents, 0) - COALESCE(
      (SELECT SUM(dis.amount_recovered_cents)
       FROM disputes dis
       WHERE dis.deduction_id = deductions.id
         AND dis.status IN ('accepted', 'partial')),
      0
    )
  )
  WHERE amount_remaining_cents IS NULL
`);

// 4. Normalize existing timestamps to ISO 8601 UTC (datetime('now') produces 'YYYY-MM-DD HH:MM:SS')
db.exec(`
  UPDATE disputes
  SET created_at = REPLACE(created_at, ' ', 'T') || 'Z'
  WHERE created_at NOT LIKE '%T%';

  UPDATE disputes
  SET updated_at = REPLACE(updated_at, ' ', 'T') || 'Z'
  WHERE updated_at NOT LIKE '%T%';

  UPDATE dispute_activity_log
  SET created_at = REPLACE(created_at, ' ', 'T') || 'Z'
  WHERE created_at NOT LIKE '%T%';
`);

export default db;
