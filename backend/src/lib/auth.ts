import jwt from "jsonwebtoken";
import type { CookieOptions, Response } from "express";
import type { Role } from "@prisma/client";

const COOKIE_NAME = "cc_token";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type JwtPayload = {
  userId: string;
  role: Role;
};

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

export function signToken(payload: JwtPayload) {
  return jwt.sign(payload, jwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, jwtSecret()) as JwtPayload;
}

function cookieOptions(): CookieOptions {
  const secure =
    process.env.COOKIE_SECURE === "true" ||
    process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    maxAge: SEVEN_DAYS_MS,
    path: "/",
  };
}

export function setAuthCookie(res: Response, payload: JwtPayload) {
  res.cookie(COOKIE_NAME, signToken(payload), cookieOptions());
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: 0 });
}

export type OAuthStatePayload = {
  csrf: string;
  origin?: string;
  callbackUrl?: string;
  returnUrl?: string;
  createdAt: number;
};

export function createOAuthState(payload: {
  origin?: string;
  callbackUrl?: string;
  returnUrl?: string;
}): string {
  const stateData: OAuthStatePayload = {
    csrf: Math.random().toString(36).slice(2) + Date.now().toString(36),
    origin: payload.origin,
    callbackUrl: payload.callbackUrl,
    returnUrl: payload.returnUrl,
    createdAt: Date.now(),
  };
  return jwt.sign(stateData, jwtSecret(), { expiresIn: "15m" });
}

export function verifyOAuthState(stateStr?: string): OAuthStatePayload | null {
  if (!stateStr) return null;
  try {
    return jwt.verify(stateStr, jwtSecret()) as OAuthStatePayload;
  } catch {
    return null;
  }
}

export function resolveClientOrigin(
  req: { get(name: string): string | undefined; headers: Record<string, any> },
  preferredOrigin?: string,
): string {
  const currentHost = (req.get("host") || "").toLowerCase();

  const isAllowed = (origin: string): boolean => {
    if (!origin) return false;
    try {
      const url = new URL(origin);
      // Never redirect back to backend Render domain or current backend host
      if (url.host.toLowerCase() === currentHost) return false;
      if (url.host.includes("render.com") && currentHost.includes("render.com")) return false;

      const clientOriginEnv = process.env.CLIENT_ORIGIN || "";
      const allowedOrigins = clientOriginEnv.split(",").map((o) => o.trim().toLowerCase());
      const originLower = origin.toLowerCase();

      if (allowedOrigins.includes(originLower) || allowedOrigins.includes("*")) return true;
      if (url.hostname.endsWith(".vercel.app") || url.hostname === "vercel.app") return true;
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
      return false;
    } catch {
      return false;
    }
  };

  if (preferredOrigin && isAllowed(preferredOrigin)) {
    return preferredOrigin.replace(/\/+$/, "");
  }

  const referer = req.headers.referer;
  if (referer && typeof referer === "string") {
    try {
      const parsed = new URL(referer);
      const origin = `${parsed.protocol}//${parsed.host}`;
      if (isAllowed(origin)) {
        return origin;
      }
    } catch (_) {}
  }

  const clientOriginEnv = process.env.CLIENT_ORIGIN || "";
  const candidateOrigins = clientOriginEnv.split(",").map((o) => o.trim()).filter(Boolean);
  for (const candidate of candidateOrigins) {
    if (isAllowed(candidate)) {
      return candidate.replace(/\/+$/, "");
    }
  }

  return process.env.NODE_ENV === "production"
    ? "https://campusconnect.vercel.app"
    : "http://localhost:5173";
}

export function resolveGoogleCallbackUrl(
  req: { protocol?: string; get(name: string): string | undefined; headers: Record<string, any> },
  customUrl?: string,
): string {
  if (customUrl && (customUrl.startsWith("http://") || customUrl.startsWith("https://"))) {
    return customUrl;
  }
  const configured = process.env.GOOGLE_CALLBACK_URL;
  if (configured && (configured.startsWith("http://") || configured.startsWith("https://"))) {
    return configured;
  }
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = req.get("host") || "localhost:4000";
  const basePath = configured && configured.startsWith("/") ? configured : "/api/auth/google/callback";
  return `${proto}://${host}${basePath}`;
}

export { COOKIE_NAME };
