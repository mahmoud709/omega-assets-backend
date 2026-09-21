import { Router } from 'express';
import { authenticate, optionalAuthenticate, authorize } from '../middleware/auth';
import {
   createProject,
   getProjects,
   getProjectById,
   getProjectNames,
   updateProject,
   deleteProject,
} from '../controllers/projectController';

const router = Router();

// Public / Read-only routes
router.get('/', optionalAuthenticate, getProjects);
router.get('/names', authenticate, getProjectNames);
router.get('/:id', optionalAuthenticate, getProjectById);

router.use(authenticate);

router.post('/', authorize('admin', 'site_manager'), createProject);
router.put('/:id', authorize('admin', 'site_manager'), updateProject);
router.delete('/:id', authorize('admin'), deleteProject);

export default router;
