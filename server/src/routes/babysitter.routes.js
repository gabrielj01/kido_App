// server/src/routes/babysitter.routes.js
import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import { listBabysitters } from "../controllers/babysitter.controller.js";

const router = Router();

router.get("/", authMiddleware, listBabysitters);
router.get("/:id", authMiddleware, async (req, res) => {
   try {
     const { id } = req.params;
     const doc =
       (await Babysitter.findById(id).lean())
       // If sitters are in the users collection, switch to User:
       // (await User.findById(id).lean())
     ;
     if (!doc) return res.status(404).json({ error: "Babysitter not found" });
     res.json({ data: doc });
   } catch (e) {
     res.status(500).json({ error: e.message || "Server error" });
   }
});

export default router;
