# CampusConnect API

Base URL in development: `http://localhost:4000` (or `/api` via the Vite proxy).

Authenticated routes expect the httpOnly cookie `cc_token` (`credentials: include` from the browser). JSON bodies unless noted.

Errors: `{ "error": "message", "details": ... }` with no stack traces in production.

## Health

- `GET /api/health` — `{ ok: true }`

## Auth

- `POST /api/auth/register` — `{ email, password }` → `{ user }` + set cookie. Role is always `STUDENT`.
- `POST /api/auth/login` — `{ email, password }` → `{ user }` + set cookie.
- `POST /api/auth/logout` — clears cookie.
- `GET /api/auth/me` — current user + profile. **Auth required.**

Register/login are rate-limited (20 attempts / 15 minutes).

## Profile

- `GET /api/profile/me` — **Auth.**
- `PATCH /api/profile/me` — `{ biography, institution, programme, skills[], githubLink, portfolioLink, imageUrl }`. **Auth.** Users can only edit their own profile.
- `POST /api/profile/me/avatar` — multipart form-data with `avatar` (JPEG/PNG/WebP, default max 5 MB via `AVATAR_MAX_SIZE_MB`). Uploads/replaces the signed-in user avatar and stores only `imageUrl`.
- `DELETE /api/profile/me/avatar` — removes the signed-in user avatar reference (and storage object when possible).

## Projects

- `GET /api/projects?q=&skill=&status=` — list with optional keyword (title/description), exact skill match, and `OPEN | IN_PROGRESS | COMPLETED | CLOSED`.
- `POST /api/projects` — `{ title, description, requiredSkills[], teamCapacity, status? }`. Creator is added as a member. **Auth.**
- `GET /api/projects/:id` — project, members, `isOwner`, `isMember`, `myJoinRequest`. Join requests included for owner/admin.
- `PATCH /api/projects/:id` — owner or admin.
- `DELETE /api/projects/:id` — owner or admin.
- `POST /api/projects/:id/join-requests` — `{ message? }`. **Auth.** Cannot join own project or a non-OPEN / full team.

## Join requests

- `PATCH /api/join-requests/:id` — `{ status: "APPROVED" | "REJECTED" }`. Project owner or admin. Approve adds a `ProjectMember`.

## Opportunities

- `GET /api/opportunities` — public list.
- `POST /api/admin/opportunities` — `{ title, description, type?, link? }`. **Admin.**

## Reports

- `POST /api/reports` — `{ reason, projectId? , reportedUserId? }`. **Auth.**

## Admin (role `ADMIN` only)

- `GET /api/admin/users`
- `PATCH /api/admin/users/:id` — `{ isActive?, role? }`
- `GET /api/admin/projects`
- `DELETE /api/admin/projects/:id`
- `GET /api/admin/reports`
- `PATCH /api/admin/reports/:id` — `{ status: "RESOLVED" | "DISMISSED" }`
