import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import {
  getUserById,
  updateUserById,
  getMe,
  updateMe,
  listUsers,
} from "../controllers/userController.js";

const router = express.Router();

// List users
router.get("/", authMiddleware, listUsers);

// Me
router.get("/me", authMiddleware, getMe);
router.put("/me", authMiddleware, updateMe);

// By id
router.get("/:id", authMiddleware, getUserById);
router.put("/:id", authMiddleware, updateUserById);

export default router;
