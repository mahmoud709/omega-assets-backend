import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
   transferCustody,
   getCustodyHistory,
   getCurrentCustodian,
   returnCustody,
} from '../controllers/custodyController';

const router = Router();

router.use(authenticate);

router.post('/transfer', authorize('admin', 'site_manager'), transferCustody);
router.get('/history/:assetId', getCustodyHistory);
router.get('/current/:assetId', getCurrentCustodian);
router.post('/return/:assetId', authorize('admin', 'site_manager'), returnCustody);

export default router;
