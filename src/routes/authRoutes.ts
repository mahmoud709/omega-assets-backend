import { Router } from 'express';
import { register, login, setupAdmin } from '../controllers/authController';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/setup', setupAdmin);

export default router;