import { createClient } from '@libsql/client';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import {
  normalizeRetailer,
  parseAmount,
  parseDate,
  normalizeReason,
  parseDeleted,
  getField,
} from '../backend/src/normalize';

config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

function loadJson(filename: string): any[] {
  const filePath = path.join(__dirname, '..', 'backend', 'data', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

async function seed() {
  console.log('Creating schema...');

  await db.batch([
    { sql: 'DROP TABLE IF EXISTS dispute_activity_log', args: [] },
    { sql: 'DROP TABLE IF EXISTS disputes', args: [] },
    { sql: 'DROP TABLE IF EXISTS deductions', args: [] },
    { sql: 'DROP TABLE IF EXISTS retailers', args: [] },
    { sql: 'DROP TABLE IF EXISTS dispute_reasons', args: [] },
    { sql: 'DROP TABLE IF EXISTS companies', args: [] },
  ], 'write');

  await db.batch([
    {
      sql: `CREATE TABLE companies (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT,
        erp_system TEXT,
        default_currency TEXT,
        is_active BOOLEAN NOT NULL DEFAULT 1
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE retailers (
        id INTEGER PRIMARY KEY,
        canonical_name TEXT UNIQUE NOT NULL,
        type TEXT,
        region TEXT
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE dispute_reasons (
        code TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        category TEXT,
        typically_disputable BOOLEAN NOT NULL DEFAULT 0
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE deductions (
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
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE disputes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deduction_id INTEGER REFERENCES deductions(id),
        status TEXT CHECK(status IN ('new','in_review','submitted','accepted','partial','rejected')) DEFAULT 'new',
        amount_disputed_cents INTEGER,
        amount_recovered_cents INTEGER DEFAULT 0,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        resolved_at TEXT
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE dispute_activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dispute_id INTEGER REFERENCES disputes(id),
        from_status TEXT,
        to_status TEXT,
        note TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      args: [],
    },
  ], 'write');

  console.log('Schema created.');

  // ── Seed companies ──
  const companies = loadJson('companies.json');
  const companyStmts = [
    { sql: 'INSERT OR REPLACE INTO companies (id, name, slug, erp_system, default_currency, is_active) VALUES (?, ?, ?, ?, ?, ?)', args: [0, 'Unassigned', null, null, null, 1] },
    { sql: 'INSERT OR REPLACE INTO companies (id, name, slug, erp_system, default_currency, is_active) VALUES (?, ?, ?, ?, ?, ?)', args: [3, 'Unknown Company', null, null, null, 1] },
    ...companies.map((c: any) => ({
      sql: 'INSERT OR REPLACE INTO companies (id, name, slug, erp_system, default_currency, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      args: [c.id, c.name, c.slug, c.erp_system, c.default_currency, c.is_active ? 1 : 0],
    })),
  ];
  await db.batch(companyStmts, 'write');
  console.log(`Companies seeded: ${companies.length + 2}`);

  // ── Seed dispute reasons ──
  const reasons = loadJson('dispute_reasons.json');
  const reasonStmts = [
    { sql: 'INSERT OR REPLACE INTO dispute_reasons (code, label, category, typically_disputable) VALUES (?, ?, ?, ?)', args: ['OTHER', 'Other/Unknown', 'Other', 0] },
    ...reasons.map((r: any) => ({
      sql: 'INSERT OR REPLACE INTO dispute_reasons (code, label, category, typically_disputable) VALUES (?, ?, ?, ?)',
      args: [r.code, r.label, r.category, r.typically_disputable ? 1 : 0],
    })),
  ];
  await db.batch(reasonStmts, 'write');
  console.log(`Dispute reasons seeded: ${reasons.length + 1}`);

  // ── Seed retailers ──
  const retailers = loadJson('retailers.json');
  const retailerCache = new Map<string, number>();

  const retailerStmts = [
    { sql: 'INSERT OR REPLACE INTO retailers (id, canonical_name, type, region) VALUES (?, ?, ?, ?)', args: [0, 'Unknown', null, null] },
    ...retailers.map((r: any) => ({
      sql: 'INSERT OR REPLACE INTO retailers (id, canonical_name, type, region) VALUES (?, ?, ?, ?)',
      args: [r.id, r.name, r.type, r.region],
    })),
  ];
  await db.batch(retailerStmts, 'write');

  retailerCache.set('Unknown', 0);
  for (const r of retailers) {
    retailerCache.set(r.name, r.id);
  }
  console.log(`Retailers seeded: ${retailers.length + 1}`);

  function getRetailerId(canonicalName: string): number {
    return retailerCache.get(canonicalName) ?? retailerCache.get('Unknown')!;
  }

  // ── Seed deductions ──
  const deductions = loadJson('deductions.json');
  let skipped = 0;
  let inserted = 0;

  // Turso batch has a limit (~100 statements per batch in some configs), so chunk
  const BATCH_SIZE = 80;
  const deductionStmts: { sql: string; args: any[] }[] = [];

  for (const raw of deductions) {
    if (parseDeleted(raw.is_deleted)) {
      skipped++;
      continue;
    }

    const rawRetailer = getField(raw, 'retailer_name', 'retailer');
    const canonicalRetailer = normalizeRetailer(rawRetailer);
    const retailerId = getRetailerId(canonicalRetailer);

    const rawAmount = getField(raw, 'amount', 'total_amount');
    const amount = parseAmount(rawAmount);
    const date = parseDate(raw.deducted_at);
    const reasonCode = normalizeReason(getField(raw, 'reason', 'deduction_reason'));

    let companyId: number;
    if (raw.company_id == null) {
      companyId = 0;
    } else {
      companyId = Number(raw.company_id);
      if (isNaN(companyId)) companyId = 0;
    }

    const invoice = raw.invoice_number != null ? String(raw.invoice_number).trim() : null;
    const cleanInvoice = invoice === '' ? null : invoice;
    const originalStatus = raw.status != null ? String(raw.status).trim() : null;

    const issues: string[] = [];
    if (amount.flag) issues.push(`amount: ${amount.flag}`);
    if (date.flag) issues.push(`date: ${date.flag}`);
    if (companyId === 0) issues.push('company: unassigned');
    if (companyId === 3) issues.push('company: unknown');
    if (canonicalRetailer === 'Unknown') issues.push('retailer: unknown');

    const hasIssues = issues.length > 0 ? 1 : 0;
    const issueNotes = issues.length > 0 ? issues.join('; ') : null;

    deductionStmts.push({
      sql: `INSERT OR REPLACE INTO deductions (id, company_id, retailer_id, reason_code, invoice_number,
            amount_cents, amount_remaining_cents, deducted_at, original_status, original_retailer_name,
            has_data_issues, data_issue_notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        raw.id, companyId, retailerId, reasonCode, cleanInvoice,
        amount.cents, amount.cents, date.date, originalStatus,
        rawRetailer ?? null, hasIssues, issueNotes,
      ],
    });
    inserted++;
  }

  // Batch insert in chunks
  for (let i = 0; i < deductionStmts.length; i += BATCH_SIZE) {
    const chunk = deductionStmts.slice(i, i + BATCH_SIZE);
    await db.batch(chunk, 'write');
    process.stdout.write(`\r  Inserted ${Math.min(i + BATCH_SIZE, deductionStmts.length)} / ${deductionStmts.length} deductions`);
  }
  console.log();

  console.log('\n═══ Seed Summary ═══');
  console.log(`Total records in JSON:  ${deductions.length}`);
  console.log(`Skipped (deleted):      ${skipped}`);
  console.log(`Inserted:               ${inserted}`);
  console.log('\nSeed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
