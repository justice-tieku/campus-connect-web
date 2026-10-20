import { Router } from "express";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../lib/httpError";

const router = Router();

const uploadDir = path.join(process.cwd(), "uploads", "avatars");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const userId = (req as any).user?.id || "user";
    cb(null, `${userId}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
    if (allowedMimes.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new HttpError(400, "Only JPEG, PNG, WEBP, GIF, and SVG images are permitted."));
    }
  },
});

const optionalUrl = z
  .string()
  .trim()
  .url()
  .max(500)
  .optional()
  .or(z.literal("").transform(() => undefined));

const profileSchema = z.object({
  biography: z.string().max(2000).optional(),
  bio: z.string().max(2000).optional(),
  institution: z.string().max(200).optional(),
  university: z.string().max(200).optional(),
  programme: z.string().max(200).optional(),
  skills: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  techStack: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  experience: z.string().optional(),
  availability: z.string().optional(),
  githubLink: optionalUrl,
  github: optionalUrl,
  portfolioLink: optionalUrl,
  imageUrl: z.string().trim().max(2000).optional().or(z.literal("").transform(() => undefined)),
  onboardingComplete: z.boolean().optional(),
  onboardingSkipped: z.boolean().optional(),
  name: z.string().optional(),
});

function formatProfileResponse(profile: any, user?: any) {
  if (!profile) return null;
  return {
    ...profile,
    bio: profile.biography,
    techStack: profile.skills,
    github: profile.githubLink,
    university: profile.institution,
    imageUrl: profile.imageUrl || "",
    name: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email : undefined,
  };
}

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { profile: true },
    });
    res.json({
      profile: formatProfileResponse(user?.profile, user),
    });
  }),
);

router.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = profileSchema.parse(req.body);
    const biography = data.biography ?? data.bio;
    const institution = data.institution ?? data.university;
    const skills = data.skills ?? data.techStack;
    const githubLink = data.githubLink ?? data.github;

    const profileData: Record<string, unknown> = {};
    if (biography !== undefined) profileData.biography = biography;
    if (institution !== undefined) profileData.institution = institution;
    if (data.programme !== undefined) profileData.programme = data.programme;
    if (skills !== undefined) profileData.skills = skills;
    if (data.experience !== undefined) profileData.experience = data.experience;
    if (data.availability !== undefined) profileData.availability = data.availability;
    if (githubLink !== undefined) profileData.githubLink = githubLink;
    if (data.portfolioLink !== undefined) profileData.portfolioLink = data.portfolioLink;
    if (data.imageUrl !== undefined) profileData.imageUrl = data.imageUrl;
    if (data.onboardingComplete !== undefined) profileData.onboardingComplete = data.onboardingComplete;
    if (data.onboardingSkipped !== undefined) profileData.onboardingSkipped = data.onboardingSkipped;

    // Also update User if name or university provided
    if (data.name || institution) {
      const userUpdate: Record<string, unknown> = {};
      if (institution) userUpdate.institution = institution;
      if (data.name) {
        const parts = data.name.trim().split(/\s+/);
        userUpdate.firstName = parts[0] || "";
        userUpdate.lastName = parts.slice(1).join(" ") || "";
      }
      await prisma.user.update({
        where: { id: req.user!.id },
        data: userUpdate,
      });
    }

    const profile = await prisma.profile.upsert({
      where: { userId: req.user!.id },
      update: profileData,
      create: { userId: req.user!.id, ...profileData },
    });

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    res.json({
      profile: formatProfileResponse(profile, user),
    });
  }),
);

// Upload profile avatar
router.post(
  "/avatar",
  requireAuth,
  upload.single("avatar"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new HttpError(400, "No image file uploaded.");
    }

    const relativeUrl = `/uploads/avatars/${req.file.filename}`;

    // Find current profile to clean up old local image if necessary
    const existing = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
    });

    if (existing?.imageUrl && existing.imageUrl.startsWith("/uploads/avatars/")) {
      const oldFilename = path.basename(existing.imageUrl);
      const oldPath = path.join(uploadDir, oldFilename);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (_) {}
      }
    }

    const updatedProfile = await prisma.profile.upsert({
      where: { userId: req.user!.id },
      update: { imageUrl: relativeUrl },
      create: { userId: req.user!.id, imageUrl: relativeUrl },
    });

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    res.json({
      ok: true,
      imageUrl: relativeUrl,
      profile: formatProfileResponse(updatedProfile, user),
    });
  }),
);

// Delete profile avatar
router.delete(
  "/avatar",
  requireAuth,
  asyncHandler(async (req, res) => {
    const existing = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
    });

    if (existing?.imageUrl && existing.imageUrl.startsWith("/uploads/avatars/")) {
      const oldFilename = path.basename(existing.imageUrl);
      const oldPath = path.join(uploadDir, oldFilename);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (_) {}
      }
    }

    const updatedProfile = await prisma.profile.update({
      where: { userId: req.user!.id },
      data: { imageUrl: null },
    });

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    res.json({
      ok: true,
      profile: formatProfileResponse(updatedProfile, user),
    });
  }),
);

export default router;
