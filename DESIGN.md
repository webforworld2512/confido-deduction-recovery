# Design Decisions

## Express + SQLite + Raw SQL (No ORM)

**Chose:** Express with better-sqlite3 and hand-written SQL.

**Considered:** Prisma or Drizzle ORM, PostgreSQL.

**Why:** This is a single-user internal tool with a bounded dataset (~1000 deductions). SQLite removes deployment complexity (no database server), better-sqlite3 gives synchronous reads which simplifies request handlers, and raw SQL keeps queries transparent — important when the data model has quirks like outlier flags and multi-table aggregations that ORMs tend to obscure. PostgreSQL would be warranted if we needed concurrent writes or full-text search, neither of which applies here.

## Data Normalization at Seed Time

**Chose:** A `normalize.ts` module that cleans dirty source data during seeding, storing canonical values in the database. Raw values are preserved in `original_retailer_name` and `original_status` for reference.

**Considered:** Normalizing at query time (runtime), or storing raw data and resolving via lookup tables.

**Why:** The source data has significant quality issues across every field type:
- **Retailers:** 80+ spelling variants (e.g. "kehe", "KeHE Distributors LLC", "KeHE Food Distributors") mapped to 13 canonical names via a static lookup table.
- **Amounts:** Mixed formats — `$1,234.56`, `USD 500`, `(42.00)` for negatives, `TBD`, scientific notation artifacts. Stripped to integer cents; negatives stored as absolute values with a flag; amounts > $50K flagged as outliers.
- **Dates:** Six formats parsed (YYYY-MM-DD, MM/DD/YYYY, M/D/YY, DD-MM-YYYY, ISO timestamps, spelled-out months). Years >= 2028 flagged as suspicious.
- **Reasons:** Free-text reason strings (e.g. "Shortage - Product", "frieght", "price discrepancy") mapped to 10 canonical codes via `dispute_reasons.json`.
- **Deleted records:** `is_deleted` in various formats (boolean, string, integer) excluded at seed time.

Normalizing at seed time means every query works with clean data without per-request overhead. Data quality flags (`has_data_issues`, `data_issue_notes`) let analysts see what was cleaned.

## Dispute Lifecycle State Machine

**Chose:** A linear state machine with three terminal states: `new → in_review → submitted → accepted | partial | rejected`.

**Considered:** Free-form status field, or a more granular workflow with sub-states (e.g. "awaiting_documents", "escalated").

**Why:** The dispute process maps directly to real-world steps: an analyst creates a dispute (new), reviews documentation internally (in_review), sends it to the retailer (submitted), then records the outcome. The three terminal states cover the actual outcomes — full recovery, partial recovery, or rejection. Transitions are enforced server-side; no skipping steps, no going backward. Sub-states were deferred because the current user base is small and free-text notes on each transition capture context that sub-states would over-formalize.

## Outlier Exclusion from Dashboard Aggregates

**Chose:** Exclude deductions where `data_issue_notes` contains "outlier" from all dashboard SUM/aggregate calculations. Include them in the total deduction count and report them separately as `excluded_outliers: { count, amount }`.

**Considered:** Removing outliers entirely at seed time, or capping amounts at a threshold.

**Why:** 14 deductions with extreme amounts (up to ~$1B from scientific notation parsing artifacts) were skewing dashboard totals by orders of magnitude. Excluding from aggregates fixes the dashboard while keeping outliers visible in the deductions list with their data quality badge — analysts can still inspect and act on them individually. The `excluded_outliers` field makes the exclusion transparent rather than silently hiding data. Capping was rejected because it would fabricate amounts; seed-time deletion was rejected because the underlying records may be legitimate deductions with bad amount data that analysts should review.

## Multi-Dispute Per Deduction

**Chose:** Allow multiple dispute attempts per deduction, tracked via `amount_remaining_cents` on the deduction. Each new dispute uses the remaining balance as its disputed amount.

**Considered:** Keeping the one-dispute-per-deduction model and adding a "reopen" action.

