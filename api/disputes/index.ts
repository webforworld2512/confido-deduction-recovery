import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const db = getDb();
  const conditions: string[] = [];
  const params: any[] = [];

  if (req.query.status) {
    conditions.push('dis.status = ?');
    params.push(req.query.status);
  }
  if (req.query.company_id) {
    conditions.push('d.company_id = ?');
    params.push(Number(req.query.company_id));
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const rows = (await db.execute({
    sql: `SELECT dis.*, d.invoice_number, d.amount_cents AS deduction_amount_cents,
            d.amount_remaining_cents, d.deducted_at, d.reason_code,
            c.name AS company_name, r.canonical_name AS retailer_name
          FROM disputes dis
          JOIN deductions d ON d.id = dis.deduction_id
          LEFT JOIN companies c ON c.id = d.company_id
          LEFT JOIN retailers r ON r.id = d.retailer_id
          ${where}
          ORDER BY dis.updated_at DESC`,
    args: params,
  })).rows;

  res.json({ data: rows, total: rows.length });
}
