import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
   scheduleMaintenance,
   getMaintenanceTasks,
   updateMaintenanceStatus,
   getDueMaintenance,
   reportIssue,
   deleteMaintenanceTask,
} from '../controllers/maintenanceController';

const router = Router();

router.post('/report', reportIssue);

router.use(authenticate);

router.post('/', authorize('admin', 'site_manager'), scheduleMaintenance);
router.get('/', getMaintenanceTasks);
router.get('/due', getDueMaintenance);
router.put('/:id', authorize('admin', 'site_manager'), updateMaintenanceStatus);
router.delete('/:id', authorize('admin', 'site_manager'), deleteMaintenanceTask);

export default router;
