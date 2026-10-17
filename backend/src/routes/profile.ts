import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { supabaseAdmin } from "../lib/supabase";
import { HttpError } from "../lib/httpError";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";

const router = Router();
const avatarMaxSizeMb = Number(process.env.AVATAR_MAX_SIZE_MB || 5);
const avatarMaxSizeBytes = avatarMaxSizeMb * 1024 * 1024;
const avatarBucket = process.env.SUPABASE_AVATAR_BUCKET || "avatars";
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: avatarMaxSizeBytes },
});
const allowedAvatarTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

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
  imageUrl: optionalUrl,
  onboardingComplete: z.boolean().optional(),
  onboardingSkipped: z.boolean().optional(),
  name: z.string().optional(),
});

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { profile: true },
    });
    const profile = user?.profile ?? null;
    res.json({
      profile: profile
        ? {
            ...profile,
            bio: profile.biography,
            techStack: profile.skills,
            github: profile.githubLink,
            university: profile.institution,
            name: `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.email,
          }
        : null,
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

    res.json({
      profile: {
        ...profile,
        bio: profile.biography,
        techStack: profile.skills,
        github: profile.githubLink,
        university: profile.institution,
      },
    });
  }),
);

router.post(
  "/me/avatar",
  requireAuth,
  (req, res, next) => {
    avatarUpload.single("avatar")(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return next(new HttpError(400, `Image must be ${avatarMaxSizeMb}MB or smaller.`));
      }
      return next(new HttpError(400, "Invalid avatar upload payload."));
    });
  },
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) {
      throw new HttpError(400, "Please select an image to upload.");
    }
    if (!allowedAvatarTypes.has(file.mimetype)) {
      throw new HttpError(400, "Only JPEG, PNG, and WebP images are supported.");
    }
    if (file.size > avatarMaxSizeBytes) {
      throw new HttpError(400, `Image must be ${avatarMaxSizeMb}MB or smaller.`);
    }

    const ext = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
    const objectPath = `${req.user!.id}/avatar.${ext}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(avatarBucket)
      .upload(objectPath, file.buffer, {
        upsert: true,
        contentType: file.mimetype,
        cacheControl: "3600",
      });
    if (uploadError) {
      throw new HttpError(500, "Failed to upload profile image.");
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(avatarBucket).getPublicUrl(objectPath);
    const imageUrl = publicUrlData.publicUrl;

    const profile = await prisma.profile.upsert({
      where: { userId: req.user!.id },
      update: { imageUrl },
      create: { userId: req.user!.id, imageUrl },
    });

    res.json({ imageUrl, profile });
  }),
);

router.delete(
  "/me/avatar",
  requireAuth,
  asyncHandler(async (req, res) => {
    const existing = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
      select: { imageUrl: true },
    });

    if (existing?.imageUrl) {
      try {
        const parsed = new URL(existing.imageUrl);
        const marker = `/storage/v1/object/public/${avatarBucket}/`;
        const idx = parsed.pathname.indexOf(marker);
        if (idx >= 0) {
          const objectPath = parsed.pathname.slice(idx + marker.length);
          if (objectPath) {
            await supabaseAdmin.storage.from(avatarBucket).remove([objectPath]);
          }
        }
      } catch (_) {}
    }

    const profile = await prisma.profile.upsert({
      where: { userId: req.user!.id },
      update: { imageUrl: null },
      create: { userId: req.user!.id, imageUrl: null },
    });

    res.json({ imageUrl: "", profile });
  }),
);

export default router;
