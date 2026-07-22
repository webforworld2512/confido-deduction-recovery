import { Router } from 'express';
import db from '../db';

const router = Router();

router.get('/api/companies', (_req, res) => {
  const rows = db.prepare('SELECT * FROM companies WHERE is_active = 1 ORDER BY name').all();
  res.json({ data: rows });
});

export default router;
