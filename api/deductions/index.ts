import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const db = getDb();
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(10000, Math.max(1, parseInt(req.query.limit as string) || 50));
  const offset = (page - 1) * limit;

  const sortBy = req.query.sort_by === 'amount' ? 'd.amount_cents' : 'd.deducted_at';
  const sortOrder = req.query.sort_order === 'asc' ? 'ASC' : 'DESC';

  const conditions: string[] = [];
  const params: any[] = [];

  if (req.query.company_id) {
    conditions.push('d.company_id = ?');
    params.push(Number(req.query.company_id));
  }
  if (req.query.retailer_id) {
    conditions.push('d.retailer_id = ?');
    params.push(Number(req.query.retailer_id));
  }
  if (req.query.reason_code) {
    conditions.push('d.reason_code = ?');
    params.push(req.query.reason_code);
  }
  if (req.query.has_dispute === 'true') {
    conditions.push('latest_dis.id IS NOT NULL');
  } else if (req.query.has_dispute === 'false') {
    conditions.push('latest_dis.id IS NULL');
  }
  if (req.query.typically_disputable === 'true') {
    conditions.push('dr.typically_disputable = 1');
  } else if (req.query.typically_disputable === 'false') {
    conditions.push('dr.typically_disputable = 0');
  }
  if (req.query.search) {
    conditions.push('d.invoice_number LIKE ?');
    params.push(`%${req.query.search}%`);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const latestDisputeJoin = `
    LEFT JOIN disputes latest_dis ON latest_dis.deduction_id = d.id
      AND latest_dis.id = (
        SELECT id FROM disputes WHERE deduction_id = d.id ORDER BY created_at DESC LIMIT 1
      )
  `;

  const countRow = (await db.execute({
    sql: `SELECT COUNT(*) as total FROM deductions d
          ${latestDisputeJoin}
          LEFT JOIN dispute_reasons dr ON dr.code = d.reason_code
          ${where}`,
    args: params,
  })).rows[0] as any;

  const rows = (await db.execute({
    sql: `SELECT d.*, c.name AS company_name, r.canonical_name AS retailer_name,
            r.type AS retailer_type, r.region AS retailer_region,
            dr.label AS reason_label, dr.category AS reason_category, dr.typically_disputable,
            latest_dis.id AS dispute_id, latest_dis.status AS dispute_status
          FROM deductions d
          LEFT JOIN companies c ON c.id = d.company_id
          LEFT JOIN retailers r ON r.id = d.retailer_id
          LEFT JOIN dispute_reasons dr ON dr.code = d.reason_code
          ${latestDisputeJoin}
          ${where}
          ORDER BY ${sortBy} ${sortOrder}
          LIMIT ? OFFSET ?`,
    args: [...params, limit, offset],
  })).rows;

  res.json({ data: rows, total: Number(countRow.total), page, limit });
}
