import { Router } from "express";
import { Prisma, ProjectStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/asyncHandler";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { HttpError } from "../lib/httpError";

const router = Router();

function normalizeStatusInput(val?: string | ProjectStatus): ProjectStatus | undefined {
  if (!val) return undefined;
  const s = String(val).toUpperCase().replace(/\s+/g, "_");
  if (s === "OPEN") return ProjectStatus.OPEN;
  if (s === "IN_PROGRESS" || s === "INPROGRESS") return ProjectStatus.IN_PROGRESS;
  if (s === "COMPLETED") return ProjectStatus.COMPLETED;
  if (s === "CLOSED") return ProjectStatus.CLOSED;
  return undefined;
}

function formatStatusOutput(status: ProjectStatus): "Open" | "In progress" | "Completed" | "Closed" {
  switch (status) {
    case ProjectStatus.OPEN:
      return "Open";
    case ProjectStatus.IN_PROGRESS:
      return "In progress";
    case ProjectStatus.COMPLETED:
      return "Completed";
    case ProjectStatus.CLOSED:
      return "Closed";
  }
}

const projectSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(5000),
  category: z.string().trim().optional(),
  roles: z.array(z.string().trim()).optional(),
  requiredSkills: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  techStack: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  status: z.union([z.nativeEnum(ProjectStatus), z.string()]).optional(),
  teamCapacity: z.number().int().min(1).max(50).optional(),
  teamSize: z.number().int().min(1).max(50).optional(),
});

const updateSchema = projectSchema.partial();

const joinSchema = z.object({
  message: z.string().trim().max(500).optional(),
});

function memberCountInclude() {
  return {
    creator: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        profile: { select: { institution: true, programme: true, imageUrl: true } },
      },
    },
    members: {
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    },
    joinRequests: {
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" as const },
    },
    _count: { select: { members: true, joinRequests: true } },
  } satisfies Prisma.ProjectInclude;
}

function formatProjectForResponse(p: any) {
  const ownerName = p.creator
    ? `${p.creator.firstName || ""} ${p.creator.lastName || ""}`.trim() || p.creator.email
    : "Campus Connect Member";
  const memberNames = (p.members || []).map((m: any) =>
    m.user ? `${m.user.firstName || ""} ${m.user.lastName || ""}`.trim() || m.user.email : "Member",
  );

  const formattedRequests = (p.joinRequests || []).map((r: any) => ({
    id: r.id,
    applicantEmail: r.user?.email || "",
    applicantName: r.user
      ? `${r.user.firstName || ""} ${r.user.lastName || ""}`.trim() || r.user.email
      : "Applicant",
    message: r.message || "",
    status: r.status === "APPROVED" ? "accepted" : r.status === "REJECTED" ? "declined" : "pending",
  }));

  return {
    ...p,
    category: p.category || "EdTech",
    roles: p.roles || [],
    techStack: p.requiredSkills || [],
    teamSize: p.teamCapacity,
    displayStatus: formatStatusOutput(p.status),
    creatorId: p.creatorId || p.creator?.id || "",
    ownerEmail: p.creator?.email || "",
    ownerName,
    members: p.members || [],
    memberNames: memberNames.length > 0 ? memberNames : [ownerName],
    requests: formattedRequests,
  };
}

router.get(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const skill = typeof req.query.skill === "string" ? req.query.skill.trim() : "";
    const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
    const statusRaw = typeof req.query.status === "string" ? req.query.status : "";
    const status = normalizeStatusInput(statusRaw);

    const where: Prisma.ProjectWhereInput = {
      AND: [
        q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        skill && skill !== "All" ? { requiredSkills: { has: skill } } : {},
        category && category !== "All" ? { category: { equals: category, mode: "insensitive" } } : {},
        status ? { status } : {},
      ],
    };

    const rawProjects = await prisma.project.findMany({
      where,
      include: memberCountInclude(),
      orderBy: { createdAt: "desc" },
    });

    const projects = rawProjects.map(formatProjectForResponse);
    res.json({ projects });
  }),
);

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const rawData = projectSchema.parse(req.body);
    const skills = rawData.requiredSkills || rawData.techStack || [];
    const capacity = rawData.teamCapacity || rawData.teamSize || 4;
    const status = normalizeStatusInput(rawData.status) || ProjectStatus.OPEN;
    const category = rawData.category || "EdTech";
    const roles = rawData.roles || [];

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          title: rawData.title,
          description: rawData.description,
          category,
          roles,
          requiredSkills: skills,
          teamCapacity: capacity,
          status,
          creatorId: req.user!.id,
        },
        include: memberCountInclude(),
      });
      await tx.projectMember.create({
        data: { projectId: created.id, userId: req.user!.id },
      });
      return created;
    });

    res.status(201).json({ project: formatProjectForResponse(project) });
  }),
);

