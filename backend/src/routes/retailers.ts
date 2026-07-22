import { Router } from 'express';
import db from '../db';

const router = Router();

router.get('/api/retailers', (_req, res) => {
  const rows = db.prepare('SELECT id, canonical_name, type, region FROM retailers ORDER BY canonical_name').all();
  res.json({ data: rows });
});

export default router;
