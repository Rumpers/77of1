import * as Sentry from "@sentry/node";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(cookieParser());

// Raw body for Stripe webhook signature verification
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Bull Board — dev only, auth-gated via BULL_BOARD_SECRET env var.
// Accessible at /admin/queues when NODE_ENV !== production.
if (process.env.NODE_ENV !== "production") {
  (async () => {
    try {
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        logger.warn("[bull-board] REDIS_URL not set — dashboard skipped");
        return;
      }

      const { createBullBoard } = await import("@bull-board/api");
      const { BullMQAdapter } = await import("@bull-board/api/bullMQAdapter");
      const { ExpressAdapter } = await import("@bull-board/express");
      const { createAllQueues } = await import("@workspace/queue");

      const serverAdapter = new ExpressAdapter();
      serverAdapter.setBasePath("/admin/queues");

      const queues = createAllQueues(redisUrl);
      createBullBoard({
        queues: Object.values(queues).map((q) => new BullMQAdapter(q)),
        serverAdapter,
      });

      const secret = process.env.BULL_BOARD_SECRET;
      app.use(
        "/admin/queues",
        (req: Request, res: Response, next: NextFunction) => {
          if (secret && req.headers["x-bull-board-secret"] !== secret) {
            res.status(401).json({ error: "Unauthorized" });
            return;
          }
          next();
        },
        serverAdapter.getRouter(),
      );

      logger.info("[bull-board] dashboard mounted at /admin/queues");
    } catch (err) {
      logger.warn({ err }, "[bull-board] failed to mount dashboard (optional)");
    }
  })();
}

Sentry.setupExpressErrorHandler(app);

export default app;
