# Confido Deduction Recovery Tool

## Project Overview
Internal tool for analysts to manage CPG deductions and disputes.
Node/TypeScript backend (Express + SQLite), React/TypeScript frontend (shadcn + Tailwind).

## Architecture
- Backend: /backend (Express, better-sqlite3, TypeScript)
- Frontend: /frontend (Vite, React, shadcn/ui, Tailwind)
- Data files: /backend/data/ (deductions.json, companies.json, dispute_reasons.json)

## Key Decisions
- No ORM — raw SQL with better-sqlite3
- SQLite database at /backend/confido.db
- API serves on port 3001, frontend on port 5173
- Normalize dirty data on seed, not at query time
- is_deleted=true records are excluded at seed time
- company_id 3 and 0 map to "Unknown Company"
- Amounts stored as cents (integers) to avoid float issues
- All dates normalized to YYYY-MM-DD

## Data Quality Rules
- 80+ retailer name variants → 13 canonical retailers
- Amounts: strip $, USD, commas, parens, whitespace. TBD → null. Flag outliers > $50K
- Dates: parse YYYY-MM-DD, MM/DD/YYYY, M/D/YY, DD-MM-YYYY. 2028 → flag as suspicious
- Reasons: map free-text → dispute_reasons.json codes
- Fields: retailer_name OR retailer, amount OR total_amount, reason OR deduction_reason

## Commands
- Backend: cd backend && npm run dev
- Frontend: cd frontend && npm run dev
- Seed DB: cd backend && npx ts-node src/seed.ts