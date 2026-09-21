import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
   createSupplyOrder,
   createIssueOrder,
   createTransferOrder,
   getTransactions,
   getTransactionById,
} from '../controllers/warehouseTransactionController';

const router = Router();

router.use(authenticate);

router.post('/supply', authorize('admin', 'site_manager', 'storekeeper'), createSupplyOrder);
router.post('/issue', authorize('admin', 'site_manager', 'storekeeper'), createIssueOrder);
router.post('/transfer', authorize('admin', 'site_manager', 'storekeeper'), createTransferOrder);

router.get('/', getTransactions);
router.get('/:id', getTransactionById);

export default router;
