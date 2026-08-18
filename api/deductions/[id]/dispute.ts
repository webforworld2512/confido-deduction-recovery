import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const db = getDb();
  const deductionId = Number(req.query.id);
  const { notes } = req.body ?? {};

  const deductionResult = await db.execute({
    sql: 'SELECT id, amount_cents, amount_remaining_cents FROM deductions WHERE id = ?',
    args: [deductionId],
  });
  if (deductionResult.rows.length === 0) {
    return res.status(404).json({ error: 'Deduction not found' });
  }
  const deduction = deductionResult.rows[0] as any;

  if ((Number(deduction.amount_remaining_cents) ?? 0) <= 0) {
    return res.status(409).json({ error: 'Fully recovered — nothing left to dispute' });
  }

  const openDispute = await db.execute({
    sql: "SELECT id FROM disputes WHERE deduction_id = ? AND status NOT IN ('accepted','partial','rejected')",
    args: [deductionId],
  });
  if (openDispute.rows.length > 0) {
    return res.status(409).json({ error: 'An open dispute already exists for this deduction' });
  }

  const hasResolved = await db.execute({
    sql: "SELECT id FROM disputes WHERE deduction_id = ? AND status IN ('accepted','partial','rejected') LIMIT 1",
    args: [deductionId],
  });
  if (hasResolved.rows.length > 0 && (!notes || !notes.trim())) {
    return res.status(400).json({ error: 'Notes are required when re-disputing a previously resolved deduction' });
  }

  const disputeAmount = Number(deduction.amount_remaining_cents);
  const now = new Date().toISOString();

  const results = await db.batch([
    {
      sql: `INSERT INTO disputes (deduction_id, status, amount_disputed_cents, notes, created_at, updated_at)
            VALUES (?, 'new', ?, ?, ?, ?)`,
      args: [deductionId, disputeAmount, notes ?? null, now, now],
    },
  ], 'write');

  const insertedId = Number(results[0].lastInsertRowid);

  await db.execute({
    sql: `INSERT INTO dispute_activity_log (dispute_id, from_status, to_status, note, created_at)
          VALUES (?, NULL, 'new', ?, ?)`,
    args: [insertedId, notes ?? 'Dispute created', now],
  });

  const dispute = (await db.execute({
    sql: 'SELECT * FROM disputes WHERE id = ?',
    args: [insertedId],
  })).rows[0];

  res.status(201).json(dispute);
}
