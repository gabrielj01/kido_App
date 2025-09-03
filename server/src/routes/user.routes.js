import express from 'express';
import authMiddleware from "../middlewares/auth.middleware.js";
import { deleteMyPhoto, getUserById, updateUserById, getMe, updateMe } from '../controllers/userController.js';
import { upload } from "../config/upload.js";
import { uploadUserPhoto } from '../controllers/userController.js';
import { listUsers } from '../controllers/userController.js';

const router = express.Router();

// GET /api/user/me
router.get("/", authMiddleware, listUsers);
router.get('/me', authMiddleware, getMe);
router.put('/me', authMiddleware, updateMe);
router.post('/me/photo', authMiddleware, upload.single('photo'), uploadUserPhoto);
router.delete('/me/photo', authMiddleware, deleteMyPhoto);

// Public-ish by id + secured update
router.get('/:id', authMiddleware, getUserById);
router.put('/:id', authMiddleware, updateUserById);
export default router;
