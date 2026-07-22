import db from './db';
import {
  normalizeRetailer,
  parseAmount,
  parseDate,
  normalizeReason,
  parseDeleted,
  getField,
} from './normalize';
import fs from 'fs';
import path from 'path';

function loadJson(filename: string): any[] {
  const filePath = path.join(process.cwd(), 'data', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// ── Clear tables in FK-safe order ──

db.exec(`
  DELETE FROM dispute_activity_log;
  DELETE FROM disputes;
  DELETE FROM deductions;
  DELETE FROM retailers;
  DELETE FROM dispute_reasons;
  DELETE FROM companies;
`);

// ── Seed companies ──

const companies = loadJson('companies.json');
const insertCompany = db.prepare(`
  INSERT OR REPLACE INTO companies (id, name, slug, erp_system, default_currency, is_active)
  VALUES (?, ?, ?, ?, ?, ?)
`);

insertCompany.run(0, 'Unassigned', null, null, null, 1);
insertCompany.run(3, 'Unknown Company', null, null, null, 1);
for (const c of companies) {
  insertCompany.run(c.id, c.name, c.slug, c.erp_system, c.default_currency, c.is_active ? 1 : 0);
}
console.log(`Companies seeded: ${companies.length + 2}`);

// ── Seed dispute reasons ──

const reasons = loadJson('dispute_reasons.json');
const insertReason = db.prepare(`
  INSERT OR REPLACE INTO dispute_reasons (code, label, category, typically_disputable)
  VALUES (?, ?, ?, ?)
`);

insertReason.run('OTHER', 'Other/Unknown', 'Other', 0);
for (const r of reasons) {
  insertReason.run(r.code, r.label, r.category, r.typically_disputable ? 1 : 0);
}
console.log(`Dispute reasons seeded: ${reasons.length + 1}`);

// ── Retailer upsert cache ──

const upsertRetailer = db.prepare(`
  INSERT INTO retailers (canonical_name) VALUES (?)
  ON CONFLICT(canonical_name) DO UPDATE SET canonical_name = canonical_name
  RETURNING id
`);

const retailerCache = new Map<string, number>();

function getRetailerId(canonicalName: string): number {
  const cached = retailerCache.get(canonicalName);
  if (cached) return cached;
  const row = upsertRetailer.get(canonicalName) as { id: number };
  retailerCache.set(canonicalName, row.id);
  return row.id;
}

// ── Seed deductions ──

const deductions = loadJson('deductions.json');
const insertDeduction = db.prepare(`
  INSERT OR REPLACE INTO deductions (id, company_id, retailer_id, reason_code, invoice_number,
    amount_cents, deducted_at, original_status, original_retailer_name,
    has_data_issues, data_issue_notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let skipped = 0;
let inserted = 0;
const issueCountByType = new Map<string, number>();
const companyCount = new Map<number, number>();
const retailerCount = new Map<string, number>();
const reasonCount = new Map<string, number>();

const seedAll = db.transaction(() => {
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
    if (companyId === 3 || companyId === 0) {
      companyId = companyId; // keep as-is, both map to placeholder companies
    }

    const invoice = raw.invoice_number != null ? String(raw.invoice_number).trim() : null;
    const cleanInvoice = invoice === '' ? null : invoice;

    const originalStatus = raw.status != null ? String(raw.status).trim() : null;

    // Collect data issue flags
    const issues: string[] = [];
    if (amount.flag) issues.push(`amount: ${amount.flag}`);
    if (date.flag) issues.push(`date: ${date.flag}`);
    if (companyId === 0) issues.push('company: unassigned');
    if (companyId === 3) issues.push('company: unknown');
    if (canonicalRetailer === 'Unknown') issues.push('retailer: unknown');

    const hasIssues = issues.length > 0 ? 1 : 0;
    const issueNotes = issues.length > 0 ? issues.join('; ') : null;

    for (const issue of issues) {
      const type = issue.split(':')[0];
      issueCountByType.set(type, (issueCountByType.get(type) || 0) + 1);
    }

    insertDeduction.run(
      raw.id,
      companyId,
      retailerId,
      reasonCode,
      cleanInvoice,
      amount.cents,
      date.date,
      originalStatus,
      rawRetailer ?? null,
      hasIssues,
      issueNotes,
    );

    inserted++;
    companyCount.set(companyId, (companyCount.get(companyId) || 0) + 1);
    retailerCount.set(canonicalRetailer, (retailerCount.get(canonicalRetailer) || 0) + 1);
    reasonCount.set(reasonCode, (reasonCount.get(reasonCode) || 0) + 1);
  }
});

seedAll();

// ── Summary ──

console.log('\n═══ Seed Summary ═══');
console.log(`Total records in JSON:  ${deductions.length}`);
console.log(`Skipped (deleted):      ${skipped}`);
console.log(`Inserted:               ${inserted}`);

console.log('\n── Data Issues ──');
const sortedIssues = [...issueCountByType.entries()].sort((a, b) => b[1] - a[1]);
for (const [type, count] of sortedIssues) {
  console.log(`  ${type}: ${count}`);
}

console.log('\n── Deductions per Company ──');
const companyNames = db.prepare('SELECT id, name FROM companies').all() as { id: number; name: string }[];
const companyNameMap = new Map(companyNames.map(c => [c.id, c.name]));
const sortedCompanies = [...companyCount.entries()].sort((a, b) => b[1] - a[1]);
for (const [id, count] of sortedCompanies) {
  console.log(`  ${companyNameMap.get(id) ?? `Company ${id}`}: ${count}`);
}

console.log('\n── Deductions per Retailer ──');
const sortedRetailers = [...retailerCount.entries()].sort((a, b) => b[1] - a[1]);
for (const [name, count] of sortedRetailers) {
  console.log(`  ${name}: ${count}`);
}

console.log('\n── Reason Code Distribution ──');
const sortedReasons = [...reasonCount.entries()].sort((a, b) => b[1] - a[1]);
for (const [code, count] of sortedReasons) {
  console.log(`  ${code}: ${count}`);
}

console.log('\nSeed complete.');
