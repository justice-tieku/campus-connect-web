import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma";
import { supabase, supabaseAdmin } from "../lib/supabase";
import {
  clearAuthCookie,
  createOAuthState,
  resolveClientOrigin,
  resolveGoogleCallbackUrl,
  setAuthCookie,
  signToken,
  verifyOAuthState,
} from "../lib/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../lib/httpError";
import type { Role } from "@prisma/client";

const router = Router();

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

function getGoogleOAuthClient(callbackUrl?: string) {
  if (!googleClientId) return null;
  const cb =
    callbackUrl ||
    process.env.GOOGLE_CALLBACK_URL ||
    "http://localhost:4000/api/auth/google/callback";
  return new OAuth2Client(googleClientId, googleClientSecret, cb);
}

const registerSchema = z.object({
  email: z.string().trim().email().max(255).transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(128),
  role: z.enum(["STUDENT", "ADMIN", "FACULTY", "ALUMNI", "STAFF"]).optional(),
  accountType: z.string().optional(),
  name: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  university: z.string().optional(),
  institution: z.string().optional(),
  programme: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(255).transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(128),
  remember: z.boolean().optional(),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again later." },
});

router.post(
  "/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const { email, password, role, accountType, name, firstName, lastName, university, institution, programme } = data;

    let fName = firstName;
    let lName = lastName;
    if (name && (!fName || !lName)) {
      const parts = name.trim().split(/\s+/);
      fName = parts[0] || "";
      lName = parts.slice(1).join(" ") || "";
    }
    const univ = university || institution || "";
    let assignedRole: Role = "STUDENT";
    if (role) {
      assignedRole = role;
    } else if (accountType?.toUpperCase() === "STAFF") {
      assignedRole = "STAFF";
    } else if (accountType?.toUpperCase() === "ADMIN") {
      assignedRole = "ADMIN";
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Check existing database user
    const existingDbUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingDbUser && !existingDbUser.password && !existingDbUser.passwordHash) {
      // User registered via OAuth, allow setting password
      const user = await prisma.user.update({
        where: { id: existingDbUser.id },
        data: {
          password: passwordHash,
          passwordHash,
          role: assignedRole || existingDbUser.role,
          firstName: fName || existingDbUser.firstName,
          lastName: lName || existingDbUser.lastName,
          institution: univ || existingDbUser.institution,
          programme: programme || existingDbUser.programme,
        },
        select: { id: true, email: true, role: true, firstName: true, lastName: true, institution: true },
      });
      const token = signToken({ userId: user.id, role: user.role });
      setAuthCookie(res, { userId: user.id, role: user.role });
      return res.status(200).json({ user, token });
    }

    if (existingDbUser) {
      throw new HttpError(400, "An account with this email address already exists. Please log in instead.");
    }

    // Optional Supabase user registration attempt
    let supabaseAuthId: string | null = null;
    try {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const { data: adminData } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (adminData?.user) {
          supabaseAuthId = adminData.user.id;
        }
      }
    } catch (_) {
      // Fallback silently to direct Prisma authentication
    }

    const user = await prisma.user.create({
      data: {
        ...(supabaseAuthId ? { id: supabaseAuthId } : {}),
        email,
        password: passwordHash,
        passwordHash,
        role: assignedRole,
        firstName: fName,
        lastName: lName,
        institution: univ,
        programme,
        profile: {
          create: {
            institution: univ,
            programme: programme || "",
          },
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        institution: true,
      },
    });

    const token = signToken({ userId: user.id, role: user.role });
    setAuthCookie(res, { userId: user.id, role: user.role });
    res.status(201).json({ user, token });
  }),
);

