import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import creditsRouter from "./credits.js";
import paymentsRouter from "./payments.js";
import onboardingRouter from "./onboarding.js";
import creatorRouter from "./creator.js";
import twinRouter from "./twin.js";
import personaRouter from "./persona.js";
import assetsRouter from "./assets.js";
import consentRouter from "./consent.js";
import reportsRouter from "./reports.js";
import linksRouter from "./links.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(creditsRouter);
router.use(paymentsRouter);
router.use(onboardingRouter);
router.use(creatorRouter);
router.use(twinRouter);
router.use(personaRouter);
router.use(assetsRouter);
router.use(consentRouter);
router.use(reportsRouter);
// Link tracker last — /:handle catches all unmatched GET paths
router.use(linksRouter);

export default router;
