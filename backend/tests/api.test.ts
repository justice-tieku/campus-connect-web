import "dotenv/config";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma";
import { createApp } from "../src/app";

const app = createApp();

const suffix = Date.now().toString();
const ownerEmail = `owner.${suffix}@test.dev`;
const joinerEmail = `joiner.${suffix}@test.dev`;
const password = "TestPass123!";

function agent() {
  return request.agent(app);
}

describe("CampusConnect API", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, joinerEmail] } },
    });
    await prisma.$disconnect();
  });

  it("rejects unauthenticated profile access", async () => {
    const res = await request(app).get("/api/profile/me");
    expect(res.status).toBe(401);
  });

  it("registers, logs in with cookie, and updates profile", async () => {
    const owner = agent();
    const register = await owner.post("/api/auth/register").send({
      email: ownerEmail,
      password,
    });
    expect(register.status).toBe(201);
    expect(register.body.user.role).toBe("STUDENT");
    expect(register.headers["set-cookie"]).toBeTruthy();

    const me = await owner.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(ownerEmail);

    const profile = await owner.patch("/api/profile/me").send({
      biography: "Test student biography for automated checks.",
      institution: "Test University",
      programme: "Informatics",
      skills: ["React", "Go"],
      githubLink: "https://github.com/example/test",
    });
    expect(profile.status).toBe(200);
    expect(profile.body.profile.institution).toBe("Test University");
    expect(profile.body.profile.skills).toContain("React");
  });

  it("stores a password hash rather than plaintext", async () => {
    const user = await prisma.user.findUnique({ where: { email: ownerEmail } });
    expect(user).toBeTruthy();
    expect(user!.passwordHash).not.toBe(password);
    expect(user!.passwordHash.startsWith("$2")).toBe(true);
  });

  it("creates a project, finds it via search, and blocks other students from editing", async () => {
    const owner = agent();
    await owner.post("/api/auth/login").send({ email: ownerEmail, password });

    const created = await owner.post("/api/projects").send({
      title: `KeywordSearch ${suffix}`,
      description: "A collaborative campus tool for matching teammates on projects.",
      requiredSkills: ["React", "Prisma"],
      teamCapacity: 3,
      status: "OPEN",
    });
    expect(created.status).toBe(201);
    const projectId = created.body.project.id as string;

    const search = await owner.get("/api/projects").query({ q: `KeywordSearch ${suffix}`, skill: "React" });
    expect(search.status).toBe(200);
    expect(search.body.projects.some((p: { id: string }) => p.id === projectId)).toBe(true);

    const joiner = agent();
    await joiner.post("/api/auth/register").send({ email: joinerEmail, password });

    const forbidden = await joiner.patch(`/api/projects/${projectId}`).send({ title: "Hijacked title" });
    expect(forbidden.status).toBe(403);

    const join = await joiner.post(`/api/projects/${projectId}/join-requests`).send({
      message: "I can help with React.",
    });
    expect(join.status).toBe(201);
    const joinId = join.body.joinRequest.id as string;

    const decideForbidden = await joiner.patch(`/api/join-requests/${joinId}`).send({ status: "APPROVED" });
    expect(decideForbidden.status).toBe(403);

    const approve = await owner.patch(`/api/join-requests/${joinId}`).send({ status: "APPROVED" });
    expect(approve.status).toBe(200);
    expect(approve.body.joinRequest.status).toBe("APPROVED");

    const detail = await owner.get(`/api/projects/${projectId}`);
    expect(detail.body.project.members.some((m: { userId: string }) => m.user.email === joinerEmail)).toBe(true);
  });

  it("blocks students from admin routes", async () => {
    const owner = agent();
    await owner.post("/api/auth/login").send({ email: ownerEmail, password });
    const res = await owner.get("/api/admin/users");
    expect(res.status).toBe(403);

    const createOpp = await owner.post("/api/admin/opportunities").send({
      title: "Should fail",
      description: "Students must not create admin opportunities.",
    });
    expect(createOpp.status).toBe(403);
  });

  it("rejects invalid login", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: ownerEmail,
      password: "wrong-password",
    });
    expect(res.status).toBe(401);
  });

  describe("Google OAuth Flow & Mobile Compatibility", () => {
    it("generates a Google OAuth authorization URL with signed state", async () => {
      const res = await request(app)
        .get("/api/auth/google/url")
        .query({ origin: "https://campusconnect.vercel.app" });
      expect(res.status).toBe(200);
      expect(res.body.url).toBeTruthy();
      const parsedUrl = new URL(res.body.url);
      expect(parsedUrl.hostname).toBe("accounts.google.com");
      expect(parsedUrl.searchParams.get("response_type")).toBe("code");
      expect(parsedUrl.searchParams.get("scope")).toContain("openid");
      expect(parsedUrl.searchParams.get("state")).toBeTruthy();
    });

    it("handles callback at /api/auth/google/callback and /auth/google/callback without 404", async () => {
      const resApi = await request(app)
        .get("/api/auth/google/callback")
        .expect(302);
      expect(resApi.headers.location).toContain("login?error=google_auth_failed");

      const resRoot = await request(app)
        .get("/auth/google/callback")
        .expect(302);
      expect(resRoot.headers.location).toContain("login?error=google_auth_failed");

      const resAlias = await request(app)
        .get("/api/auth/callback/google")
        .expect(302);
      expect(resAlias.headers.location).toContain("login?error=google_auth_failed");
    });

    it("redirects direct hits to frontend paths on backend instead of 404", async () => {
      const res = await request(app)
        .get("/dashboard?token=test_token_123")
        .expect(302);
      expect(res.headers.location).toContain("/#dashboard?token=test_token_123");
    });
  });
});