router.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const project = await prisma.project.findUnique({
      where: { id },
      include: memberCountInclude(),
    });
    if (!project) {
      throw new HttpError(404, "Project not found");
    }

    const isOwner = req.user?.id === project.creatorId;
    const isAdmin = req.user?.role === "ADMIN";
    const myMembership = req.user
      ? project.members.find((m) => m.userId === req.user!.id)
      : undefined;

    let joinRequests = undefined;
    if (isOwner || isAdmin) {
      joinRequests = await prisma.joinRequest.findMany({
        where: { projectId: project.id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              profile: { select: { biography: true, skills: true, institution: true, imageUrl: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    const myJoinRequest = req.user
      ? await prisma.joinRequest.findUnique({
          where: { projectId_userId: { projectId: project.id, userId: req.user.id } },
        })
      : null;

    res.json({
      project: formatProjectForResponse(project),
      isOwner,
      isMember: Boolean(myMembership),
      joinRequests,
      myJoinRequest,
    });
  }),
);

router.patch(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const rawData = updateSchema.parse(req.body);
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, "Project not found");
    }
    if (existing.creatorId !== req.user!.id && req.user!.role !== "ADMIN") {
      throw new HttpError(403, "You cannot edit this project");
    }

    const updateData: Record<string, unknown> = {};
    if (rawData.title !== undefined) updateData.title = rawData.title;
    if (rawData.description !== undefined) updateData.description = rawData.description;
    if (rawData.category !== undefined) updateData.category = rawData.category;
    if (rawData.roles !== undefined) updateData.roles = rawData.roles;
    if (rawData.requiredSkills !== undefined || rawData.techStack !== undefined) {
      updateData.requiredSkills = rawData.requiredSkills || rawData.techStack;
    }
    if (rawData.teamCapacity !== undefined || rawData.teamSize !== undefined) {
      updateData.teamCapacity = rawData.teamCapacity || rawData.teamSize;
    }
    if (rawData.status !== undefined) {
      const norm = normalizeStatusInput(rawData.status);
      if (norm) updateData.status = norm;
    }

    const project = await prisma.project.update({
      where: { id: existing.id },
      data: updateData,
      include: memberCountInclude(),
    });
    res.json({ project: formatProjectForResponse(project) });
  }),
);

router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, "Project not found");
    }
    if (existing.creatorId !== req.user!.id && req.user!.role !== "ADMIN") {
      throw new HttpError(403, "You cannot delete this project");
    }
    await prisma.project.delete({ where: { id: existing.id } });
    res.status(204).send();
  }),
);

router.post(
  "/:id/join-requests",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const { message } = joinSchema.parse(req.body ?? {});
    const project = await prisma.project.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    if (!project) {
      throw new HttpError(404, "Project not found");
    }
    if (project.creatorId === req.user!.id) {
      throw new HttpError(400, "You already own this project");
    }
    if (project.status !== "OPEN") {
      throw new HttpError(400, "This project is not accepting members");
    }
    if (project._count.members >= project.teamCapacity) {
      throw new HttpError(400, "This project team is full");
    }
    const alreadyMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: req.user!.id } },
    });
    if (alreadyMember) {
      throw new HttpError(400, "You are already on this team");
    }
    const existingRequest = await prisma.joinRequest.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: req.user!.id } },
    });
    if (existingRequest?.status === "PENDING") {
      throw new HttpError(409, "You already requested to join this project");
    }
    if (existingRequest?.status === "APPROVED") {
      throw new HttpError(400, "You are already on this team");
    }

    const joinRequest = existingRequest
      ? await prisma.joinRequest.update({
          where: { id: existingRequest.id },
          data: { status: "PENDING", message },
        })
      : await prisma.joinRequest.create({
          data: {
            projectId: project.id,
            userId: req.user!.id,
            message,
          },
        });

    // Create notification for project owner
    try {
      const senderName = req.user!.email;
      await prisma.notification.create({
        data: {
          userId: project.creatorId,
          type: "JOIN_REQUEST",
          title: `New request for ${project.title}`,
          body: `${senderName} would like to join your project.`,
        },
      });
    } catch (_) {}

    res.status(existingRequest ? 200 : 201).json({ joinRequest });
  }),
);

export default router;