router.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    let authenticated = false;

    if (user) {
      const storedHash = user.passwordHash || user.password;
      if (storedHash) {
        if (storedHash.startsWith("$2")) {
          authenticated = await bcrypt.compare(password, storedHash);
        } else {
          authenticated = storedHash === password;
          if (authenticated) {
            const upgraded = await bcrypt.hash(password, 10);
            await prisma.user.update({
              where: { id: user.id },
              data: { password: upgraded, passwordHash: upgraded },
            });
          }
        }
      }
    }

    // Fallback: Check Supabase if local check did not authenticate
    if (!authenticated) {
      try {
        const { data: sbData, error: sbError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (!sbError && sbData?.user) {
          authenticated = true;
          if (!user) {
            const newUser = await prisma.user.create({
              data: {
                id: sbData.user.id,
                email: sbData.user.email!,
                role: "STUDENT",
                profile: { create: {} },
              },
              include: { profile: true },
            });
            const token = signToken({ userId: newUser.id, role: newUser.role });
            setAuthCookie(res, { userId: newUser.id, role: newUser.role });
            return res.json({
              user: {
                id: newUser.id,
                email: newUser.email,
                role: newUser.role,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                institution: newUser.institution,
                profile: newUser.profile,
              },
              token,
            });
          }
        }
      } catch (_) {}
    }

    if (!authenticated || !user) {
      throw new HttpError(401, "Invalid email or password");
    }

    if (!user.isActive) {
      throw new HttpError(401, "Account is deactivated");
    }

    const token = signToken({ userId: user.id, role: user.role });
    setAuthCookie(res, { userId: user.id, role: user.role });
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        institution: user.institution,
        profile: user.profile,
      },
      token,
    });
  }),
);

router.post("/logout", asyncHandler(async (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
}));

router.post(
  "/google",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { credential, code, idToken } = z.object({
      credential: z.string().optional(),
      idToken: z.string().optional(),
      code: z.string().optional(),
    }).parse(req.body);

    const tokenToVerify = credential || idToken;
    const client = getGoogleOAuthClient();

    let email: string | undefined;
    let googleId: string | undefined;
    let givenName: string | undefined;
    let familyName: string | undefined;
    let name: string | undefined;
    let picture: string | undefined;

    if (tokenToVerify) {
      if (client && process.env.GOOGLE_CLIENT_ID) {
        const ticket = await client.verifyIdToken({
          idToken: tokenToVerify,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload) {
          throw new HttpError(401, "Invalid Google ID token payload");
        }
        if (!payload.email_verified) {
          throw new HttpError(403, "Google account email is not verified");
        }
        email = payload.email?.toLowerCase();
        googleId = payload.sub;
        name = payload.name;
        givenName = payload.given_name;
        familyName = payload.family_name;
        picture = payload.picture;
      } else {
        // Fallback decoder if GOOGLE_CLIENT_ID is not configured locally yet
        try {
          const base64Url = tokenToVerify.split(".")[1];
          const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
          const jsonPayload = decodeURIComponent(
            Buffer.from(base64, "base64")
              .toString("binary")
              .split("")
              .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
              .join(""),
          );
          const parsed = JSON.parse(jsonPayload);
          if (parsed && parsed.email) {
            email = parsed.email.toLowerCase();
            googleId = parsed.sub;
            name = parsed.name;
            givenName = parsed.given_name;
            familyName = parsed.family_name;
            picture = parsed.picture;
          }
        } catch (_) {
          throw new HttpError(400, "Invalid Google credential format");
        }
      }
    } else if (code) {
      if (!client) {
        throw new HttpError(500, "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
      }
      const { tokens } = await client.getToken(code);
      if (!tokens.id_token) {
        throw new HttpError(400, "Failed to retrieve Google ID token from authorization code");
      }
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email_verified) {
        throw new HttpError(403, "Invalid Google authorization or unverified email");
      }
      email = payload.email?.toLowerCase();
      googleId = payload.sub;
      name = payload.name;
      givenName = payload.given_name;
      familyName = payload.family_name;
      picture = payload.picture;
    } else {
      throw new HttpError(400, "Google credential or authorization code is required");
    }

    if (!email || !googleId) {
      throw new HttpError(400, "Incomplete Google user claims");
    }

    // Account Linking & Creation
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email }],
      },
      include: { profile: true },
    });

    if (user) {
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId },
          include: { profile: true },
        });
      }
    } else {
      const fName = givenName || (name ? name.split(" ")[0] : "");
      const lName = familyName || (name ? name.split(" ").slice(1).join(" ") : "");
      user = await prisma.user.create({
        data: {
          email,
          googleId,
          role: "STUDENT",
          firstName: fName,
          lastName: lName,
          isActive: true,
          profile: {
            create: {
              imageUrl: picture || null,
            },
          },
        },
        include: { profile: true },
      });
    }

    if (!user.isActive) {
      throw new HttpError(401, "Account is deactivated");
    }

    const token = signToken({ userId: user.id, role: user.role });
    setAuthCookie(res, { userId: user.id, role: user.role });
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        institution: user.institution,
        profile: user.profile,
      },
      token,
    });
  }),
);

