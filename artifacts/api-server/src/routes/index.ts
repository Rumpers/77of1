import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import creditsRouter from "./credits.js";
import paymentsRouter from "./payments.js";
import onboardingRouter from "./onboarding.js";
import creatorRouter from "./creator.js";
import twinRouter from "./twin.js";
import twinProfileRouter from "./twin-profile.js";
import personaRouter from "./persona.js";
import assetsRouter from "./assets.js";
import consentRouter from "./consent.js";
import subscriptionsRouter from "./subscriptions.js";
import accountRouter from "./account.js";
import emailWebhooksRouter from "./email-webhooks.js";
import dsarRouter from "./dsar.js";
import reportsRouter from "./reports.js";
import adminTwinActivateRouter from "./admin-twin-activate.js";
import linksRouter from "./links.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(creditsRouter);
router.use(paymentsRouter);
router.use(onboardingRouter);
router.use(creatorRouter);
router.use(twinRouter);
router.use(twinProfileRouter);
router.use(personaRouter);
router.use(assetsRouter);
router.use(consentRouter);
router.use(subscriptionsRouter);
router.use(accountRouter);
router.use(dsarRouter);
// Email webhook must be before express.json() middleware — see email-webhooks.ts
router.use(emailWebhooksRouter);
router.use(reportsRouter);
// Admin: founder-auth-gated routes — must be before the linksRouter catch-all
router.use(adminTwinActivateRouter);
// Link tracker last — /:handle catches all unmatched GET paths
router.use(linksRouter);

export default router;
