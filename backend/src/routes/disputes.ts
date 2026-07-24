import { Router } from 'express';
import db from '../db';

const router = Router();

const VALID_TRANSITIONS: Record<string, string[]> = {
  new: ['in_review'],
  in_review: ['submitted'],
  submitted: ['accepted', 'partial', 'rejected'],
};

const TERMINAL_STATUSES = new Set(['accepted', 'partial', 'rejected']);

router.post('/api/deductions/:id/dispute', (req, res) => {
  const deductionId = Number(req.params.id);
  const { notes } = req.body ?? {};

  const deduction = db.prepare('SELECT id, amount_cents, amount_remaining_cents FROM deductions WHERE id = ?').get(deductionId) as any;
  if (!deduction) {
    res.status(404).json({ error: 'Deduction not found' });
    return;
  }

  if ((deduction.amount_remaining_cents ?? 0) <= 0) {
    res.status(409).json({ error: 'Fully recovered — nothing left to dispute' });
    return;
  }

  const openDispute = db.prepare(
    "SELECT id FROM disputes WHERE deduction_id = ? AND status NOT IN ('accepted','partial','rejected')"
  ).get(deductionId);
  if (openDispute) {
    res.status(409).json({ error: 'An open dispute already exists for this deduction' });
    return;
  }

  const hasResolvedDispute = db.prepare(
    "SELECT id FROM disputes WHERE deduction_id = ? AND status IN ('accepted','partial','rejected') LIMIT 1"
  ).get(deductionId);
  if (hasResolvedDispute && (!notes || !notes.trim())) {
    res.status(400).json({ error: 'Notes are required when re-disputing a previously resolved deduction' });
    return;
  }

  const disputeAmount = deduction.amount_remaining_cents;
  const now = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO disputes (deduction_id, status, amount_disputed_cents, notes, created_at, updated_at)
    VALUES (?, 'new', ?, ?, ?, ?)
  `).run(deductionId, disputeAmount, notes ?? null, now, now);

  db.prepare(`
    INSERT INTO dispute_activity_log (dispute_id, from_status, to_status, note, created_at)
    VALUES (?, NULL, 'new', ?, ?)
  `).run(result.lastInsertRowid, notes ?? 'Dispute created', now);

  const dispute = db.prepare('SELECT * FROM disputes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(dispute);
});

router.patch('/api/disputes/:id', (req, res) => {
  const disputeId = Number(req.params.id);
  const { status, amount_recovered_cents, notes } = req.body ?? {};

  const dispute = db.prepare('SELECT * FROM disputes WHERE id = ?').get(disputeId) as any;
  if (!dispute) {
    res.status(404).json({ error: 'Dispute not found' });
    return;
  }

  if (!status) {
    res.status(400).json({ error: 'Status is required' });
    return;
  }

  const allowed = VALID_TRANSITIONS[dispute.status];
  if (!allowed || !allowed.includes(status)) {
    res.status(400).json({
      error: `Invalid transition: ${dispute.status} → ${status}. Allowed: ${(allowed ?? []).join(', ') || 'none (terminal state)'}`,
    });
    return;
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

  const txn = db.transaction(() => {
    db.prepare(`UPDATE disputes SET ${sets.join(', ')} WHERE id = ?`).run(...updateParams);

    if (TERMINAL_STATUSES.has(status) && amount_recovered_cents != null && amount_recovered_cents > 0) {
      db.prepare(`
        UPDATE deductions
        SET amount_remaining_cents = MAX(0, COALESCE(amount_remaining_cents, amount_cents) - ?)
        WHERE id = ?
      `).run(amount_recovered_cents, dispute.deduction_id);
    }

    db.prepare(`
      INSERT INTO dispute_activity_log (dispute_id, from_status, to_status, note, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(disputeId, dispute.status, status, notes ?? null, now);
  });
  txn();

  const updated = db.prepare('SELECT * FROM disputes WHERE id = ?').get(disputeId);
  res.json(updated);
});

router.get('/api/disputes', (req, res) => {
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

  const rows = db.prepare(`
    SELECT
      dis.*,
      d.invoice_number,
      d.amount_cents AS deduction_amount_cents,
      d.amount_remaining_cents,
      d.deducted_at,
      d.reason_code,
      c.name AS company_name,
      r.canonical_name AS retailer_name
    FROM disputes dis
    JOIN deductions d ON d.id = dis.deduction_id
    LEFT JOIN companies c ON c.id = d.company_id
    LEFT JOIN retailers r ON r.id = d.retailer_id
    ${where}
    ORDER BY dis.updated_at DESC
  `).all(...params);

  res.json({ data: rows, total: rows.length });
});

export default router;
