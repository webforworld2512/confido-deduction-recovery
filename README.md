# Confido Deduction Recovery Tool

An internal tool that helps analysts track retailer deductions, manage disputes through their full lifecycle, and see how much money has actually been recovered — replacing a spreadsheet that had gotten out of hand.

## What it does

Confido's brands sell through retailers like Kroger, Target, and KeHE. When a retailer short-pays an invoice, they attach a reason — a **deduction**. Some deductions are legitimate; many aren't, and those can be **disputed** to recover the money.

This app lets an analyst:

- See all deductions across companies, cleaned and normalized from a messy raw export
- Spot which deductions are worth disputing (flagged by reason code) but haven't been yet
- Create and move disputes through a defined lifecycle: New → In Review → Submitted → Accepted / Partial / Rejected
- Re-open a dispute for the remaining balance if a retailer only partially pays
- See recovery metrics on a dashboard — how much was disputed, how much came back, and the trend over time
- Export any filtered view of the deductions to CSV
- Review data quality issues flagged during import in one place

## Stack

- **Backend:** Node, TypeScript, Express, SQLite (`better-sqlite3`, raw SQL, no ORM)
- **Frontend:** React, TypeScript, Vite, shadcn/ui, Tailwind CSS

## How to run

**Requirements:** Node 18+, npm

```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Seed the database (cleans and loads the raw JSON exports)
cd ../backend && npm run seed

# 3. Start the backend (in one terminal)
npm run dev
# → runs on http://localhost:3001

# 4. Start the frontend (in a separate terminal)
cd ../frontend && npm run dev
# → runs on http://localhost:5173
```

Open `http://localhost:5173` in your browser.

## Project structure

```
confido-deductions-app/
├── backend/
│   ├── src/
│   │   ├── index.ts              Express app entry
│   │   ├── db.ts                 SQLite schema + connection
│   │   ├── normalize.ts          Data cleaning functions (58 tests)
│   │   ├── normalize.test.ts     Tests for all normalization logic
│   │   ├── seed.ts               Loads and cleans raw JSON into SQLite
│   │   └── routes/
│   │       ├── deductions.ts     List + detail endpoints
│   │       ├── disputes.ts       Create, transition, activity log
│   │       ├── companies.ts      Company list for the selector
│   │       ├── retailers.ts      Retailer list for filters
│   │       └── dataQuality.ts    Flagged records + issue counts
│   └── data/                     Raw JSON exports
│       ├── deductions.json       1,007 raw deduction records
│       ├── companies.json        4 companies
│       ├── retailers.json        14 canonical retailers
│       └── dispute_reasons.json  9 reason codes (+ OTHER added at seed)
├── frontend/
│   └── src/
│       ├── App.tsx               Routes + Toaster setup
│       ├── pages/
│       │   ├── Dashboard.tsx     Summary cards, charts, recovery timeline
│       │   ├── DeductionList.tsx  Filterable table with CSV export
│       │   ├── DeductionDetail.tsx  Detail view + dispute workflow
│       │   └── DataQuality.tsx   Flagged records by issue type
│       ├── components/
│       │   ├── Layout.tsx        Shell: sidebar nav + company selector
│       │   └── ui/               shadcn/ui primitives
│       └── lib/
│           ├── api.ts            Fetch wrapper + formatCents
│           ├── CompanyContext.tsx Global company filter state
│           ├── status.ts         Centralized dispute status colors/labels
│           ├── toast.ts          Sonner toast helpers
│           └── utils.ts          cn() utility
├── DESIGN.md                     Running log of architecture decisions
└── README.md
```

## The data problem

The raw export (1,007 records) was genuinely messy. `normalize.ts` handles it:

| Issue | Example | Fix |
|---|---|---|
| Retailer names | ~80 variants of 14 real retailers (`KEHE`, `Kehe`, `KeHE Distributors LLC`, `K e H E`) | Mapped to canonical names via static lookup, cross-referenced against `retailers.json` |
| Amounts | `"$26,783.65"`, `"(102.78)"`, `"1.2E7"`, `"TBD"`, negative strings | Parsed to integer cents, flagged outliers and unparseable values rather than dropping them |
| Dates | 4+ formats, some in 2028 | Normalized to ISO, suspicious future dates flagged |
| Reason codes | Free text (`"Frieght"`, `"Short"`, `"Billback"`) | Mapped to the 9 codes in `dispute_reasons.json`, unmatched → `OTHER` |
| Structural | `retailer_name` vs `retailer`, `amount` vs `total_amount`, mixed types on `is_deleted`/`company_id` | Handled via a `getField()` fallback and type coercion |
| Deleted records | `is_deleted` in 4 different truthy/falsy forms | Excluded at seed time (266 of 1,007) |
| Orphaned company_id | Values `0`, `3`, and `null` not in `companies.json` | Mapped to placeholder "Unassigned" / "Unknown Company" entries rather than silently dropped |

