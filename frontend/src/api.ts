export type Role = "STUDENT" | "ADMIN" | "FACULTY" | "ALUMNI" | "STAFF";
export type AccountType = "Student" | "Staff" | "Admin";
export type Experience = "Beginner" | "Intermediate" | "Advanced";
export type ProjectStatus = "Open" | "In progress" | "Completed" | "Closed";

export type UserAccount = {
  id: string;
  name: string;
  email: string;
  accountType: AccountType;
  university: string;
  verified: boolean;
  verificationToken?: string;
  createdAt: string;
  bio: string;
  techStack: string[];
  experience: Experience;
  availability: string;
  github: string;
  imageUrl?: string;
  onboardingComplete: boolean;
  onboardingSkipped: boolean;
};

export type JoinRequest = {
  id: string;
  applicantEmail: string;
  applicantName: string;
  message: string;
  status: "pending" | "accepted" | "declined";
};

export type Project = {
  id: string;
  title: string;
  description: string;
  category: string;
  techStack: string[];
  roles: string[];
  teamSize: number;
  status: "Open" | "In progress" | "Completed";
  ownerEmail: string;
  ownerName: string;
  members: string[];
  requests: JoinRequest[];
};

export type Internship = {
  id: string;
  title: string;
  company: string;
  location: string;
  skills: string[];
  applyUrl: string;
};

export type Notice = {
  id: string;
  recipient: string;
  title: string;
  detail: string;
  createdAt: string;
  read: boolean;
};

const API_BASE = (import.meta.env.VITE_API_ORIGIN || "").replace(/\/+$/, "");

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const LAST_ACTIVE_KEY = "cc_last_active";

export function touchSession() {
  localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
}

function isSessionIdle(): boolean {
  const lastActive = Number(localStorage.getItem(LAST_ACTIVE_KEY));
  return !lastActive || Date.now() - lastActive > IDLE_TIMEOUT_MS;
}

function expireIdleSession(): boolean {
  const token = localStorage.getItem("cc_auth_token") || sessionStorage.getItem("cc_auth_token");
  if (!token || !isSessionIdle()) return false;
  setStoredToken(null);
  setStoredAccount(null);
  const url = API_BASE ? `${API_BASE}/api/auth/logout` : "/api/auth/logout";
  void fetch(url, { method: "POST", credentials: "include" }).catch(() => {});
  return true;
}

export function getStoredToken(): string | null {
  expireIdleSession();
  return localStorage.getItem("cc_auth_token") || sessionStorage.getItem("cc_auth_token");
}

export function setStoredToken(token: string | null, remember: boolean = true) {
  localStorage.removeItem("cc_auth_token");
  sessionStorage.removeItem("cc_auth_token");
  if (token) {
    touchSession();
    if (remember) {
      localStorage.setItem("cc_auth_token", token);
    } else {
      sessionStorage.setItem("cc_auth_token", token);
    }
  } else {
    localStorage.removeItem(LAST_ACTIVE_KEY);
  }
}

export function getStoredAccount(): UserAccount | null {
  expireIdleSession();
  try {
    const raw = localStorage.getItem("campus-connect-account") || sessionStorage.getItem("campus-connect-account");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredAccount(account: UserAccount | null, remember: boolean = true) {
  localStorage.removeItem("campus-connect-account");
  sessionStorage.removeItem("campus-connect-account");
  if (account) {
    if (remember) {
      localStorage.setItem("campus-connect-account", JSON.stringify(account));
    } else {
      sessionStorage.setItem("campus-connect-account", JSON.stringify(account));
    }
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getStoredToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const url = API_BASE ? `${API_BASE}${path}` : path;
  const res = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });
  if (res.status === 204) {
    return undefined as T;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.details && data.details.fieldErrors) {
      const messages = Object.entries(data.details.fieldErrors)
        .map(([field, errs]) => `${field}: ${(errs as string[]).join(", ")}`)
        .join("; ");
      throw new Error(`${data.error}: ${messages}`);
    }
    throw new Error(data.error || "Request failed");
  }
  return data as T;
}

export function formatBackendUser(rawUser: any): UserAccount {
  const profile = rawUser.profile || {};
  const name =
    rawUser.name ||
    `${rawUser.firstName || ""} ${rawUser.lastName || ""}`.trim() ||
    rawUser.email.split("@")[0];

  const roleUpper = (rawUser.role || "STUDENT").toUpperCase();
  const accountType: AccountType =
    roleUpper === "STAFF" ? "Staff" : roleUpper === "ADMIN" ? "Admin" : "Student";

  const expRaw = profile.experience || "Beginner";
  const experience: Experience =
    expRaw === "Intermediate" ? "Intermediate" : expRaw === "Advanced" ? "Advanced" : "Beginner";

  return {
    id: rawUser.id,
    name,
    email: rawUser.email,
    accountType,
    university: rawUser.institution || profile.institution || "",
    verified: rawUser.isActive !== false,
    createdAt: rawUser.createdAt || new Date().toISOString(),
    bio: profile.biography || profile.bio || "",
    techStack: profile.skills || profile.techStack || [],
    experience,
    availability: profile.availability || "",
    github: profile.githubLink || profile.github || "",
    imageUrl: profile.imageUrl || rawUser.imageUrl || "",
    onboardingComplete: Boolean(profile.onboardingComplete),
    onboardingSkipped: Boolean(profile.onboardingSkipped),
  };
}

