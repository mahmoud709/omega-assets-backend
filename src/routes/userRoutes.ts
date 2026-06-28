import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/userController';

const router = Router();

router.use(authenticate);
router.use(authorize('admin')); // Only admins can manage users

router.get('/', getUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
