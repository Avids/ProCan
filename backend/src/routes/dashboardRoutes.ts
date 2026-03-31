import { Router } from 'express';
import { getDashboardSummary } from '../controllers/dashboardController';
import { authenticate } from '../middleware/auth';

const router = Router();

// /api/v1/dashboard/summary
router.get('/summary', authenticate, getDashboardSummary);

export default router;
