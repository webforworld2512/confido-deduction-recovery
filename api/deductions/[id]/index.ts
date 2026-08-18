import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const db = getDb();
  const id = Number(req.query.id);

  const deductionResult = await db.execute({
    sql: `SELECT d.*, c.name AS company_name, c.slug AS company_slug, c.erp_system, c.default_currency,
            r.canonical_name AS retailer_name, r.type AS retailer_type, r.region AS retailer_region,
            dr.label AS reason_label, dr.category AS reason_category, dr.typically_disputable
          FROM deductions d
          LEFT JOIN companies c ON c.id = d.company_id
          LEFT JOIN retailers r ON r.id = d.retailer_id
          LEFT JOIN dispute_reasons dr ON dr.code = d.reason_code
          WHERE d.id = ?`,
    args: [id],
  });

  if (deductionResult.rows.length === 0) {
    return res.status(404).json({ error: 'Deduction not found' });
  }

  const deduction = deductionResult.rows[0] as any;

  const disputesResult = await db.execute({
    sql: 'SELECT * FROM disputes WHERE deduction_id = ? ORDER BY created_at DESC',
    args: [id],
  });
  const disputes = disputesResult.rows as any[];

  const disputeIds = disputes.map((d) => d.id);
  let activityRows: any[] = [];
  if (disputeIds.length > 0) {
    const placeholders = disputeIds.map(() => '?').join(',');
    activityRows = (await db.execute({
      sql: `SELECT * FROM dispute_activity_log WHERE dispute_id IN (${placeholders}) ORDER BY created_at ASC`,
      args: disputeIds,
    })).rows as any[];
  }

  const activityByDispute = new Map<number, any[]>();
  for (const row of activityRows) {
    const did = Number(row.dispute_id);
    const list = activityByDispute.get(did) ?? [];
    list.push(row);
    activityByDispute.set(did, list);
  }

  const disputesWithLogs = disputes.map((d) => ({
    ...d,
    activity_log: activityByDispute.get(Number(d.id)) ?? [],
  }));

  res.json({ ...deduction, disputes: disputesWithLogs });
}