router.get("/google/url", (req, res) => {
  const preferredOrigin = typeof req.query.origin === "string" ? req.query.origin : undefined;
  const clientOrigin = resolveClientOrigin(req, preferredOrigin);
  const callbackUrl = resolveGoogleCallbackUrl(req);
  const client = getGoogleOAuthClient(callbackUrl);

  if (!client) {
    console.error("[OAuth:Google] Cannot generate auth URL: GOOGLE_CLIENT_ID not configured.");
    return res.status(503).json({
      error: "Google authentication is not yet configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    });
  }

  const state = createOAuthState({
    origin: clientOrigin,
    callbackUrl,
    returnUrl: typeof req.query.returnUrl === "string" ? req.query.returnUrl : undefined,
  });

  const url = client.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
    state,
    redirect_uri: callbackUrl,
  });

  console.log(`[OAuth:Google] Generated auth URL: callback=${callbackUrl}, targetOrigin=${clientOrigin}`);
  res.json({ url });
});

const handleGoogleCallback = asyncHandler(async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const stateStr = typeof req.query.state === "string" ? req.query.state : undefined;
  const stateData = verifyOAuthState(stateStr);

  const clientOrigin = resolveClientOrigin(req, stateData?.origin);
  const callbackUrl = stateData?.callbackUrl || resolveGoogleCallbackUrl(req);
  const client = getGoogleOAuthClient(callbackUrl);

  console.log(
    `[OAuth:Google] Callback reached at path: ${req.originalUrl.split("?")[0]}, codePresent: ${Boolean(code)}, stateValid: ${Boolean(stateData)}`,
  );

  if (!code) {
    const errorParam = typeof req.query.error === "string" ? req.query.error : "google_auth_failed";
    console.warn(`[OAuth:Google] No authorization code in query. Query error: ${errorParam}`);
    return res.redirect(`${clientOrigin}/#login?error=${encodeURIComponent(errorParam)}`);
  }

  if (!client) {
    console.error("[OAuth:Google] OAuth client unconfigured during callback handling");
    return res.redirect(`${clientOrigin}/#login?error=google_not_configured`);
  }

  try {
    console.log(`[OAuth:Google] Exchanging authorization code for tokens (redirect_uri: ${callbackUrl})`);
    const { tokens } = await client.getToken({
      code,
      redirect_uri: callbackUrl,
    });

    if (!tokens.id_token) {
      console.error("[OAuth:Google] Token exchange succeeded but returned no id_token");
      return res.redirect(`${clientOrigin}/#login?error=missing_id_token`);
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      console.error("[OAuth:Google] ID token verification succeeded but returned no email claim");
      return res.redirect(`${clientOrigin}/#login?error=invalid_payload`);
    }

    const email = payload.email.toLowerCase();
    const googleId = payload.sub;

    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
      include: { profile: true },
    });

    if (!user) {
      const fName = payload.given_name || payload.name?.split(" ")[0] || "";
      const lName = payload.family_name || payload.name?.split(" ").slice(1).join(" ") || "";
      user = await prisma.user.create({
        data: {
          email,
          googleId,
          role: "STUDENT",
          firstName: fName,
          lastName: lName,
          profile: { create: { imageUrl: payload.picture || null } },
        },
        include: { profile: true },
      });
      const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, "$1***$3");
      console.log(`[OAuth:Google] Created new student account: userId=${user.id}, email=${maskedEmail}`);
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId },
        include: { profile: true },
      });
      console.log(`[OAuth:Google] Linked Google ID to existing account: userId=${user.id}`);
    } else {
      console.log(`[OAuth:Google] Existing user authenticated: userId=${user.id}`);
    }

    if (!user.isActive) {
      console.warn(`[OAuth:Google] User account is deactivated: userId=${user.id}`);
      return res.redirect(`${clientOrigin}/#login?error=account_deactivated`);
    }

    const token = signToken({ userId: user.id, role: user.role });
    setAuthCookie(res, { userId: user.id, role: user.role });

    const redirectPath = user.profile?.onboardingComplete === false ? "onboarding" : "dashboard";
    const targetUrl = `${clientOrigin}/#${redirectPath}?token=${encodeURIComponent(token)}`;

    console.log(`[OAuth:Google] Authentication successful. Redirecting to frontend: ${clientOrigin}/#${redirectPath}`);
    return res.redirect(targetUrl);
  } catch (err: any) {
    console.error("[OAuth:Google] Callback exchange error:", err?.message || err);
    return res.redirect(`${clientOrigin}/#login?error=callback_failed`);
  }
});

