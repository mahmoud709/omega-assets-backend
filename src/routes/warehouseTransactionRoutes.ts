import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
   createSupplyOrder,
   createIssueOrder,
   createTransferOrder,
   approveTransfer,
   rejectTransfer,
   getTransactions,
   getTransactionById,
} from '../controllers/warehouseTransactionController';

const router = Router();

router.use(authenticate);

router.post('/supply', authorize('admin', 'site_manager', 'storekeeper'), createSupplyOrder);
router.post('/issue', authorize('admin', 'site_manager', 'storekeeper'), createIssueOrder);
router.post('/transfer', authorize('admin', 'site_manager', 'storekeeper'), createTransferOrder);

router.put('/transfer/:id/approve', authorize('admin', 'site_manager', 'storekeeper'), approveTransfer);
router.put('/transfer/:id/reject', authorize('admin', 'site_manager', 'storekeeper'), rejectTransfer);

router.get('/', getTransactions);
router.get('/:id', getTransactionById);

export default router;
