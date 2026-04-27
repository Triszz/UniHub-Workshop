import { Router } from "express";
import { verifyJWT, requireRole } from "../../shared/middleware/auth";
import { processPaymentHandler } from "./payment.controller";

const router = Router();

router.use(verifyJWT);

// Mock payment: POST /api/v1/payments/:registrationId
router.post("/:registrationId", requireRole("student"), processPaymentHandler);

export default router;
