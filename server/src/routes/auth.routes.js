import express from 'express';
import { signup, login } from '../controllers/auth.controller.js';
import { checkAvailability } from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);

router.get('/check-availability', checkAvailability);

export default router;
