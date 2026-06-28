import { Router } from 'express';
import { createEmployee, getEmployees, getEmployeeById } from '../controllers/employeeController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.post('/', createEmployee);
router.get('/', getEmployees);
router.get('/:id', getEmployeeById);

export default router;
