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
import subscriptionsRouter from "./subscriptions.js";
import accountRouter from "./account.js";
import emailWebhooksRouter from "./email-webhooks.js";
import dsarRouter from "./dsar.js";
import reportsRouter from "./reports.js";
import fanRecoveryRouter from "./fan-recovery.js";
import oauthRouter from "./oauth.js";
import socialSendsRouter from "./social-sends.js";

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
router.use(subscriptionsRouter);
router.use(accountRouter);
router.use(dsarRouter);
// Email webhook must be before express.json() middleware — see email-webhooks.ts
router.use(emailWebhooksRouter);
router.use(reportsRouter);
router.use(fanRecoveryRouter);
router.use(oauthRouter);
router.use(socialSendsRouter);

export default router;