**741 clean deduction records** made it through, with **205 flagged** for a specific, visible data quality issue (shown in the UI, not hidden).

## Key design decisions

**Amounts stored as integer cents.** Avoids floating-point rounding errors in financial data.

**Data quality issues are surfaced, not silently fixed.** A record with a bad date or an outlier amount still gets inserted and shown to the analyst with a flag — hiding it would create a false sense of clean data.

**Outliers are excluded from dashboard aggregates but not from the deductions list.** One `1.2E7`-parsed record was inflating dashboard totals into the billions. It's excluded from sums/averages on the Dashboard (with the excluded count/amount shown separately for transparency) but still visible and flagged in the Deductions list so an analyst can investigate it individually.

**Disputes are modeled 1-to-many against a deduction, not 1-to-1.** A retailer often only partially pays a dispute. Rather than treating that as a dead end, each deduction tracks an `amount_remaining_cents`, and a new dispute can be opened against the same deduction to pursue the rest — with a required note explaining why on any re-dispute attempt.

**Every dispute status transition is validated server-side and logged.** The UI only shows valid next actions, but the API itself rejects invalid transitions (e.g. `new → accepted` directly) and every change is recorded in an activity log with a full timestamp, shown in the analyst's local timezone.

**Company scoping is filter-based, not auth-based.** Given the assessment's scope, there's a company selector rather than a full permissions system — noted as a limitation below.

## Design considerations for the analyst

This tool is built for a deductions analyst — typically an AR/finance 
background, Excel-fluent, working a time-sensitive queue rather than 
exploring data. That shaped a few UI decisions:
- Large dollar figures are abbreviated (e.g. "$50.8M") with the exact 
  figure shown alongside, so totals are scannable but still verifiable
- Recovery rate is the most visually prominent number on the dashboard, 
  since it's typically the KPI an analyst is measured against
- The dispute workflow only ever shows the single valid next action, 
  mirroring how the analyst already thinks about a deduction's status, 
  rather than exposing a free-form status picker

This is a cheap addition that directly demonstrates the user-center

## Assumptions

- `is_deleted = true` records should be excluded entirely, not just hidden
- `company_id` values of `0`, `null`, or values missing from `companies.json` represent real but unattributed deductions, so they're bucketed into placeholder companies rather than dropped
- Amounts marked `"TBD"` in the source data are treated as genuinely unknown (null), not zero
- A 2028+ deduction date is a data entry error, not a real future-dated record — flagged rather than corrected, since the "right" date isn't recoverable from the data we have
- Retailer name normalization was done by hand-built lookup table against the known variants in this dataset; a new, unseen retailer name would currently fall through to "Unknown"

## Tradeoffs

- **No authentication or per-analyst assignment.** Every user sees every company via a filter dropdown, not a real permission boundary. A production version would need login and row-level access control.
- **No bulk operations or CSV import.** Considered both — CSV import in particular would need a generic column-mapping UI to handle *unknown* messiness, which is a materially larger problem than the hand-tuned normalizer built for this specific export. Documented in `DESIGN.md` under "Considered but deferred."
- **No editable fields on deduction records** (e.g. correcting a missing invoice number). ~8% of records have no usable invoice number, and it doesn't block the dispute workflow, so this wasn't prioritized. If built, it would need its own audit trail (who/when/old/new value) to be safe for financial data — a half-built version without that would be worse than read-only.
- **No approval/triage gate before disputing.** This tool goes straight from "flagged as disputable" to "dispute filed," which is a reasonable simplification at this scale but wouldn't hold up with a shared queue across multiple analysts.
- **Retailer/reason normalization is a static lookup table**, not fuzzy matching. It handles every variant seen in this specific export well, but a genuinely new spelling would need the table extended manually rather than being caught automatically.

## What I'd improve with more time

1. **Triage/approval step** before a deduction becomes a dispute candidate, matching how Confido's own team appears to work
2. **Analyst assignment** — deductions and disputes owned by specific people, not a shared pool
3. **CSV/file import** with column mapping and a preview-before-commit step, so new data sources beyond this one export could be ingested safely
4. **Bulk dispute actions** — select multiple eligible rows and file disputes in one action
5. **Editable fields with audit history** for correcting records as better data becomes available (e.g. an invoice number arriving later from remittance detail)
6. **Fuzzy/learned retailer matching** instead of a static lookup table, so new retailer name variants don't silently fall into "Unknown"
7. **An AI chat panel** for natural-language questions about the data ("what's our recovery rate with UNFI?"), generating read-only SQL against the existing schema — scoped out of this submission for time, but the data model here would support it directly

## Known data quality issues (visible in-app)

- 75 deductions with unparseable or suspicious dates
- 71 deductions with amount parsing issues (including one significant outlier excluded from dashboard totals)
- 46 deductions with an unrecognized retailer name (bucketed as "Unknown")
- 35 deductions with a missing or unrecognized company

All of the above remain visible in the Deductions list with a data quality badge — nothing is silently dropped except records explicitly marked as deleted in the source data.
