import { Router } from 'express';
import { createEmployee, getEmployees } from '../controllers/employeeController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.post('/', createEmployee);
router.get('/', getEmployees);

export default router;
