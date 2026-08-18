import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const db = getDb();
  const companyFilter = req.query.company_id ? Number(req.query.company_id) : null;
  const companyCond = companyFilter !== null ? 'AND d.company_id = ?' : '';
  const params = companyFilter !== null ? [companyFilter] : [];
  const noOutlier = "AND (d.data_issue_notes IS NULL OR d.data_issue_notes NOT LIKE '%outlier%')";
  const isOutlier = "AND d.data_issue_notes LIKE '%outlier%'";

  const totals = (await db.execute({
    sql: `SELECT COUNT(*) AS total_deductions_count, COALESCE(SUM(d.amount_cents), 0) AS total_deductions_amount
          FROM deductions d WHERE 1=1 ${companyCond} ${noOutlier}`,
    args: params,
  })).rows[0];

  const outliers = (await db.execute({
    sql: `SELECT COUNT(*) AS count, COALESCE(SUM(d.amount_cents), 0) AS amount
          FROM deductions d WHERE 1=1 ${companyCond} ${isOutlier}`,
    args: params,
  })).rows[0];

  const disputed = (await db.execute({
    sql: `SELECT COUNT(*) AS disputed_count,
            COALESCE(SUM(dis.amount_disputed_cents), 0) AS disputed_amount,
            COALESCE(SUM(dis.amount_recovered_cents), 0) AS recovered_amount
          FROM disputes dis JOIN deductions d ON d.id = dis.deduction_id
          WHERE 1=1 ${companyCond} ${noOutlier}`,
    args: params,
  })).rows[0] as any;

  const recoveryRate = disputed.disputed_amount > 0
    ? Math.round((Number(disputed.recovered_amount) / Number(disputed.disputed_amount)) * 10000) / 10000
    : 0;

  const byStatus = (await db.execute({
    sql: `SELECT dis.status, COUNT(*) AS count, COALESCE(SUM(dis.amount_disputed_cents), 0) AS amount
          FROM disputes dis JOIN deductions d ON d.id = dis.deduction_id
          WHERE 1=1 ${companyCond} ${noOutlier}
          GROUP BY dis.status ORDER BY count DESC`,
    args: params,
  })).rows;

  const byRetailer = (await db.execute({
    sql: `SELECT r.canonical_name AS retailer, r.type AS retailer_type, r.region AS retailer_region,
            COUNT(*) AS count, COALESCE(SUM(d.amount_cents), 0) AS amount,
            COALESCE(SUM(CASE WHEN dd.dispute_count > 0 THEN d.amount_cents ELSE 0 END), 0) AS disputed,
            COALESCE(SUM(dd.total_recovered), 0) AS recovered
          FROM deductions d
          LEFT JOIN retailers r ON r.id = d.retailer_id
          LEFT JOIN (
            SELECT deduction_id, COUNT(*) AS dispute_count,
              COALESCE(SUM(amount_recovered_cents), 0) AS total_recovered
            FROM disputes GROUP BY deduction_id
          ) dd ON dd.deduction_id = d.id
          WHERE 1=1 ${companyCond} ${noOutlier}
          GROUP BY r.canonical_name ORDER BY amount DESC`,
    args: params,
  })).rows;

  const byReason = (await db.execute({
    sql: `SELECT dr.label AS reason, dr.code, COUNT(*) AS count,
            COALESCE(SUM(d.amount_cents), 0) AS amount, dr.typically_disputable
          FROM deductions d
          LEFT JOIN dispute_reasons dr ON dr.code = d.reason_code
          WHERE 1=1 ${companyCond} ${noOutlier}
          GROUP BY dr.code ORDER BY amount DESC`,
    args: params,
  })).rows;

  const undisputed = (await db.execute({
    sql: `SELECT COUNT(*) AS count, COALESCE(SUM(d.amount_cents), 0) AS amount
          FROM deductions d
          JOIN dispute_reasons dr ON dr.code = d.reason_code
          WHERE dr.typically_disputable = 1
            AND NOT EXISTS (SELECT 1 FROM disputes WHERE deduction_id = d.id)
            ${companyCond} ${noOutlier}`,
    args: params,
  })).rows[0];

  const recoveryTimeline = (await db.execute({
    sql: `SELECT strftime('%Y-W%W', dis.resolved_at) AS week,
            MIN(date(dis.resolved_at)) AS week_start,
            COALESCE(SUM(dis.amount_recovered_cents), 0) AS recovered
          FROM disputes dis JOIN deductions d ON d.id = dis.deduction_id
          WHERE dis.status IN ('accepted', 'partial') AND dis.resolved_at IS NOT NULL
            ${companyCond} ${noOutlier}
          GROUP BY strftime('%Y-W%W', dis.resolved_at) ORDER BY week`,
    args: params,
  })).rows as any[];

  let cumulative = 0;
  const recovery_timeline = recoveryTimeline.map((row) => {
    cumulative += Number(row.recovered);
    return { week: row.week_start, recovered: Number(row.recovered), cumulative };
  });

  res.json({
    total_deductions_count: Number((totals as any).total_deductions_count),
    total_deductions_amount: Number((totals as any).total_deductions_amount),
    excluded_outliers: outliers,
    disputed_count: Number(disputed.disputed_count),
    disputed_amount: Number(disputed.disputed_amount),
    recovered_amount: Number(disputed.recovered_amount),
    recovery_rate: recoveryRate,
    by_status: byStatus,
    by_retailer: byRetailer,
    by_reason: byReason,
    undisputed_disputable: undisputed,
    recovery_timeline,
  });
}
