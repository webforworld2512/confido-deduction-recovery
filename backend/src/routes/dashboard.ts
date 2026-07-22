import { Router } from 'express';
import db from '../db';

const router = Router();

router.get('/api/dashboard', (req, res) => {
  const companyFilter = req.query.company_id ? Number(req.query.company_id) : null;
  const cond = companyFilter !== null ? 'WHERE d.company_id = ?' : '';
  const params = companyFilter !== null ? [companyFilter] : [];

  const totals = db.prepare(`
    SELECT
      COUNT(*) AS total_deductions_count,
      COALESCE(SUM(d.amount_cents), 0) AS total_deductions_amount
    FROM deductions d
    ${cond}
  `).get(...params) as any;

  const disputed = db.prepare(`
    SELECT
      COUNT(*) AS disputed_count,
      COALESCE(SUM(dis.amount_disputed_cents), 0) AS disputed_amount,
      COALESCE(SUM(dis.amount_recovered_cents), 0) AS recovered_amount
    FROM disputes dis
    JOIN deductions d ON d.id = dis.deduction_id
    ${cond}
  `).get(...params) as any;

  const recoveryRate = disputed.disputed_amount > 0
    ? Math.round((disputed.recovered_amount / disputed.disputed_amount) * 10000) / 10000
    : 0;

  const byStatus = db.prepare(`
    SELECT
      dis.status,
      COUNT(*) AS count,
      COALESCE(SUM(dis.amount_disputed_cents), 0) AS amount
    FROM disputes dis
    JOIN deductions d ON d.id = dis.deduction_id
    ${cond}
    GROUP BY dis.status
    ORDER BY count DESC
  `).all(...params);

  const byRetailer = db.prepare(`
    SELECT
      r.canonical_name AS retailer,
      COUNT(*) AS count,
      COALESCE(SUM(d.amount_cents), 0) AS amount,
      COALESCE(SUM(CASE WHEN dis.id IS NOT NULL THEN d.amount_cents ELSE 0 END), 0) AS disputed,
      COALESCE(SUM(dis.amount_recovered_cents), 0) AS recovered
    FROM deductions d
    LEFT JOIN retailers r ON r.id = d.retailer_id
    LEFT JOIN disputes dis ON dis.deduction_id = d.id
    ${cond}
    GROUP BY r.canonical_name
    ORDER BY amount DESC
  `).all(...params);

  const byReason = db.prepare(`
    SELECT
      dr.label AS reason,
      dr.code,
      COUNT(*) AS count,
      COALESCE(SUM(d.amount_cents), 0) AS amount,
      dr.typically_disputable
    FROM deductions d
    LEFT JOIN dispute_reasons dr ON dr.code = d.reason_code
    ${cond}
    GROUP BY dr.code
    ORDER BY amount DESC
  `).all(...params);

  const undisputed = db.prepare(`
    SELECT
      COUNT(*) AS count,
      COALESCE(SUM(d.amount_cents), 0) AS amount
    FROM deductions d
    JOIN dispute_reasons dr ON dr.code = d.reason_code
    LEFT JOIN disputes dis ON dis.deduction_id = d.id
    ${cond.replace('WHERE', companyFilter !== null ? 'WHERE' : '')}
    ${companyFilter !== null ? 'AND' : 'WHERE'} dr.typically_disputable = 1 AND dis.id IS NULL
  `).get(...params) as any;

  res.json({
    total_deductions_count: totals.total_deductions_count,
    total_deductions_amount: totals.total_deductions_amount,
    disputed_count: disputed.disputed_count,
    disputed_amount: disputed.disputed_amount,
    recovered_amount: disputed.recovered_amount,
    recovery_rate: recoveryRate,
    by_status: byStatus,
    by_retailer: byRetailer,
    by_reason: byReason,
    undisputed_disputable: undisputed,
  });
});

export default router;
