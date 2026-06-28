import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
   createCategory,
   getCategories,
   getCategoryById,
   updateCategory,
   deleteCategory,
} from '../controllers/categoryController';

const router = Router();

router.use(authenticate);

router.post('/', authorize('admin', 'site_manager'), createCategory);
router.get('/', getCategories);
router.get('/:id', getCategoryById);
router.put('/:id', authorize('admin', 'site_manager'), updateCategory);
router.delete('/:id', authorize('admin'), deleteCategory);

export default router;
