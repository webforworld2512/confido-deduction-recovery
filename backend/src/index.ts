import express from 'express';
import cors from 'cors';
import db from './db';
import deductionsRouter from './routes/deductions';
import disputesRouter from './routes/disputes';
import dashboardRouter from './routes/dashboard';
import companiesRouter from './routes/companies';
import retailersRouter from './routes/retailers';
import dataQualityRouter from './routes/dataQuality';

const app = express();
const PORT = 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'] }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(deductionsRouter);
app.use(disputesRouter);
app.use(dashboardRouter);
app.use(companiesRouter);
app.use(retailersRouter);
app.use(dataQualityRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
