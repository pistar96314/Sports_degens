import { Router } from 'express';
import { register, login } from '../../controllers/authController';
import { validate } from '../../middleware/validate';
import { registerSchema, loginSchema } from './schemas';

const router = Router();

// Public routes
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);

// TODO: OAuth routes (to be implemented later)
// router.get('/discord', discordAuth);
// router.get('/discord/callback', discordCallback);
// router.get('/google', googleAuth);
// router.get('/google/callback', googleCallback);
// router.get('/steam', steamAuth);
// router.get('/steam/callback', steamCallback);

export default router;