router.get("/google/callback", handleGoogleCallback);
router.get("/callback/google", handleGoogleCallback);
router.get("/google", handleGoogleCallback);
router.get("/callback", handleGoogleCallback);

router.post(
  "/sync-oauth",
  asyncHandler(async (req, res) => {
    const { email, id } = z.object({
      email: z.string().trim().email(),
      id: z.string(),
    }).parse(req.body);

    let user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user) {
      const existingByEmail = await prisma.user.findUnique({ where: { email } });
      if (existingByEmail) {
        user = existingByEmail;
      } else {
        user = await prisma.user.create({
          data: {
            id,
            email,
            role: "STUDENT",
            profile: { create: {} },
          },
          select: { id: true, email: true, role: true, isActive: true },
        });
      }
    }

    if (!user.isActive) {
      throw new HttpError(401, "Account is deactivated");
    }

    const token = signToken({ userId: user.id, role: user.role });
    setAuthCookie(res, { userId: user.id, role: user.role });
    res.json({
      user: { id: user.id, email: user.email, role: user.role },
      token,
    });
  }),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        institution: true,
        programme: true,
        isActive: true,
        createdAt: true,
        profile: true,
      },
    });
    res.json({ user });
  }),
);

router.post(
  "/forgot-password",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email } = z.object({ email: z.string().trim().email() }).parse(req.body);
    const origin = req.headers.origin || process.env.CLIENT_ORIGIN || "http://localhost:5173";
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user) {
      // In development/test mode, create a reset link
      const resetToken = Buffer.from(`${user.id}:${Date.now() + 30 * 60 * 1000}`).toString("base64");
      const resetLink = `${origin}/#reset?token=${encodeURIComponent(resetToken)}`;
      return res.json({ message: "Password reset link sent to your email.", resetLink });
    }
    res.json({ message: "Password reset link sent to your email." });
  }),
);

router.post(
  "/reset-password",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { password, token } = z.object({
      password: z.string().min(8),
      token: z.string().optional(),
    }).parse(req.body);

    if (token) {
      try {
        const decoded = Buffer.from(token, "base64").toString("utf8");
        const [userId, expiresAt] = decoded.split(":");
        if (Number(expiresAt) < Date.now()) {
          throw new HttpError(400, "Reset token has expired");
        }
        const passwordHash = await bcrypt.hash(password, 10);
        await prisma.user.update({
          where: { id: userId },
          data: { password: passwordHash, passwordHash },
        });
      } catch (err) {
        if (err instanceof HttpError) throw err;
        throw new HttpError(400, "Invalid reset token");
      }
    }
    res.json({ message: "Password successfully updated." });
  }),
);

router.post(
  "/confirm-email",
  asyncHandler(async (req, res) => {
    const { email } = z.object({ email: z.string().trim().email() }).parse(req.body);
    await prisma.user.updateMany({
      where: { email: email.toLowerCase() },
      data: { isActive: true },
    });
    res.json({ ok: true, message: "Email confirmed successfully! You can now log in." });
  }),
);

export default router;
