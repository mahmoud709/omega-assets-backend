import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
   transferCustody,
   getCustodyHistory,
   getCurrentCustodian,
   returnCustody,
   withdrawCustody,
} from '../controllers/custodyController';

const router = Router();

// Public route for QR Code scans
router.get('/history/:assetId', getCustodyHistory);

router.use(authenticate);

router.post('/transfer', authorize('admin', 'site_manager'), transferCustody);
// router.get('/history/:assetId', getCustodyHistory); (moved up)
router.get('/current/:assetId', getCurrentCustodian);
router.post('/return/:assetId', authorize('admin', 'site_manager'), returnCustody);
router.post('/withdraw/:assetId', authorize('admin', 'site_manager'), withdrawCustody);

export default router;
