import { Router } from 'express';
import { authenticate, optionalAuthenticate, authorize } from '../middleware/auth';
import {
   createCategory,
   getCategories,
   getCategoryById,
   updateCategory,
   deleteCategory,
} from '../controllers/categoryController';

const router = Router();

// Public / Read-only routes
router.get('/', optionalAuthenticate, getCategories);
router.get('/:id', optionalAuthenticate, getCategoryById);

router.use(authenticate);

router.post('/', authorize('admin', 'site_manager'), createCategory);
router.put('/:id', authorize('admin', 'site_manager'), updateCategory);
router.delete('/:id', authorize('admin'), deleteCategory);

export default router;