export const api = {
  me: async () => {
    const res = await request<{ user: any }>("/api/auth/me");
    return { user: formatBackendUser(res.user) };
  },

  register: async (data: {
    email: string;
    password: string;
    name?: string;
    accountType?: AccountType;
    university?: string;
  }) => {
    const res = await request<{ user: any; token?: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (res.token) {
      setStoredToken(res.token, true);
    }
    const formatted = formatBackendUser(res.user);
    setStoredAccount(formatted, true);
    return { user: formatted, token: res.token };
  },

  login: async (email: string, password: string, remember: boolean = true) => {
    const res = await request<{ user: any; token?: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (res.token) {
      setStoredToken(res.token, remember);
    }
    const formatted = formatBackendUser(res.user);
    setStoredAccount(formatted, remember);
    return { user: formatted, token: res.token };
  },

  googleAuth: async (payload: { credential?: string; idToken?: string; code?: string }) => {
    const res = await request<{ user: any; token?: string }>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res.token) {
      setStoredToken(res.token, true);
    }
    const formatted = formatBackendUser(res.user);
    setStoredAccount(formatted, true);
    return { user: formatted, token: res.token };
  },

  getGoogleAuthUrl: () => request<{ url: string }>("/api/auth/google/url"),

  logout: async () => {
    try {
      await request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    } finally {
      setStoredToken(null);
      setStoredAccount(null);
    }
  },

  forgotPassword: (email: string) =>
    request<{ message: string; resetLink?: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (password: string, token?: string) =>
    request<{ message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ password, token }),
    }),

  confirmEmail: (email: string) =>
    request<{ ok: boolean; message: string }>("/api/auth/confirm-email", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  getProfile: async () => {
    const res = await request<{ profile: any }>("/api/profile/me");
    return res;
  },

  updateProfile: async (body: Partial<UserAccount>) => {
    const res = await request<{ profile: any }>("/api/profile/me", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return res;
  },

  listProjects: async (params: { q?: string; skill?: string; category?: string; status?: string } = {}) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.skill) search.set("skill", params.skill);
    if (params.category) search.set("category", params.category);
    if (params.status) search.set("status", params.status);
    const qs = search.toString();
    const res = await request<{ projects: any[] }>(`/api/projects${qs ? `?${qs}` : ""}`);
    const projects: Project[] = (res.projects || []).map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      category: p.category || "EdTech",
      techStack: p.techStack || p.requiredSkills || [],
      roles: p.roles || [],
      teamSize: p.teamSize || p.teamCapacity || 4,
      status: (p.displayStatus === "In progress" ? "In progress" : p.displayStatus === "Completed" ? "Completed" : "Open"),
      ownerEmail: p.ownerEmail || p.creator?.email || "",
      ownerName: p.ownerName || p.creator?.email || "Community Member",
      members: p.memberNames || [p.ownerName || "Member"],
      requests: p.requests || [],
    }));
    return { projects };
  },

  createProject: async (body: {
    title: string;
    description: string;
    category: string;
    techStack: string[];
    roles: string[];
    teamSize: number;
    status: ProjectStatus;
  }) => {
    const res = await request<{ project: any }>("/api/projects", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return res;
  },

  joinProject: async (projectId: string, message: string) => {
    return request<{ joinRequest: any }>(`/api/projects/${projectId}/join-requests`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  },

  decideJoinRequest: async (requestId: string, decision: "accepted" | "declined") => {
    return request<{ joinRequest: any }>(`/api/join-requests/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: decision }),
    });
  },

  listOpportunities: async () => {
    const res = await request<{ opportunities: Internship[] }>("/api/opportunities");
    return res;
  },

  createOpportunity: async (body: {
    title: string;
    company: string;
    location: string;
    skills: string[];
    applyUrl: string;
  }) => {
    return request<{ opportunity: Internship }>("/api/opportunities", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  getNotifications: async () => {
    const res = await request<{ notices: Notice[] }>("/api/notifications");
    return res;
  },

  markNotificationsRead: async () => {
    return request<{ ok: boolean }>("/api/notifications/read", { method: "PATCH" });
  },
};
