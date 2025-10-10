import { Router } from "express";
import { checkEmailAvailability, checkUsernameAvailability, checkPhoneAvailability } from "../controllers/validationController.js";


const router = Router();
router.get("/email", checkEmailAvailability);
router.get("/username", checkUsernameAvailability);
router.get("/phone", checkPhoneAvailability);
export default router;
