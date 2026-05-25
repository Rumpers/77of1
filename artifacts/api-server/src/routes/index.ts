import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import creditsRouter from "./credits.js";
import paymentsRouter from "./payments.js";
import twofaRouter from "./twofa.js";
import onboardingRouter from "./onboarding.js";
import creatorRouter from "./creator.js";
import twinRouter from "./twin.js";
import personaRouter from "./persona.js";
import assetsRouter from "./assets.js";
import consentRouter from "./consent.js";
import recoveryRouter from "./recovery.js";
import deletionRouter from "./deletion.js";
import kycRouter from "./kyc.js";
import dsarRouter from "./dsar.js";
import sandboxRouter from "./sandbox.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(creditsRouter);
router.use(paymentsRouter);
router.use(twofaRouter);
router.use(onboardingRouter);
router.use(creatorRouter);
router.use(twinRouter);
router.use(personaRouter);
router.use(assetsRouter);
router.use(consentRouter);
router.use(recoveryRouter);
router.use(deletionRouter);
router.use(kycRouter);
router.use(dsarRouter);
router.use(sandboxRouter);

export default router;
