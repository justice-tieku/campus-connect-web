import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  getStoredAccount,
  getStoredToken,
  setStoredAccount,
  setStoredToken,
  type AccountType,
  type Experience,
  type Internship,
  type Notice,
  type Project,
  type UserAccount,
} from "./api";

export type View =
  | "home"
  | "signup"
  | "login"
  | "verify"
  | "forgot"
  | "reset"
  | "onboarding"
  | "dashboard"
  | "projects"
  | "internships"
  | "mentors"
  | "courses"
  | "profile"
  | "notifications";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1758270705317-3ef6142d306f?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1400";

const POPULAR_SKILLS = [
  "React",
  "TypeScript",
  "Python",
  "Node.js",
  "Figma",
  "Java",
  "Flutter",
  "Machine Learning",
];

const THEME_STORAGE_KEY = "campus-connect-theme";
const AVATAR_MAX_SIZE_MB = Number((import.meta as any).env?.VITE_AVATAR_MAX_SIZE_MB || 5);
const AVATAR_MAX_SIZE_BYTES = AVATAR_MAX_SIZE_MB * 1024 * 1024;
const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function routeFromHash(): View {
  const hash = window.location.hash.slice(1).split("?")[0] as View;
  const path = window.location.pathname.replace(/^\//, "").split("/")[0] as View;
  const target = hash || path;
  const validRoutes: View[] = [
    "signup",
    "login",
    "verify",
    "forgot",
    "reset",
    "onboarding",
    "dashboard",
    "projects",
    "internships",
    "mentors",
    "courses",
    "profile",
    "notifications",
  ];
  return validRoutes.includes(target) ? target : "home";
}

function resolveTheme(stored?: string | null): "light" | "dark" {
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

function readThemeFromStorage() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme);
}

function authStatusFromUrl() {
  const hashParams = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
  const searchParams = new URLSearchParams(window.location.search);
  const error = hashParams.get("error") || searchParams.get("error");
  if (!error) return "";
  if (error === "google_not_configured") {
    return "Google sign-in is not configured yet. Ask an admin to set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the backend.";
  }
  if (error === "google_auth_failed") {
    return "Google sign-in was cancelled before completing authentication.";
  }
  if (error === "missing_id_token" || error === "invalid_payload" || error === "callback_failed") {
    return "Google sign-in failed. Please try again.";
  }
  return "Google sign-in could not be completed.";
}

function Icon({
  children,
  size = 20,
  className = "",
}: {
  children: ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {children}
    </svg>
  );
}

function ArrowIcon() {
  return (
    <Icon size={18}>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </Icon>
  );
}

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: "light" | "dark";
  onToggle: () => void;
}) {
  const isDark = theme === "dark";
  return (
    <button
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      className="theme-toggle"
      onClick={onToggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      type="button"
    >
      {isDark ? (
        <Icon size={18}>
          <path
            d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.66 5.66 1.41 1.41M4.93 4.93l1.41 1.41m0 11.32-1.41 1.41m12.73-12.73 1.41-1.41M12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
        </Icon>
      ) : (
        <Icon size={18}>
          <path
            d="M21 12.79A9 9 0 1 1 11.21 3c.15 0 .3 0 .45.02A7 7 0 0 0 21 12.79Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
        </Icon>
      )}
    </button>
  );
}

function Logo({ onClick }: { onClick: () => void }) {
  return (
    <button className="brand" onClick={onClick} type="button">
      <span className="brand-mark">
        <span />
        <span />
        <span />
      </span>
      <span>Campus Connect</span>
    </button>
  );
}

function GoogleButton({
  text = "Continue with Google",
  onError,
  disabled = false,
}: {
  text?: string;
  onError: (error: string) => void;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await fallbackAuth();
    } catch (err: any) {
      setLoading(false);
      onError(err.message || "Failed to initiate Google sign in.");
    }
  };

  const fallbackAuth = async () => {
    try {
      const res = await api.getGoogleAuthUrl();
      if (res?.url) {
        window.location.href = res.url;
      } else {
        throw new Error(
          "Google OAuth configuration pending. Please configure GOOGLE_CLIENT_ID in your environment.",
        );
      }
    } catch (err: any) {
      setLoading(false);
      onError(err.message || "Google authentication requires GOOGLE_CLIENT_ID configuration.");
    }
  };

  return (
    <button
      className="google-btn"
      disabled={disabled || loading}
      onClick={handleClick}
      type="button"
    >
      <svg className="google-icon" viewBox="0 0 24 24">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          fill="#EA4335"
        />
      </svg>
      <span>{loading ? "Connecting to Google..." : text}</span>
    </button>
  );
}

