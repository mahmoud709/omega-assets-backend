import { Router } from 'express';
import { getCompanySettings, updateCompanySettings, uploadCompanyLogo } from '../controllers/companySettingsController';
import { authenticate, authorize } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

// Public — anyone who scans the QR can fetch settings
router.get('/', getCompanySettings);

// Admin only — save changes
router.put('/', authenticate, authorize('admin'), updateCompanySettings);

// Admin only — upload logo file
router.post('/logo', authenticate, authorize('admin'), upload.single('logo'), uploadCompanyLogo);

export default router;
