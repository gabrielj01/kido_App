import { Router } from "express";
import { checkEmailAvailability, checkUsernameAvailability } from "../controllers/validationController.js";


const router = Router();
router.get("/email", checkEmailAvailability);
router.get("/username", checkUsernameAvailability);
export default router;