**Why:** When a dispute resolves as "partial" (e.g. $300 recovered of $615.81), the analyst needs a path to pursue the remaining $315.81. A "reopen" model would muddy the history — was the second attempt for the same amount? Different terms? Multiple dispute rows give a clean audit trail: each attempt has its own status, amounts, notes, and activity log. The `amount_remaining_cents` column is updated transactionally when a dispute resolves, and the UI blocks new disputes when there's already an open one or nothing left to recover. The UNIQUE constraint on `disputes.deduction_id` was removed via a table recreation migration (SQLite doesn't support DROP CONSTRAINT).

## Status Column Removed from Deductions List

**Chose:** Remove the `original_status` column from the deductions list table entirely. Keep it on the detail page labeled "Original Status (source data)".

**Considered:** Normalizing the raw status values into a clean set.

**Why:** The `original_status` field is raw reference data from the source system — messy, inconsistent values like "COMPLETE", "Dispute - Filing in progress", "dispute", "Open". Normalizing it would make it look like another actionable status alongside Dispute, which defeats the purpose. The Dispute column is the single source of truth for where a deduction stands in our workflow. The raw status is preserved on the detail page as informational context, clearly labeled as source data.

## Visual Design System (Calm Financial Palette)

**Chose:** A single warm, muted color system applied through CSS variables and a centralized `lib/status.ts` helper. Warm off-white background (#FAFAF8), white cards with a soft #E8E6E0 border, slate-blue primary accent (#5B7B9C), charcoal body text (#2D2D2A), and a fixed set of desaturated status colors (lavender/amber/sage/ochre/terracotta) registered as Tailwind theme colors (`status-new`, `status-active`, `status-accepted`, `status-partial`, `status-rejected`) so the same hue appears everywhere a given status is shown — badges, dashboard stat cards, chart marks, and the dispute timeline. Dollar amounts use `tabular-nums` so columns align.

**Considered:** Keeping the default shadcn monochrome theme; using per-component saturated Tailwind palette classes (blue-100/purple-100/etc.) as the code originally did.

**Why:** This is a tool analysts stare at for hours, so the goal is low-fatigue calm and instant scannability, not visual punch. Saturated per-component colors made each surface pick its own blues and purples, so the app didn't read as one system and status meaning wasn't consistent (amber meant different things in different places). Centralizing the palette in CSS variables + one status helper means a status has exactly one color across the entire app, and the muted tones keep large data tables restful. The Dispute History was also restructured from a flat "Attempt 1 / Attempt 2" list into a connected vertical timeline — colored dots on a rail, each attempt in a card tinted with its own status color, and a distinct sage "Fully recovered" banner — so an analyst can read the arc of a multi-attempt dispute at a glance. This was a visual/color pass only; no layout, data, or interaction changed.

---

## Considered but Deferred

### CSV Import with Session-Based Data Isolation

A natural next step would be letting analysts upload new deduction CSVs directly rather than seeding from a static JSON file. This would require a generic column-mapping UI (letting users match arbitrary CSV headers to our schema fields), type inference for amounts/dates, and session-based data isolation so one upload doesn't corrupt another. Deferred because the current hand-tuned normalizer in `normalize.ts` handles the known data formats well, and building a generic import pipeline is a significantly larger effort that wasn't justified given the time constraints. The normalize/seed approach works for the current single-dataset use case.

### Editing Deduction Fields (e.g. invoice_number)

Field completeness analysis showed ~8% of records have no usable invoice_number (various null-like values: "n/a", "", "-", "None"). This is a real-world gap — analysts may later receive the correct invoice number from a retailer's remittance detail — but we chose not to build editing for this assessment.

Reasoning: editable fields on financial records require an audit trail (who/when/old value/new value) to be responsible, following the same pattern as dispute_activity_log. Without that, edits would silently destroy the provenance of the original imported data — worse than leaving the field read-only. The dispute workflow itself doesn't block on invoice_number being present, so this isn't an urgent gap. A production version would add field-level edit history alongside the existing dispute activity log.
