import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
   getInventoryByProject,
   getFinancialValuation,
   exportInventorySheet,
   getDashboardStats,
} from '../controllers/reportController';

const router = Router();

router.use(authenticate);

router.get('/inventory/:projectId', getInventoryByProject);
router.get('/valuation', getFinancialValuation);
router.get('/export', authorize('admin', 'site_manager'), exportInventorySheet);
router.get('/dashboard-stats', getDashboardStats);

export default router;
