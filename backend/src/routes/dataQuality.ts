import { Router } from 'express';
import db from '../db';

const router = Router();

router.get('/api/data-quality', (req, res) => {
  const companyFilter = req.query.company_id ? Number(req.query.company_id) : null;
  const companyCond = companyFilter !== null ? 'AND d.company_id = ?' : '';
  const params = companyFilter !== null ? [companyFilter] : [];

  const totalFlagged = db.prepare(`
    SELECT COUNT(*) AS count
    FROM deductions d
    WHERE d.has_data_issues = 1 ${companyCond}
  `).get(...params) as { count: number };

  const byType = db.prepare(`
    SELECT d.data_issue_notes
    FROM deductions d
    WHERE d.has_data_issues = 1 ${companyCond}
  `).all(...params) as { data_issue_notes: string }[];

  const typeCounts: Record<string, number> = {};
  for (const row of byType) {
    const notes = row.data_issue_notes.split('; ');
    for (const note of notes) {
      const key = note.split(':')[0].trim();
      typeCounts[key] = (typeCounts[key] || 0) + 1;
    }
  }

  const issueTypes = Object.entries(typeCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const issueFilter = req.query.issue_type as string | undefined;
  const issueCond = issueFilter ? `AND d.data_issue_notes LIKE ?` : '';
  const issueParams = issueFilter ? [...params, `%${issueFilter}%`] : [...params];

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
  const offset = (page - 1) * limit;

  const countRow = db.prepare(`
    SELECT COUNT(*) AS total
    FROM deductions d
    WHERE d.has_data_issues = 1 ${companyCond} ${issueCond}
  `).get(...issueParams) as { total: number };

  const records = db.prepare(`
    SELECT
      d.id,
      d.invoice_number,
      d.amount_cents,
      d.deducted_at,
      d.data_issue_notes,
      c.name AS company_name,
      r.canonical_name AS retailer_name,
      dr.label AS reason_label,
      dr.category AS reason_category
    FROM deductions d
    LEFT JOIN companies c ON c.id = d.company_id
    LEFT JOIN retailers r ON r.id = d.retailer_id
    LEFT JOIN dispute_reasons dr ON dr.code = d.reason_code
    WHERE d.has_data_issues = 1 ${companyCond} ${issueCond}
    ORDER BY d.id
    LIMIT ? OFFSET ?
  `).all(...issueParams, limit, offset);

  res.json({
    total_flagged: totalFlagged.count,
    issue_types: issueTypes,
    records,
    total: countRow.total,
    page,
    limit,
  });
});

export default router;