function Header({
  navigate,
  simple = false,
  theme,
  onToggleTheme,
}: {
  navigate: (view: View) => void;
  simple?: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  return (
    <header className={`site-header ${simple ? "simple" : ""}`}>
      <Logo onClick={() => navigate("home")} />
      {!simple && (
        <>
          <nav aria-label="Main navigation" className="desktop-nav">
            <button
              onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
              type="button"
            >
              How it works
            </button>
            <button
              onClick={() => document.getElementById("community")?.scrollIntoView({ behavior: "smooth" })}
              type="button"
            >
              Community
            </button>
            <button
              onClick={() => document.getElementById("opportunities")?.scrollIntoView({ behavior: "smooth" })}
              type="button"
            >
              Opportunities
            </button>
          </nav>
          <div className="header-actions">
            <ThemeToggle onToggle={onToggleTheme} theme={theme} />
            <button className="text-button" onClick={() => navigate("login")} type="button">
              Log in
            </button>
            <button
              className="button button-dark button-small"
              onClick={() => navigate("signup")}
              type="button"
            >
              Join Campus Connect
            </button>
          </div>
        </>
      )}
      {simple && (
        <div className="header-actions">
          <ThemeToggle onToggle={onToggleTheme} theme={theme} />
          <button className="text-button back-home" onClick={() => navigate("home")} type="button">
            <Icon size={17}>
              <path
                d="M19 12H5m6 6-6-6 6-6"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </Icon>
            Back to home
          </button>
        </div>
      )}
    </header>
  );
}

function Landing({
  navigate,
  theme,
  onToggleTheme,
}: {
  navigate: (view: View) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  return (
    <div className="page-shell">
      <Header navigate={navigate} onToggleTheme={onToggleTheme} theme={theme} />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              The global student builder community
            </div>
            <h1>
              Find your people.
              <br />
              <em>Build what matters.</em>
            </h1>
            <p>
              Meet ambitious students, team up on real-world projects, and discover internship
              opportunities made for emerging talent.
            </p>
            <div className="hero-actions">
              <button
                className="button button-coral"
                onClick={() => navigate("signup")}
                type="button"
              >
                Create your account <ArrowIcon />
              </button>
              <button
                className="button button-ghost"
                onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
                type="button"
              >
                See how it works
              </button>
            </div>
            <div className="member-proof">
              <div className="avatar-stack" aria-hidden="true">
                <span>AM</span>
                <span>JK</span>
                <span>SL</span>
                <span>+</span>
              </div>
              <p>
                <strong>2,400+ students</strong>
                <br />
                already building together
              </p>
            </div>
          </div>

          <div className="hero-visual">
            <div className="image-frame">
              <img alt="University students collaborating around a laptop" src={HERO_IMAGE} />
              <a
                className="photo-credit"
                href="https://unsplash.com/@silverkblack"
                rel="noreferrer"
                target="_blank"
              >
                Photo by Vitaly Gariev
              </a>
            </div>
            <div className="project-card floating-card">
              <span className="card-kicker">Trending project</span>
              <div className="project-title-row">
                <span className="project-icon">
                  <Icon size={20}>
                    <path
                      d="M5 8.5 12 4l7 4.5v7L12 20l-7-4.5v-7Z"
                      stroke="currentColor"
                      strokeLinejoin="round"
                      strokeWidth="1.7"
                    />
                    <path
                      d="m8.5 11 2 2 4.5-4.5"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.7"
                    />
                  </Icon>
                </span>
                <div>
                  <strong>StudySync</strong>
                  <small>Productivity · EdTech</small>
                </div>
              </div>
              <div className="stack-list">
                <span>React</span>
                <span>Node.js</span>
                <span>Figma</span>
              </div>
              <div className="card-meta">
                <span>4 builders</span>
                <b>2 spots open</b>
              </div>
            </div>
            <div className="match-pill">
              <span>
                <Icon size={17}>
                  <path
                    d="m12 3 1.35 4.15a2 2 0 0 0 1.28 1.28L19 10l-4.37 1.57a2 2 0 0 0-1.28 1.28L12 17l-1.35-4.15a2 2 0 0 0-1.28-1.28L5 10l4.37-1.57a2 2 0 0 0 1.28-1.28L12 3Z"
                    fill="currentColor"
                  />
                </Icon>
              </span>
              94% skill match
            </div>
          </div>
        </section>

        <section className="how-section" id="how-it-works">
          <div className="section-heading">
            <div>
              <span className="section-label">HOW IT WORKS</span>
              <h2>Your next big idea starts here.</h2>
            </div>
            <p>
              From a spark of an idea to a project you’re proud to share. Campus Connect helps you
              find the right people at every step.
            </p>
          </div>
          <div className="steps-grid">
            <article>
              <span className="step-number">01</span>
              <div className="step-icon blue">
                <Icon size={26}>
                  <path
                    d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.7"
                  />
                </Icon>
              </div>
              <h3>Post your project</h3>
              <p>Share your idea, the skills you need, and the impact you want to make.</p>
              <span className="step-link">
                Bring an idea to life <ArrowIcon />
              </span>
            </article>
            <article>
              <span className="step-number">02</span>
              <div className="step-icon yellow">
                <Icon size={26}>
                  <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
                  <path
                    d="m16 16 4 4M11 8v6M8 11h6"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.7"
                  />
                </Icon>
              </div>
              <h3>Get matched</h3>
              <p>Our matching system connects your tech stack with students ready to contribute.</p>
              <span className="step-link">
                Meet your teammates <ArrowIcon />
              </span>
            </article>
            <article>
              <span className="step-number">03</span>
              <div className="step-icon coral">
                <Icon size={26}>
                  <path
                    d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.7"
                  />
                </Icon>
              </div>
              <h3>Join &amp; build</h3>
              <p>Request to join a team, collaborate across borders, and build something real.</p>
              <span className="step-link">
                Start collaborating <ArrowIcon />
              </span>
            </article>
          </div>
        </section>

        <section className="community-section" id="community">
          <span className="section-label">BUILT FOR CURIOUS PEOPLE</span>
          <h2>
            Different perspectives.
            <br />
            <em>One shared ambition.</em>
          </h2>
          <div className="community-grid">
            <div>
              <strong>2.4k+</strong>
              <span>Student builders</span>
            </div>
            <div>
              <strong>68</strong>
              <span>Universities</span>
            </div>
            <div>
              <strong>42</strong>
              <span>Countries represented</span>
            </div>
            <div>
              <strong>320+</strong>
              <span>Projects launched</span>
            </div>
          </div>
        </section>

        <section className="cta-section" id="opportunities">
          <div>
            <span className="section-label">YOUR PEOPLE ARE HERE</span>
            <h2>
              Ready to build something <em>remarkable?</em>
            </h2>
          </div>
          <button
            className="button button-coral"
            onClick={() => navigate("signup")}
            type="button"
          >
            Join the community <ArrowIcon />
          </button>
        </section>
      </main>
      <footer>
        <Logo onClick={() => navigate("home")} />
        <p>Where student ideas become real-world experience.</p>
        <div>
          <button type="button">About</button>
          <button type="button">Terms</button>
          <button type="button">Privacy</button>
          <button type="button">Contact</button>
        </div>
        <small>© 2026 Campus Connect</small>
      </footer>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className={`field ${error ? "has-error" : ""}`}>
      <span>{label}</span>
      {children}
      {error && <small>{error}</small>}
    </label>
  );
}

function AuthAside() {
  return (
    <aside className="auth-aside">
      <div className="auth-aside-content">
        <span className="aside-badge">BUILD BEYOND THE CLASSROOM</span>
        <blockquote>
          “The best way to predict the future is to <em>build it together.</em>”
        </blockquote>
        <div className="aside-line" />
        <p>Join students from 68 universities who are turning ideas into experience.</p>
      </div>
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="code-chip chip-one">{"{ build: together }"}</div>
      <div className="code-chip chip-two">idea → impact</div>
    </aside>
  );
}

function Signup({
  navigate,
  onAccountCreated,
  theme,
  onToggleTheme,
}: {
  navigate: (view: View) => void;
  onAccountCreated: (account: UserAccount) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    accountType: "Student" as AccountType,
    university: "",
    terms: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generalError, setGeneralError] = useState("");

  const update = (key: string, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setGeneralError("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = "Please enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email address.";
    if (form.password.length < 8) next.password = "Use at least 8 characters.";
    if (form.password !== form.confirmPassword) next.confirmPassword = "Passwords do not match.";
    if (!form.university.trim()) next.university = "Please enter your university.";
    if (!form.terms) next.terms = "You must accept the terms to continue.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    setGeneralError("");
    try {
      const res = await api.register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        accountType: form.accountType,
        university: form.university.trim(),
      });
      onAccountCreated(res.user);
      navigate("verify");
    } catch (err: any) {
      const msg = err.message || "Failed to create account.";
      if (msg.toLowerCase().includes("already exists")) {
        setErrors({ email: "An account with this email already exists." });
      } else {
        setGeneralError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <Header navigate={navigate} onToggleTheme={onToggleTheme} simple theme={theme} />
      <div className="auth-layout">
        <AuthAside />
        <main className="auth-main">
          <form className="auth-form" onSubmit={submit} noValidate>
            <span className="form-kicker">START YOUR JOURNEY</span>
            <h1>Create your account</h1>
            <p className="form-intro">Build your profile, find your people, and start creating.</p>

            {generalError && <div className="form-alert">{generalError}</div>}

            <GoogleButton
              disabled={busy}
              onError={(err) => setGeneralError(err)}
              text="Sign up with Google"
            />

            <div className="oauth-divider">or register with email</div>

            <Field error={errors.name} label="Full name">
              <input
                autoComplete="name"
                disabled={busy}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Alex Morgan"
                value={form.name}
              />
            </Field>
            <Field error={errors.email} label="Email address">
              <input
                autoComplete="email"
                disabled={busy}
                onChange={(e) => update("email", e.target.value)}
                placeholder="you@university.edu"
                type="email"
                value={form.email}
              />
            </Field>
            <div className="field-row">
              <Field error={errors.password} label="Password">
                <span className="input-wrap">
                  <input
                    autoComplete="new-password"
                    disabled={busy}
                    onChange={(e) => update("password", e.target.value)}
                    placeholder="At least 8 characters"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                  />
                  <button
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="eye-button"
                    onClick={() => setShowPassword((shown) => !shown)}
                    type="button"
                  >
                    <Icon size={18}>
                      <path
                        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
                    </Icon>
                  </button>
                </span>
              </Field>
              <Field error={errors.confirmPassword} label="Confirm password">
                <input
                  autoComplete="new-password"
                  disabled={busy}
                  onChange={(e) => update("confirmPassword", e.target.value)}
                  placeholder="Repeat password"
                  type="password"
                  value={form.confirmPassword}
                />
              </Field>
            </div>

            <fieldset className="account-type">
              <legend>I am a</legend>
              <div>
                {(["Student", "Staff"] as AccountType[]).map((type) => (
                  <label className={form.accountType === type ? "selected" : ""} key={type}>
                    <input
                      checked={form.accountType === type}
                      disabled={busy}
                      name="accountType"
                      onChange={() => update("accountType", type)}
                      type="radio"
                    />
                    <span className="radio-dot" />
                    <span>
                      <strong>{type}</strong>
                      <small>
                        {type === "Student"
                          ? "Looking to build & learn"
                          : "Supporting student talent"}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <Field error={errors.university} label="University name">
              <input
                disabled={busy}
                onChange={(e) => update("university", e.target.value)}
                placeholder="Start typing your university"
                value={form.university}
              />
            </Field>

            <label className={`terms-check ${errors.terms ? "has-error" : ""}`}>
              <input
                checked={form.terms}
                disabled={busy}
                onChange={(e) => update("terms", e.target.checked)}
                type="checkbox"
              />
              <span className="custom-check">
                <Icon size={13}>
                  <path
                    d="m3 6.5 2 2L10 3.5"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </Icon>
              </span>
              <span>
                I agree to the <button type="button">Terms of Service</button> and{" "}
                <button type="button">Privacy Policy</button>.
              </span>
            </label>
            {errors.terms && <p className="terms-error">{errors.terms}</p>}

            <button className="button button-coral submit-button" disabled={busy} type="submit">
              {busy ? "Creating account..." : "Create my account"} <ArrowIcon />
            </button>
            <p className="auth-switch">
              Already part of the community?{" "}
              <button onClick={() => navigate("login")} type="button">
                Log in
              </button>
            </p>
          </form>
        </main>
      </div>
    </div>
  );
}

function Verify({
  account,
  navigate,
  onVerified,
  theme,
  onToggleTheme,
}: {
  account: UserAccount | null;
  navigate: (view: View) => void;
  onVerified: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  if (!account) {
    return (
      <div className="auth-page">
        <Header navigate={navigate} onToggleTheme={onToggleTheme} simple theme={theme} />
        <main className="verify-main">
          <h1>Account Verification</h1>
          <p>Please log in or create an account first.</p>
          <button className="button button-dark" onClick={() => navigate("login")} type="button">
            Go to login
          </button>
        </main>
      </div>
    );
  }

  const handleConfirm = async () => {
    setVerifying(true);
    setError("");
    try {
      await api.confirmEmail(account.email);
      setConfirmed(true);
      onVerified();
      setTimeout(() => navigate("login"), 1500);
    } catch (err: any) {
      setError(err.message || "Failed to confirm email.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="auth-page">
      <Header navigate={navigate} onToggleTheme={onToggleTheme} simple theme={theme} />
      <main className="verify-main">
        <div className="mail-illustration">
          <div className="mail-ring" />
          <Icon size={52}>
            <path
              d="M3 6.5h18v12H3v-12Z"
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="1.4"
            />
            <path d="m4 8 8 6 8-6" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4" />
          </Icon>
          <span className="mail-spark spark-a" />
          <span className="mail-spark spark-b" />
        </div>
        <span className="form-kicker">ONE LAST STEP</span>
        <h1>{confirmed ? "Email verified!" : "Check your inbox"}</h1>
        <p>
          We sent a verification confirmation for <strong>{account.email}</strong>. Activate your
          Campus Connect account to continue.
        </p>

        {error && <div className="form-alert">{error}</div>}

        {!confirmed ? (
          <button
            className="button button-coral verify-link"
            disabled={verifying}
            onClick={handleConfirm}
            type="button"
          >
            {verifying ? "Verifying..." : "Confirm verification link"} <ArrowIcon />
          </button>
        ) : (
          <button className="button button-dark verify-link" onClick={() => navigate("login")} type="button">
            Continue to log in <ArrowIcon />
          </button>
        )}

        <div className="verify-note">
          <Icon size={18}>
            <path
              d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.6"
            />
          </Icon>
          Click above to instantly confirm your university credentials.
        </div>
        <p className="resend">
          Ready to access your workspace?{" "}
          <button onClick={() => navigate("login")} type="button">
            Return to log in
          </button>
        </p>
      </main>
    </div>
  );
}

function Login({
  navigate,
  onLoginSuccess,
  theme,
  onToggleTheme,
}: {
  navigate: (view: View) => void;
  onLoginSuccess: (account: UserAccount, remember: boolean) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(() => authStatusFromUrl());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const [hashRoute, hashQuery] = window.location.hash.split("?");
    const hashParams = new URLSearchParams(hashQuery ?? "");
    const searchParams = new URLSearchParams(window.location.search);
    let changed = false;
    if (hashParams.has("error")) {
      hashParams.delete("error");
      changed = true;
    }
    if (searchParams.has("error")) {
      searchParams.delete("error");
      changed = true;
    }
    if (changed) {
      const nextHashQuery = hashParams.toString();
      const nextSearch = searchParams.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${hashRoute}${nextHashQuery ? `?${nextHashQuery}` : ""}`;
      window.history.replaceState({}, document.title, nextUrl);
    }
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Please enter both your email address and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api.login(email.trim().toLowerCase(), password, remember);
      onLoginSuccess(res.user, remember);
      navigate(res.user.onboardingComplete ? "dashboard" : "onboarding");
    } catch (err: any) {
      setError(err.message || "The email or password you entered is incorrect.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <Header navigate={navigate} onToggleTheme={onToggleTheme} simple theme={theme} />
      <div className="auth-layout login-layout">
        <AuthAside />
        <main className="auth-main">
          <form className="auth-form login-form" onSubmit={submit}>
            <span className="form-kicker">WELCOME BACK</span>
            <h1>Log in to keep building</h1>
            <p className="form-intro">Your next collaboration is waiting.</p>

            {error && (
              <div className="form-alert">
                <Icon size={18}>
                  <path
                    d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                </Icon>
                {error}
              </div>
            )}

            <GoogleButton
              disabled={busy}
              onError={(err) => setError(err)}
              text="Log in with Google"
            />

            <div className="oauth-divider">or sign in with password</div>

            <Field label="Email address">
              <input
                autoComplete="email"
                disabled={busy}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="you@university.edu"
                type="email"
                value={email}
              />
            </Field>
            <Field label="Password">
              <input
                autoComplete="current-password"
                disabled={busy}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="Your password"
                type="password"
                value={password}
              />
            </Field>
            <div className="login-options">
              <label className="remember-check">
                <input
                  checked={remember}
                  disabled={busy}
                  onChange={(e) => setRemember(e.target.checked)}
                  type="checkbox"
                />
                <span className="custom-check">
                  <Icon size={13}>
                    <path
                      d="m3 6.5 2 2L10 3.5"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </Icon>
                </span>
                Remember me
              </label>
              <button onClick={() => navigate("forgot")} type="button">
                Forgot password?
              </button>
            </div>
            <button className="button button-coral submit-button" disabled={busy} type="submit">
              {busy ? "Signing in..." : "Log in"} <ArrowIcon />
            </button>
            <p className="auth-switch">
              New to Campus Connect?{" "}
              <button onClick={() => navigate("signup")} type="button">
                Create an account
              </button>
            </p>
          </form>
        </main>
      </div>
    </div>
  );
}

function ForgotPassword({
  navigate,
  theme,
  onToggleTheme,
}: {
  navigate: (view: View) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const [email, setEmail] = useState("");
  const [sentLink, setSentLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.forgotPassword(email.trim().toLowerCase());
      setSentLink(res.resetLink || "sent");
    } catch (err: any) {
      setError(err.message || "Failed to process password reset request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <Header navigate={navigate} onToggleTheme={onToggleTheme} simple theme={theme} />
      <main className="recovery-main">
        <span className="recovery-icon">
          <Icon size={30}>
            <path
              d="M4 10V8a8 8 0 0 1 15.5-2.7M20 14v2a8 8 0 0 1-15.5 2.7M3 4v5h5M21 20v-5h-5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.7"
            />
          </Icon>
        </span>
        <span className="form-kicker">ACCOUNT RECOVERY</span>
        <h1>Reset your password</h1>
        <p>Enter your account email and we’ll send a secure reset link that expires in 30 minutes.</p>

        {error && <div className="form-alert">{error}</div>}

        {!sentLink ? (
          <form onSubmit={submit}>
            <Field label="Email address">
              <input
                autoFocus
                disabled={busy}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@university.edu"
                required
                type="email"
                value={email}
              />
            </Field>
            <button className="button button-coral submit-button" disabled={busy} type="submit">
              {busy ? "Sending..." : "Send reset link"} <ArrowIcon />
            </button>
          </form>
        ) : (
          <div className="recovery-sent">
            <strong>Check your inbox</strong>
            <p>If an account exists for that email, a secure reset link has been dispatched.</p>
            {sentLink !== "sent" && (
              <a className="button button-dark" href={sentLink}>
                Open secure reset link
              </a>
            )}
          </div>
        )}
        <button className="text-button recovery-back" onClick={() => navigate("login")} type="button">
          Back to login
        </button>
      </main>
    </div>
  );
}

function ResetPassword({
  navigate,
  theme,
  onToggleTheme,
}: {
  navigate: (view: View) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const params = new URLSearchParams(window.location.hash.split("?")[1] ?? window.location.search);
  const token = params.get("token") || undefined;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");

    setBusy(true);
    setError("");
    try {
      await api.resetPassword(password, token);
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Failed to update password. Link may have expired.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <Header navigate={navigate} onToggleTheme={onToggleTheme} simple theme={theme} />
      <main className="recovery-main">
        <span className="form-kicker">SECURE RESET</span>
        <h1>{done ? "Password updated" : "Choose a new password"}</h1>
        {done ? (
          <div className="recovery-sent">
            <p>Your password was changed successfully. You can now log in.</p>
            <button className="button button-coral" onClick={() => navigate("login")} type="button">
              Continue to login
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            {error && <div className="form-alert">{error}</div>}
            <Field label="New password">
              <input
                autoFocus
                disabled={busy}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                type="password"
                value={password}
              />
            </Field>
            <Field label="Confirm new password">
              <input
                disabled={busy}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat new password"
                type="password"
                value={confirm}
              />
            </Field>
            <button className="button button-coral submit-button" disabled={busy} type="submit">
              {busy ? "Updating..." : "Update password"} <ArrowIcon />
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

function Onboarding({
  account,
  onSave,
  onSkip,
}: {
  account: UserAccount;
  onSave: (profile: Partial<UserAccount>) => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  const [bio, setBio] = useState(account.bio || "");
  const [skills, setSkills] = useState<string[]>(account.techStack || []);
  const [experience, setExperience] = useState<Experience>(account.experience || "Beginner");
  const [availability, setAvailability] = useState(account.availability || "");
  const [github, setGithub] = useState(account.github || "");
  const [busy, setBusy] = useState(false);

  const toggleSkill = (skill: string) =>
    setSkills((current) =>
      current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill],
    );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await onSave({
        bio,
        techStack: skills,
        experience,
        availability,
        github,
        onboardingComplete: true,
        onboardingSkipped: false,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onboarding-page">
      <header>
        <Logo onClick={() => undefined} />
        <span>Step 1 of 1</span>
      </header>
      <main>
        <div className="onboarding-heading">
          <span className="form-kicker">MAKE IT YOURS</span>
          <h1>
            Tell us how you like to <em>build.</em>
          </h1>
          <p>This helps us recommend the right projects, teammates, and opportunities.</p>
        </div>
        <form className="profile-form" onSubmit={submit}>
          <Field label="Short bio">
            <textarea
              disabled={busy}
              maxLength={240}
              onChange={(e) => setBio(e.target.value)}
              placeholder="What are you curious about? What do you want to build?"
              value={bio}
            />
          </Field>
          <fieldset className="skills-field">
            <legend>
              Tech stack <span>Select all that apply</span>
            </legend>
            <div>
              {POPULAR_SKILLS.map((skill) => (
                <button
                  className={skills.includes(skill) ? "selected" : ""}
                  disabled={busy}
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  type="button"
                >
                  {skill}
                  {skills.includes(skill) && " ×"}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="field-row">
            <label className="field">
              <span>Experience level</span>
              <select
                disabled={busy}
                onChange={(e) => setExperience(e.target.value as Experience)}
                value={experience}
              >
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </label>
            <label className="field">
              <span>Availability</span>
              <select
                disabled={busy}
                onChange={(e) => setAvailability(e.target.value)}
                value={availability}
              >
                <option value="">Select availability</option>
                <option>1–5 hours / week</option>
                <option>6–10 hours / week</option>
                <option>10+ hours / week</option>
              </select>
            </label>
          </div>
          <Field label="GitHub profile (optional)">
            <input
              disabled={busy}
              onChange={(e) => setGithub(e.target.value)}
              placeholder="https://github.com/username"
              type="url"
              value={github}
            />
          </Field>
          <div className="onboarding-actions">
            <button className="text-button" disabled={busy} onClick={onSkip} type="button">
              Skip for now
            </button>
            <button className="button button-coral" disabled={busy} type="submit">
              {busy ? "Saving..." : "Save and continue"} <ArrowIcon />
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function AppShell({
  account,
  view,
  navigate,
  onLogout,
  onSaveProfile,
  onUploadAvatar,
  onRemoveAvatar,
  theme,
  onToggleTheme,
  projects,
  notices,
  onCreateProject,
  onJoinProject,
  onRequestDecision,
  onReadNotices,
  internships,
  onCreateInternship,
}: {
  account: UserAccount;
  view: View;
  navigate: (view: View) => void;
  onLogout: () => void;
  onSaveProfile: (profile: Partial<UserAccount>) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<void>;
  onRemoveAvatar: () => Promise<void>;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  projects: Project[];
  notices: Notice[];
  onCreateProject: (project: any) => Promise<void>;
  onJoinProject: (projectId: string, message: string) => Promise<void>;
  onRequestDecision: (
    projectId: string,
    requestId: string,
    decision: "accepted" | "declined",
  ) => Promise<void>;
  onReadNotices: () => Promise<void>;
  internships: Internship[];
  onCreateInternship: (data: any) => Promise<void>;
}) {
  const firstName = account.name.split(" ")[0] || account.email.split("@")[0];
  const initials = account.name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("") || "CC";

  const nav: { label: string; view: View }[] = [
    { label: "Dashboard", view: "dashboard" },
    { label: "Projects", view: "projects" },
    { label: "Internships", view: "internships" },
    { label: "Mentors", view: "mentors" },
    { label: "Courses", view: "courses" },
    { label: "Profile", view: "profile" },
    { label: "Notifications", view: "notifications" },
  ];

  const openProjectsCount = projects.filter((p) => p.status === "Open").length;
  const unreadNoticesCount = notices.filter((n) => !n.read).length;

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Logo onClick={() => navigate("dashboard")} />
        <nav>
          {nav.map((item, index) => (
            <button
              className={view === item.view ? "active" : ""}
              key={`${item.label}-${index}`}
              onClick={() => navigate(item.view)}
              type="button"
            >
              <span>{item.label.slice(0, 1)}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <button className="logout-button" onClick={onLogout} type="button">
          <Icon size={17}>
            <path
              d="M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.7"
            />
          </Icon>
          Log out
        </button>
      </aside>
      <div className="app-content">
        <header className="app-topbar">
          <div className="topbar-status">
            <span className="status-dot" />
            Campus community online
          </div>
          <div className="topbar-actions">
            <ThemeToggle onToggle={onToggleTheme} theme={theme} />
            <button className="topbar-user" onClick={() => navigate("profile")} type="button">
              <span style={account.imageUrl ? { backgroundImage: `url(${account.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'transparent' } : {}}>{!account.imageUrl && initials}</span>
              <div>
                <strong>{account.name}</strong>
                <small>{account.accountType}</small>
              </div>
            </button>
          </div>
        </header>
        <main>
          {account.onboardingSkipped && !account.onboardingComplete && (
            <div className="profile-reminder">
              <span>Complete your profile to improve project matches.</span>
              <button onClick={() => navigate("onboarding")} type="button">
                Finish setup
              </button>
            </div>
          )}

          {view === "profile" ? (
            <Profile
              account={account}
              onRemoveAvatar={onRemoveAvatar}
              onSave={onSaveProfile}
              onUploadAvatar={onUploadAvatar}
            />
          ) : view === "projects" ? (
            <ProjectsHub
              account={account}
              onCreate={onCreateProject}
              onDecision={onRequestDecision}
              onJoin={onJoinProject}
              projects={projects}
            />
          ) : view === "internships" ? (
            <InternshipsPage
              canPost={account.accountType !== "Student"}
              internships={internships}
              onCreate={onCreateInternship}
            />
          ) : view === "mentors" ? (
            <MentorsPage />
          ) : view === "courses" ? (
            <CoursesPage />
          ) : view === "notifications" ? (
            <NotificationsPage notices={notices} onRead={onReadNotices} />
          ) : view === "dashboard" ? (
            <>
              <div className="app-heading">
                <span className="form-kicker">YOUR CAMPUS</span>
                <h1>
                  Good to see you, <em>{firstName}.</em>
                </h1>
                <p>Here’s what’s happening in your builder community.</p>
              </div>
              <div className="quick-grid">
                <article>
                  <span>OPEN PROJECTS</span>
                  <strong>{openProjectsCount}</strong>
                  <p>Find a team and start building.</p>
                  <button onClick={() => navigate("projects")} type="button">
                    Explore projects <ArrowIcon />
                  </button>
                </article>
                <article>
                  <span>INTERNSHIP MATCHES</span>
                  <strong>{internships.length}</strong>
                  <p>Opportunities matching your profile.</p>
                  <button onClick={() => navigate("internships")} type="button">
                    Browse internships <ArrowIcon />
                  </button>
                </article>
                <article>
                  <span>NOTIFICATIONS</span>
                  <strong>{unreadNoticesCount}</strong>
                  <p>
                    {unreadNoticesCount > 0
                      ? `${unreadNoticesCount} unread notification(s).`
                      : "You’re all caught up for now."}
                  </p>
                  <button onClick={() => navigate("notifications")} type="button">
                    View activity <ArrowIcon />
                  </button>
                </article>
              </div>
              <section className="empty-feed">
                <span className="empty-mark">CC</span>
                <h2>Your next collaboration starts here</h2>
                <p>Projects and updates from your university peers appear in real time.</p>
                <button
                  className="button button-dark"
                  onClick={() => navigate("projects")}
                  type="button"
                >
                  Discover projects
                </button>
              </section>
            </>
          ) : (
            <PlaceholderPage view={view} />
          )}
        </main>
      </div>
    </div>
  );
}

function ProjectsHub({
  account,
  projects,
  onCreate,
  onJoin,
  onDecision,
}: {
  account: UserAccount;
  projects: Project[];
  onCreate: (project: any) => Promise<void>;
  onJoin: (projectId: string, message: string) => Promise<void>;
  onDecision: (
    projectId: string,
    requestId: string,
    decision: "accepted" | "declined",
  ) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [category, setCategory] = useState("All");
  const [skill, setSkill] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [joinProject, setJoinProject] = useState<Project | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState({
    title: "",
    description: "",
    category: "EdTech",
    tech: "",
    roles: "",
    teamSize: "4",
    status: "Open" as Project["status"],
  });

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(projects.map((p) => p.category).filter(Boolean)))],
    [projects],
  );
  const skills = useMemo(
    () => ["All", ...Array.from(new Set(projects.flatMap((p) => p.techStack || []).filter(Boolean)))],
    [projects],
  );

  const filtered = useMemo(() => {
    return projects.filter((project) => {
      const term = search.toLowerCase();
      const matchesSearch =
        !term || `${project.title} ${project.description}`.toLowerCase().includes(term);
      const matchesStatus = status === "All" || project.status === status;
      const matchesCategory = category === "All" || project.category === category;
      const matchesSkill = skill === "All" || (project.techStack || []).includes(skill);
      return matchesSearch && matchesStatus && matchesCategory && matchesSkill;
    });
  }, [projects, search, status, category, skill]);

  const submitProject = async (event: FormEvent) => {
    event.preventDefault();
    const techStack = created.tech
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const roles = created.roles
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!created.title.trim() || !created.description.trim() || !techStack.length || !roles.length)
      return;

    setSubmitting(true);
    try {
      await onCreate({
        title: created.title.trim(),
        description: created.description.trim(),
        category: created.category,
        techStack,
        roles,
        teamSize: Number(created.teamSize),
        status: created.status,
      });
      setCreated({
        title: "",
        description: "",
        category: "EdTech",
        tech: "",
        roles: "",
        teamSize: "4",
        status: "Open",
      });
      setShowCreate(false);
    } finally {
      setSubmitting(false);
    }
  };

  const submitJoin = async (event: FormEvent) => {
    event.preventDefault();
    if (!joinProject || !message.trim()) return;
    setSubmitting(true);
    try {
      await onJoin(joinProject.id, message.trim());
      setJoinProject(null);
      setMessage("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="projects-page">
      <div className="marketplace-heading">
        <div>
          <span className="form-kicker">BUILD TOGETHER</span>
          <h1>Discover projects</h1>
          <p>Find an idea that matches your skills—or start one of your own.</p>
        </div>
        <button
          className="button button-coral"
          onClick={() => setShowCreate((shown) => !shown)}
          type="button"
        >
          {showCreate ? "Close form" : "Post a project"}
        </button>
      </div>

      {showCreate && (
        <form className="create-panel" onSubmit={submitProject}>
          <div className="panel-title">
            <div>
              <span>NEW PROJECT</span>
              <h2>Share your idea</h2>
            </div>
            <p>Give future teammates enough detail to know where they can contribute.</p>
          </div>
          <div className="field-row">
            <Field label="Project title">
              <input
                disabled={submitting}
                onChange={(e) => setCreated({ ...created, title: e.target.value })}
                placeholder="e.g. Campus Food Rescue"
                required
                value={created.title}
              />
            </Field>
            <label className="field">
              <span>Category</span>
              <select
                disabled={submitting}
                onChange={(e) => setCreated({ ...created, category: e.target.value })}
                value={created.category}
              >
                <option>EdTech</option>
                <option>Climate</option>
                <option>Health</option>
                <option>Social impact</option>
                <option>Developer tools</option>
              </select>
            </label>
          </div>
          <Field label="Description">
            <textarea
              disabled={submitting}
              onChange={(e) => setCreated({ ...created, description: e.target.value })}
              placeholder="What are you building, and why does it matter?"
              required
              value={created.description}
            />
          </Field>
          <div className="field-row">
            <Field label="Tech stack tags">
              <input
                disabled={submitting}
                onChange={(e) => setCreated({ ...created, tech: e.target.value })}
                placeholder="React, Python, Figma"
                required
                value={created.tech}
              />
            </Field>
            <Field label="Roles needed">
              <input
                disabled={submitting}
                onChange={(e) => setCreated({ ...created, roles: e.target.value })}
                placeholder="Designer, Backend developer"
                required
                value={created.roles}
              />
            </Field>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Team size</span>
              <select
                disabled={submitting}
                onChange={(e) => setCreated({ ...created, teamSize: e.target.value })}
                value={created.teamSize}
              >
                {[2, 3, 4, 5, 6, 8, 10].map((size) => (
                  <option key={size}>{size}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Status</span>
              <select
                disabled={submitting}
                onChange={(e) =>
                  setCreated({ ...created, status: e.target.value as Project["status"] })
                }
                value={created.status}
              >
                <option>Open</option>
                <option>In progress</option>
                <option>Completed</option>
              </select>
            </label>
          </div>
          <button className="button button-dark" disabled={submitting} type="submit">
            {submitting ? "Publishing..." : "Publish project"} <ArrowIcon />
          </button>
        </form>
      )}

      <div className="project-filters">
        <label className="search-field">
          <Icon size={17}>
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
            <path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
          </Icon>
          <input
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects"
            value={search}
          />
        </label>
        <select
          aria-label="Filter by status"
          onChange={(e) => setStatus(e.target.value)}
          value={status}
        >
          <option>All</option>
          <option>Open</option>
          <option>In progress</option>
          <option>Completed</option>
        </select>
        <select
          aria-label="Filter by category"
          onChange={(e) => setCategory(e.target.value)}
          value={category}
        >
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          aria-label="Filter by skill"
          onChange={(e) => setSkill(e.target.value)}
          value={skill}
        >
          {skills.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>

      <div className="results-meta">
        <span>{filtered.length} projects</span>
        <span>Synced with backend</span>
      </div>

      <div className="project-grid">
        {filtered.map((project) => {
          const userTech = account.techStack || [];
          const matched = (project.techStack || []).filter((item) =>
            userTech.some((skillName) => skillName.toLowerCase() === item.toLowerCase()),
          );
          const ownProject = project.ownerEmail === account.email;
          const existingRequest = (project.requests || []).find(
            (request) => request.applicantEmail === account.email,
          );

          return (
            <article className="project-listing" key={project.id}>
              <div className="listing-top">
                <span className={`status-badge ${project.status.toLowerCase().replace(" ", "-")}`}>
                  {project.status}
                </span>
                <span>{project.category}</span>
              </div>
              <h2>{project.title}</h2>
              <p>{project.description}</p>
              {matched.length > 0 && (
                <div className="skill-match">
                  <Icon size={14}>
                    <path
                      d="m12 3 1.2 3.7a2 2 0 0 0 1.3 1.3l3.7 1.2-3.7 1.3a2 2 0 0 0-1.3 1.2L12 15.5l-1.2-3.8a2 2 0 0 0-1.3-1.2L5.7 9.2 9.5 8a2 2 0 0 0 1.3-1.3L12 3Z"
                      fill="currentColor"
                    />
                  </Icon>
                  Matches {matched.join(" + ")}
                </div>
              )}
              <div className="listing-tags">
                {(project.techStack || []).map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <div className="roles-needed">
                <small>LOOKING FOR</small>
                <p>{(project.roles || []).join(" · ") || "Collaborators"}</p>
              </div>
              <div className="listing-footer">
                <div>
                  <strong>{project.ownerName}</strong>
                  <small>
                    {(project.members || []).length} of {project.teamSize} members
                  </small>
                </div>
                {ownProject ? (
                  <span className="owner-label">Your project</span>
                ) : existingRequest ? (
                  <span className={`request-state ${existingRequest.status}`}>
                    {existingRequest.status}
                  </span>
                ) : (
                  <button
                    disabled={project.status !== "Open"}
                    onClick={() => setJoinProject(project)}
                    type="button"
                  >
                    Request to join
                  </button>
                )}
              </div>
              {ownProject && (project.requests || []).length > 0 && (
                <div className="request-list">
                  <strong>JOIN REQUESTS</strong>
                  {project.requests.map((request) => (
                    <div key={request.id}>
                      <span>
                        {request.applicantName}
                        <small>{request.message}</small>
                      </span>
                      {request.status === "pending" ? (
                        <span>
                          <button
                            onClick={() => onDecision(project.id, request.id, "declined")}
                            type="button"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => onDecision(project.id, request.id, "accepted")}
                            type="button"
                          >
                            Accept
                          </button>
                        </span>
                      ) : (
                        <b>{request.status}</b>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {joinProject && (
        <div className="dialog-backdrop" onMouseDown={() => setJoinProject(null)}>
          <form
            className="join-dialog"
            onMouseDown={(e) => e.stopPropagation()}
            onSubmit={submitJoin}
          >
            <span className="form-kicker">JOIN {joinProject.title.toUpperCase()}</span>
            <h2>Tell the team why you’d like to help.</h2>
            <Field label="Short message">
              <textarea
                autoFocus
                disabled={submitting}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Introduce yourself and share how your skills could contribute..."
                required
                value={message}
              />
            </Field>
            <div>
              <button
                className="text-button"
                disabled={submitting}
                onClick={() => setJoinProject(null)}
                type="button"
              >
                Cancel
              </button>
              <button className="button button-coral" disabled={submitting} type="submit">
                {submitting ? "Sending..." : "Send request"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function InternshipsPage({
  canPost,
  internships,
  onCreate,
}: {
  canPost: boolean;
  internships: Internship[];
  onCreate: (data: any) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    company: "",
    location: "",
    skills: "",
    applyUrl: "",
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onCreate({
        ...draft,
        skills: draft.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setShowForm(false);
      setDraft({ title: "", company: "", location: "", skills: "", applyUrl: "" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="opportunity-page">
      <div className="marketplace-heading">
        <div>
          <span className="form-kicker">CAREER LAUNCHPAD</span>
          <h1>Internships</h1>
          <p>Early-career opportunities shared by trusted campus partners.</p>
        </div>
        {canPost && (
          <button
            className="button button-coral"
            onClick={() => setShowForm((shown) => !shown)}
            type="button"
          >
            {showForm ? "Close form" : "Post opportunity"}
          </button>
        )}
      </div>

      {showForm && (
        <form className="create-panel compact" onSubmit={submit}>
          <div className="field-row">
            <Field label="Role title">
              <input
                disabled={submitting}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                required
                value={draft.title}
              />
            </Field>
            <Field label="Company">
              <input
                disabled={submitting}
                onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                required
                value={draft.company}
              />
            </Field>
          </div>
          <div className="field-row">
            <Field label="Location">
              <input
                disabled={submitting}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                required
                value={draft.location}
              />
            </Field>
            <Field label="Skills">
              <input
                disabled={submitting}
                onChange={(e) => setDraft({ ...draft, skills: e.target.value })}
                placeholder="React, Figma"
                required
                value={draft.skills}
              />
            </Field>
          </div>
          <Field label="External apply link">
            <input
              disabled={submitting}
              onChange={(e) => setDraft({ ...draft, applyUrl: e.target.value })}
              required
              type="url"
              value={draft.applyUrl}
            />
          </Field>
          <button className="button button-dark" disabled={submitting} type="submit">
            {submitting ? "Publishing..." : "Publish opportunity"}
          </button>
        </form>
      )}

      <div className="internship-list">
        {internships.map((listing) => (
          <article key={listing.id}>
            <div className="company-mark">
              {(listing.company || "CC").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <span>{listing.company}</span>
              <h2>{listing.title}</h2>
              <p>{listing.location}</p>
              <div className="listing-tags">
                {(listing.skills || []).map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
            <a
              className="button button-dark"
              href={listing.applyUrl}
              rel="noreferrer"
              target="_blank"
            >
              Apply externally <ArrowIcon />
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}

function MentorsPage() {
  const mentors = [
    {
      name: "Dr. Elena Vasquez",
      role: "AI Researcher · University Staff",
      skills: ["Machine Learning", "Python"],
      initials: "EV",
    },
    {
      name: "Marcus Adeyemi",
      role: "Product Engineer · Alumni",
      skills: ["React", "Career advice"],
      initials: "MA",
    },
    {
      name: "Priya Nair",
      role: "UX Lead · Industry Mentor",
      skills: ["Figma", "Product design"],
      initials: "PN",
    },
  ];
  const [contacted, setContacted] = useState<string[]>([]);

  return (
    <div className="opportunity-page">
      <div className="marketplace-heading">
        <div>
          <span className="form-kicker">LEARN FROM EXPERIENCE</span>
          <h1>Find a mentor</h1>
          <p>
            Connect with people who can offer guidance on skills, projects, and your next career step.
          </p>
        </div>
      </div>
      <div className="mentor-grid">
        {mentors.map((mentor) => (
          <article key={mentor.name}>
            <div className="mentor-avatar">{mentor.initials}</div>
            <h2>{mentor.name}</h2>
            <p>{mentor.role}</p>
            <div className="listing-tags">
              {mentor.skills.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </div>
            <button
              className="button button-ghost"
              onClick={() =>
                setContacted((current) =>
                  current.includes(mentor.name) ? current : [...current, mentor.name],
                )
              }
              type="button"
            >
              {contacted.includes(mentor.name) ? "Interest sent" : "Connect with mentor"}
            </button>
          </article>
        ))}
      </div>
      <div className="phase-note">
        Full mentor matching and scheduling will become available in the teamwork and growth phase.
      </div>
    </div>
  );
}

function CoursesPage() {
  const courses = [
    {
      id: "react-foundations",
      title: "React Foundations",
      provider: "Campus Connect Learning",
      level: "Beginner",
      skills: ["React", "TypeScript"],
    },
    {
      id: "product-design",
      title: "Designing Products People Use",
      provider: "Open Design School",
      level: "Intermediate",
      skills: ["Figma", "Product design"],
    },
    {
      id: "python-data",
      title: "Applied Python for Data",
      provider: "Future Skills Lab",
      level: "Beginner",
      skills: ["Python", "Data"],
    },
  ];

  const [enrolled, setEnrolled] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("campus-connect-courses") ?? "[]");
    } catch {
      return [];
    }
  });

  const toggleEnrollment = (courseId: string) => {
    const next = enrolled.includes(courseId)
      ? enrolled.filter((id) => id !== courseId)
      : [...enrolled, courseId];
    setEnrolled(next);
    localStorage.setItem("campus-connect-courses", JSON.stringify(next));
  };

  return (
    <div className="opportunity-page">
      <div className="marketplace-heading">
        <div>
          <span className="form-kicker">LEARN, THEN BUILD</span>
          <h1>Courses</h1>
          <p>Build a skill, then put it into practice on a real student project.</p>
        </div>
      </div>
      <div className="course-grid">
        {courses.map((course, index) => (
          <article key={course.title}>
            <div className={`course-cover cover-${index + 1}`}>
              <span>0{index + 1}</span>
              <small>{course.level}</small>
            </div>
            <div>
              <span>{course.provider}</span>
              <h2>{course.title}</h2>
              <div className="listing-tags">
                {course.skills.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
              <button
                className={enrolled.includes(course.id) ? "enrolled" : ""}
                onClick={() => toggleEnrollment(course.id)}
                type="button"
              >
                {enrolled.includes(course.id) ? "Enrolled · Leave course" : "Enroll in course"}{" "}
                <ArrowIcon />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function NotificationsPage({
  notices,
  onRead,
}: {
  notices: Notice[];
  onRead: () => Promise<void>;
}) {
  useEffect(() => {
    void onRead();
  }, []);

  return (
    <div className="opportunity-page">
      <div className="marketplace-heading">
        <div>
          <span className="form-kicker">STAY IN THE LOOP</span>
          <h1>Notifications</h1>
          <p>Join requests, team decisions, and opportunity updates in one place.</p>
        </div>
      </div>
      <div className="notification-list">
        {notices.length ? (
          notices.map((notice) => (
            <article className={notice.read ? "" : "unread"} key={notice.id}>
              <span className="notice-dot" />
              <div>
                <h2>{notice.title}</h2>
                <p>{notice.detail}</p>
                <small>{new Date(notice.createdAt).toLocaleString()}</small>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-feed">
            <span className="empty-mark">N</span>
            <h2>You’re all caught up</h2>
            <p>New join requests and decisions will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PlaceholderPage({ view }: { view: View }) {
  const content: Record<string, [string, string]> = {
    projects: [
      "Projects",
      "Discover student-led ideas, find a skill match, and request to join a build.",
    ],
    internships: [
      "Internships",
      "Relevant internship opportunities will appear here as partners join the platform.",
    ],
    notifications: [
      "Notifications",
      "Project invitations, join requests, and account updates will appear here.",
    ],
  };
  const [title, description] = content[view] ?? [
    "Coming soon",
    "This space is being prepared for the community.",
  ];
  return (
    <div className="placeholder-page">
      <span className="form-kicker">CAMPUS CONNECT</span>
      <h1>{title}</h1>
      <p>{description}</p>
      <div>
        <span className="empty-mark">{title.slice(0, 2).toUpperCase()}</span>
        <h2>Nothing here yet</h2>
        <p>Check back as your community grows.</p>
      </div>
    </div>
  );
}

function Profile({
  account,
  onSave,
  onUploadAvatar,
  onRemoveAvatar,
}: {
  account: UserAccount;
  onSave: (profile: Partial<UserAccount>) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<void>;
  onRemoveAvatar: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(account);
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarFeedback, setAvatarFeedback] = useState<{ type: "error" | "success"; text: string } | null>(
    null,
  );
  const [selectedAvatar, setSelectedAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(account);
    setSelectedAvatar(null);
    setAvatarPreview("");
  }, [account]);

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const toggleSkill = (skill: string) =>
    setDraft((current) => ({
      ...current,
      techStack: current.techStack.includes(skill)
        ? current.techStack.filter((item) => item !== skill)
        : [...current.techStack, skill],
    }));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const selectAvatarFile = () => {
    fileInputRef.current?.click();
  };

  const onAvatarSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarFeedback(null);
    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
      setSelectedAvatar(null);
      setAvatarPreview("");
      setAvatarFeedback({ type: "error", text: "Please choose a JPEG, PNG, or WebP image." });
      return;
    }
    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      setSelectedAvatar(null);
      setAvatarPreview("");
      setAvatarFeedback({ type: "error", text: `Image must be ${AVATAR_MAX_SIZE_MB}MB or smaller.` });
      return;
    }
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
    setSelectedAvatar(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const saveAvatar = async () => {
    if (!selectedAvatar) return;
    setAvatarBusy(true);
    setAvatarFeedback(null);
    try {
      await onUploadAvatar(selectedAvatar);
      setAvatarFeedback({ type: "success", text: "Profile photo updated." });
      setSelectedAvatar(null);
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
      setAvatarPreview("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err: any) {
      setAvatarFeedback({ type: "error", text: err.message || "Failed to upload profile photo." });
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    setAvatarFeedback(null);
    try {
      await onRemoveAvatar();
      setSelectedAvatar(null);
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
      setAvatarPreview("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setAvatarFeedback({ type: "success", text: "Profile photo removed." });
    } catch (err: any) {
      setAvatarFeedback({ type: "error", text: err.message || "Failed to remove profile photo." });
    } finally {
      setAvatarBusy(false);
    }
  };

  const initials = draft.name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("") || "CC";

  return (
    <div className="profile-page">
      <div className="profile-title">
        <div>
          <span className="form-kicker">YOUR BUILDER IDENTITY</span>
          <h1>Profile</h1>
          <p>Keep your details current so people can find the right collaborator.</p>
        </div>
        {!editing && (
          <button className="button button-dark" onClick={() => setEditing(true)} type="button">
            Edit profile
          </button>
        )}
      </div>
      <form className="profile-card" onSubmit={save}>
        <div className="profile-avatar-wrap">
          <div
            className={`profile-avatar ${avatarBusy ? "loading" : ""}`}
            style={avatarPreview || draft.imageUrl ? { backgroundImage: `url(${avatarPreview || draft.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
          >
            {!avatarPreview && !draft.imageUrl && initials}
            {avatarBusy && <span className="avatar-spinner" aria-hidden="true" />}
          </div>
          <input
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={onAvatarSelected}
            ref={fileInputRef}
            type="file"
          />
          <div className="avatar-controls">
            <button
              className="avatar-action-btn"
              disabled={avatarBusy || busy}
              onClick={selectAvatarFile}
              type="button"
            >
              {draft.imageUrl ? "Replace photo" : "Upload photo"}
            </button>
            {selectedAvatar && (
              <button
                className="avatar-action-btn"
                disabled={avatarBusy || busy}
                onClick={saveAvatar}
                type="button"
              >
                Save photo
              </button>
            )}
            {(draft.imageUrl || avatarPreview) && !selectedAvatar && (
              <button
                className="avatar-remove-btn"
                disabled={avatarBusy || busy}
                onClick={removeAvatar}
                type="button"
              >
                Remove
              </button>
            )}
          </div>
          {avatarFeedback && <span className={`avatar-feedback ${avatarFeedback.type}`}>{avatarFeedback.text}</span>}
        </div>
        <div className="profile-fields">
          <div className="field-row">
            <Field label="Full name">
              <input
                disabled={!editing || busy}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                value={draft.name}
              />
            </Field>
            <Field label="University">
              <input
                disabled={!editing || busy}
                onChange={(e) => setDraft({ ...draft, university: e.target.value })}
                value={draft.university}
              />
            </Field>
          </div>
          <Field label="Email address">
            <input disabled value={draft.email} />
          </Field>
          <Field label="Bio">
            <textarea
              disabled={!editing || busy}
              onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              value={draft.bio}
            />
          </Field>
          <fieldset className="skills-field" disabled={!editing || busy}>
            <legend>Tech stack</legend>
            <div>
              {POPULAR_SKILLS.map((skill) => (
                <button
                  className={(draft.techStack || []).includes(skill) ? "selected" : ""}
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  type="button"
                >
                  {skill}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="field-row">
            <label className="field">
              <span>Experience</span>
              <select
                disabled={!editing || busy}
                onChange={(e) => setDraft({ ...draft, experience: e.target.value as Experience })}
                value={draft.experience}
              >
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </label>
            <label className="field">
              <span>Availability</span>
              <select
                disabled={!editing || busy}
                onChange={(e) => setDraft({ ...draft, availability: e.target.value })}
                value={draft.availability}
              >
                <option value="">Not specified</option>
                <option>1–5 hours / week</option>
                <option>6–10 hours / week</option>
                <option>10+ hours / week</option>
              </select>
            </label>
          </div>
          <Field label="GitHub">
            <input
              disabled={!editing || busy}
              onChange={(e) => setDraft({ ...draft, github: e.target.value })}
              value={draft.github}
            />
          </Field>
          {editing && (
            <div className="profile-actions">
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setDraft(account);
                  setEditing(false);
                }}
                type="button"
              >
                Cancel
              </button>
              <button className="button button-coral" disabled={busy} type="submit">
                {busy ? "Saving..." : "Save changes"}
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>(routeFromHash);
  const [account, setAccount] = useState<UserAccount | null>(() => getStoredAccount());
  const [projects, setProjects] = useState<Project[]>([]);
  const [internships, setInternships] = useState<Internship[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [authenticated, setAuthenticated] = useState<boolean>(() => Boolean(getStoredToken()));
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const initialTheme = document.documentElement.getAttribute("data-theme");
    return initialTheme === "dark" || initialTheme === "light"
      ? initialTheme
      : resolveTheme(readThemeFromStorage());
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => {
      const stored = readThemeFromStorage();
      if (stored === "dark" || stored === "light") return;
      setTheme(event.matches ? "dark" : "light");
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {}
      return next;
    });
  };

  // Handle OAuth callback token from URL (hash or search params)
  useEffect(() => {
    try {
      const hash = window.location.hash;
      const search = window.location.search;
      const token = new URLSearchParams(hash.split("?")[1] ?? search).get("token");
      if (token) {
        setStoredToken(token, true);
        const cleanUrl = window.location.origin + window.location.pathname + (hash.split("?")[0] === "" ? "" : hash.split("?")[0]);
        window.history.replaceState({}, document.title, cleanUrl);
      }
    } catch (_) {}
  }, []);

  // Sync route on hash/popstate change
  useEffect(() => {
    const onHashChange = () => setView(routeFromHash());
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("popstate", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("popstate", onHashChange);
    };
  }, []);

  const navigate = (next: View) => {
    setView(next);
    window.location.hash = next === "home" ? "" : next;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Verify current session with backend on boot
  useEffect(() => {
    const checkSession = async () => {
      if (!getStoredToken()) {
        setAuthenticated(false);
        return;
      }
      try {
        const { user } = await api.me();
        if (user) {
          setAccount(user);
          setStoredAccount(user);
          setAuthenticated(true);
        }
      } catch (_) {
        setAuthenticated(false);
        setStoredToken(null);
        setStoredAccount(null);
      }
    };
    void checkSession();
  }, []);

  // Fetch real database records for projects, opportunities, and notices
  const loadData = async () => {
    try {
      const [projRes, oppRes, notifRes] = await Promise.allSettled([
        api.listProjects(),
        api.listOpportunities(),
        authenticated ? api.getNotifications() : Promise.resolve({ notices: [] }),
      ]);
      if (projRes.status === "fulfilled" && projRes.value?.projects) {
        setProjects(projRes.value.projects);
      }
      if (oppRes.status === "fulfilled" && oppRes.value?.opportunities) {
        setInternships(oppRes.value.opportunities);
      }
      if (notifRes.status === "fulfilled" && notifRes.value?.notices) {
        setNotices(notifRes.value.notices);
      }
    } catch (e) {
      console.warn("Error loading data from backend:", e);
    }
  };

  useEffect(() => {
    void loadData();
  }, [authenticated]);

  const handleAccountCreated = (next: UserAccount) => {
    setAccount(next);
    setStoredAccount(next);
  };

  const handleLoginSuccess = (next: UserAccount, remember: boolean) => {
    setAccount(next);
    setAuthenticated(true);
    setStoredAccount(next, remember);
  };

  const handleLogout = async () => {
    await api.logout();
    setAuthenticated(false);
    setAccount(null);
    navigate("login");
  };

  const handleSaveProfile = async (changes: Partial<UserAccount>) => {
    if (!account) return;
    const res = await api.updateProfile(changes);
    const updated = { ...account, ...changes, ...res.profile };
    setAccount(updated);
    setStoredAccount(updated);
  };

  const handleUploadAvatar = async (file: File) => {
    if (!account) return;
    const res = await api.uploadAvatar(file);
    const updated = {
      ...account,
      imageUrl: res.imageUrl || "",
    };
    setAccount(updated);
    setStoredAccount(updated);
  };

  const handleRemoveAvatar = async () => {
    if (!account) return;
    await api.removeAvatar();
    const updated = {
      ...account,
      imageUrl: "",
    };
    setAccount(updated);
    setStoredAccount(updated);
  };

  const handleCreateProject = async (created: any) => {
    await api.createProject(created);
    await loadData();
  };

  const handleJoinProject = async (projectId: string, message: string) => {
    await api.joinProject(projectId, message);
    await loadData();
  };

  const handleRequestDecision = async (
    _projectId: string,
    requestId: string,
    decision: "accepted" | "declined",
  ) => {
    await api.decideJoinRequest(requestId, decision);
    await loadData();
  };

  const handleReadNotices = async () => {
    try {
      await api.markNotificationsRead();
      setNotices((current) => current.map((n) => ({ ...n, read: true })));
    } catch (_) {}
  };

  const handleCreateInternship = async (data: any) => {
    await api.createOpportunity(data);
    await loadData();
  };

  const protectedViews: View[] = [
    "onboarding",
    "dashboard",
    "projects",
    "internships",
    "mentors",
    "courses",
    "profile",
    "notifications",
  ];
  const visitorViews: View[] = ["signup", "login", "verify", "forgot", "reset"];

  // Route protection
  if (protectedViews.includes(view) && (!authenticated || !account)) {
    return (
      <Login
        navigate={navigate}
        onLoginSuccess={handleLoginSuccess}
        onToggleTheme={toggleTheme}
        theme={theme}
      />
    );
  }

  if (authenticated && account && visitorViews.includes(view)) {
    return (
      <AppShell
        account={account}
        internships={internships}
        navigate={navigate}
        notices={notices}
        onCreateInternship={handleCreateInternship}
        onCreateProject={handleCreateProject}
        onJoinProject={handleJoinProject}
        onLogout={handleLogout}
        onRemoveAvatar={handleRemoveAvatar}
        onReadNotices={handleReadNotices}
        onRequestDecision={handleRequestDecision}
        onSaveProfile={handleSaveProfile}
        onToggleTheme={toggleTheme}
        onUploadAvatar={handleUploadAvatar}
        projects={projects}
        theme={theme}
        view="dashboard"
      />
    );
  }

  if (view === "signup") {
    return (
      <Signup
        navigate={navigate}
        onAccountCreated={handleAccountCreated}
        onToggleTheme={toggleTheme}
        theme={theme}
      />
    );
  }
  if (view === "login") {
    return (
      <Login
        navigate={navigate}
        onLoginSuccess={handleLoginSuccess}
        onToggleTheme={toggleTheme}
        theme={theme}
      />
    );
  }
  if (view === "verify") {
    return (
      <Verify
        account={account}
        navigate={navigate}
        onToggleTheme={toggleTheme}
        onVerified={() => {
          if (account) setAccount({ ...account, verified: true });
        }}
        theme={theme}
      />
    );
  }
  if (view === "forgot") {
    return <ForgotPassword navigate={navigate} onToggleTheme={toggleTheme} theme={theme} />;
  }
  if (view === "reset") {
    return <ResetPassword navigate={navigate} onToggleTheme={toggleTheme} theme={theme} />;
  }
  if (view === "onboarding" && account) {
    return (
      <Onboarding
        account={account}
        onSave={async (changes) => {
          await handleSaveProfile(changes);
          navigate("dashboard");
        }}
        onSkip={async () => {
          await handleSaveProfile({ onboardingSkipped: true });
          navigate("dashboard");
        }}
      />
    );
  }
  if (protectedViews.includes(view) && account) {
    return (
      <AppShell
        account={account}
        internships={internships}
        navigate={navigate}
        notices={notices}
        onCreateInternship={handleCreateInternship}
        onCreateProject={handleCreateProject}
        onJoinProject={handleJoinProject}
        onLogout={handleLogout}
        onRemoveAvatar={handleRemoveAvatar}
        onReadNotices={handleReadNotices}
        onRequestDecision={handleRequestDecision}
        onSaveProfile={handleSaveProfile}
        onToggleTheme={toggleTheme}
        onUploadAvatar={handleUploadAvatar}
        projects={projects}
        theme={theme}
        view={view}
      />
    );
  }

  return <Landing navigate={navigate} onToggleTheme={toggleTheme} theme={theme} />;
}
