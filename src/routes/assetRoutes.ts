import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
   createAsset,
   getAssets,
   getAssetById,
   updateAsset,
   deleteAsset,
   assignCustodian,
   bulkCreateAssets,
} from '../controllers/assetController';
import { upload } from '../middleware/upload';

const router = Router();

router.use(authenticate);

router.post('/bulk', authorize('admin', 'site_manager', 'viewer'), bulkCreateAssets);
router.post('/', authorize('admin', 'site_manager', 'viewer'), upload.single('image'), createAsset);
router.get('/', getAssets);
router.get('/:id', getAssetById);
router.put('/:id', authorize('admin', 'site_manager', 'viewer'), updateAsset);
router.delete('/:id', authorize('admin', 'site_manager', 'viewer'), deleteAsset);
router.post('/:id/assign-custodian', authorize('admin', 'site_manager', 'viewer'), assignCustodian);

export default router;