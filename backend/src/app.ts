import express from "express";
import path from "node:path";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth";
import profileRoutes from "./routes/profile";
import projectRoutes from "./routes/projects";
import joinRequestRoutes from "./routes/joinRequests";
import opportunityRoutes from "./routes/opportunities";
import adminRoutes from "./routes/admin";
import reportRoutes from "./routes/reports";
import notificationRoutes from "./routes/notifications";
import messageRoutes from "./routes/messages";
import { errorHandler, notFound } from "./middleware/error";
import { resolveClientOrigin } from "./lib/auth";

export function createApp() {
  const app = express();

  // Trust proxy for secure cookies behind reverse proxies (Render, Railway, etc.)
  app.set("trust proxy", 1);

  const clientOriginEnv = process.env.CLIENT_ORIGIN || "http://localhost:5173";
  const allowedOrigins = clientOriginEnv.split(",").map((o) => o.trim());

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!requestOrigin) return callback(null, true);
        if (
          allowedOrigins.includes(requestOrigin) ||
          allowedOrigins.includes("*") ||
          requestOrigin.includes("vercel.app") ||
          requestOrigin.includes("localhost")
        ) {
          return callback(null, true);
        }
        return callback(new Error(`CORS origin not allowed: ${requestOrigin}`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  // Serve static uploads (e.g. avatar images)
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRoutes);
  // Support /auth alias so callbacks configured with or without /api both succeed
  app.use("/auth", authRoutes);

  app.use("/api/profile", profileRoutes);
  app.use("/api/projects", projectRoutes);
  app.use("/api/join-requests", joinRequestRoutes);
  app.use("/api/opportunities", opportunityRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/messages", messageRoutes);

  // Catch non-API frontend route visits on backend domain and seamlessly redirect to frontend
  app.get(
    ["/", "/dashboard", "/login", "/signup", "/verify", "/reset", "/forgot", "/onboarding", "/projects", "/internships", "/profile", "/messages"],
    (req, res) => {
      const origin = resolveClientOrigin(req);
      const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      const cleanPath = req.path === "/" ? "" : req.path.replace(/^\//, "");
      return res.redirect(`${origin}/#${cleanPath}${query}`);
    },
  );

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
