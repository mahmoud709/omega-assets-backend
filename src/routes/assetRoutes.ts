import { Router } from 'express';
import { authenticate, optionalAuthenticate, authorize } from '../middleware/auth';
import {
   createAsset,
   getAssets,
   getAssetById,
   updateAsset,
   deleteAsset,
   assignCustodian,
   bulkCreateAssets,
   findDuplicateAssets,
   reorderAssets,
   reconcilePreviewAssets,
   reconcileApplyAssets,
   bulkDeleteAssets,
} from '../controllers/assetController';
import { upload } from '../middleware/upload';

const router = Router();

// Reorder endpoint (declared first to guarantee exact route matching)
router.post('/reorder', authenticate, authorize('admin', 'site_manager', 'viewer'), reorderAssets);
router.put('/reorder', authenticate, authorize('admin', 'site_manager', 'viewer'), reorderAssets);

// Reconcile / Diff Sync endpoints
router.post('/reconcile-preview', authenticate, authorize('admin', 'site_manager', 'viewer'), reconcilePreviewAssets);
router.post('/reconcile-apply', authenticate, authorize('admin', 'site_manager', 'viewer'), reconcileApplyAssets);

// Public / Read-only routes (QR code scans and matrix report)
router.get('/', optionalAuthenticate, getAssets);
router.get('/:id', getAssetById);

router.use(authenticate);
router.get('/duplicates', authorize('admin', 'site_manager', 'viewer'), findDuplicateAssets);
router.post('/bulk', authorize('admin', 'site_manager', 'viewer'), bulkCreateAssets);
router.post('/bulk-delete', authorize('admin', 'site_manager'), bulkDeleteAssets);

router.post('/', authorize('admin', 'site_manager', 'viewer'), upload.single('image'), createAsset);

router.put('/:id', authorize('admin', 'site_manager', 'viewer'), updateAsset);
router.delete('/:id', authorize('admin', 'site_manager', 'viewer'), deleteAsset);
router.post('/:id/assign-custodian', authorize('admin', 'site_manager', 'viewer'), assignCustodian);

export default router;