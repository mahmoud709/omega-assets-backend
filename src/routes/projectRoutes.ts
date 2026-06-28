import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
   createProject,
   getProjects,
   getProjectById,
   updateProject,
   deleteProject,
} from '../controllers/projectController';

const router = Router();

router.use(authenticate);

router.post('/', authorize('admin', 'site_manager'), createProject);
router.get('/', getProjects);
router.get('/:id', getProjectById);
router.put('/:id', authorize('admin', 'site_manager'), updateProject);
router.delete('/:id', authorize('admin'), deleteProject);

export default router;
