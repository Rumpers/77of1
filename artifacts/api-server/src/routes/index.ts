import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import creditsRouter from "./credits.js";
import paymentsRouter from "./payments.js";
import onboardingRouter from "./onboarding.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(creditsRouter);
router.use(paymentsRouter);
router.use(onboardingRouter);

export default router;
