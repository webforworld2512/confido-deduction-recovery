import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../_lib/db';

const VALID_TRANSITIONS: Record<string, string[]> = {
  new: ['in_review'],
  in_review: ['submitted'],
  submitted: ['accepted', 'partial', 'rejected'],
};

const TERMINAL_STATUSES = new Set(['accepted', 'partial', 'rejected']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const db = getDb();
  const disputeId = Number(req.query.id);
  const { status, amount_recovered_cents, notes } = req.body ?? {};

  const disputeResult = await db.execute({
    sql: 'SELECT * FROM disputes WHERE id = ?',
    args: [disputeId],
  });
  if (disputeResult.rows.length === 0) {
    return res.status(404).json({ error: 'Dispute not found' });
  }
  const dispute = disputeResult.rows[0] as any;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  const allowed = VALID_TRANSITIONS[dispute.status as string];
  if (!allowed || !allowed.includes(status)) {
    return res.status(400).json({
      error: `Invalid transition: ${dispute.status} → ${status}. Allowed: ${(allowed ?? []).join(', ') || 'none (terminal state)'}`,
    });
  }

  if (status === 'partial' && (amount_recovered_cents == null || amount_recovered_cents <= 0)) {
    return res.status(400).json({ error: 'amount_recovered_cents is required and must be > 0 for partial recovery' });
  }

  const now = new Date().toISOString();
  const resolvedAt = TERMINAL_STATUSES.has(status) ? now : null;

  const sets = ['status = ?', 'updated_at = ?'];
  const updateParams: any[] = [status, now];

  if (resolvedAt) {
    sets.push('resolved_at = ?');
    updateParams.push(resolvedAt);
  }
  if (amount_recovered_cents !== undefined) {
    sets.push('amount_recovered_cents = ?');
    updateParams.push(amount_recovered_cents);
  }
  if (notes !== undefined) {
    sets.push('notes = ?');
    updateParams.push(notes);
  }

  updateParams.push(disputeId);

  const statements: any[] = [
    {
      sql: `UPDATE disputes SET ${sets.join(', ')} WHERE id = ?`,
      args: updateParams,
    },
  ];

  if (TERMINAL_STATUSES.has(status) && amount_recovered_cents != null && amount_recovered_cents > 0) {
    statements.push({
      sql: `UPDATE deductions SET amount_remaining_cents = MAX(0, COALESCE(amount_remaining_cents, amount_cents) - ?) WHERE id = ?`,
      args: [amount_recovered_cents, Number(dispute.deduction_id)],
    });
  }

  statements.push({
    sql: `INSERT INTO dispute_activity_log (dispute_id, from_status, to_status, note, created_at) VALUES (?, ?, ?, ?, ?)`,
    args: [disputeId, dispute.status, status, notes ?? null, now],
  });

  await db.batch(statements, 'write');

  const updated = (await db.execute({
    sql: 'SELECT * FROM disputes WHERE id = ?',
    args: [disputeId],
  })).rows[0];

  res.json(updated);
}
