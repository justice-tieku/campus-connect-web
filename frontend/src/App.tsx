import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  getStoredAccount,
  getStoredToken,
  resolveImageUrl,
  setStoredAccount,
  setStoredToken,
  type AccountType,
  type Experience,
  type Internship,
  type Notice,
  type Project,
  type UserAccount,
  type ConversationItem,
  type DirectMessage,
  type ChatCounterparty,
  type DirectoryPerson,
  type PublicUserProfile,
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
  | "notifications"
  | "messages";

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
    "messages",
  ];
  return validRoutes.includes(target) ? target : "home";
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
  onSuccess,
  onError,
  disabled = false,
}: {
  text?: string;
  onSuccess: (credential: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    if (typeof window !== "undefined" && (window as any).google?.accounts?.id && clientId) {
      try {
        (window as any).google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: any) => {
            if (response?.credential) {
              setLoading(true);
              onSuccess(response.credential);
            } else {
              onError("Google sign in was cancelled or returned no credential.");
            }
          },
        });
      } catch (e) {
        console.warn("GIS initialization warning:", e);
      }
    }
  }, []);

  const handleClick = async () => {
    setLoading(true);
    try {
      const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
      if (typeof window !== "undefined" && (window as any).google?.accounts?.id && clientId) {
        (window as any).google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            fallbackAuth();
          }
        });
      } else {
        await fallbackAuth();
      }
    } catch (err: any) {
      setLoading(false);
      onError(err.message || "Failed to initiate Google sign in.");
    }
  };

  const fallbackAuth = async () => {
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const res = await api.getGoogleAuthUrl(origin);
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

function ThemeToggle({
  dark,
  onToggle,
  className = "",
}: {
  dark?: boolean;
  onToggle?: () => void;
  className?: string;
}) {
  const [internalDark, setInternalDark] = useState<boolean>(() => {
    if (typeof dark === "boolean") return dark;
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const isDark = typeof dark === "boolean" ? dark : internalDark;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      const next = !internalDark;
      setInternalDark(next);
      document.documentElement.classList.toggle("dark", next);
      document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
      localStorage.setItem("theme", next ? "dark" : "light");
    }
  };

  return (
    <button
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={`theme-toggle ${className}`}
      onClick={handleToggle}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      type="button"
    >
      {isDark ? (
        <Icon size={18}>
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </Icon>
      ) : (
        <Icon size={18}>
          <path
            d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </Icon>
      )}
    </button>
  );
}

function Header({
  navigate,
  simple = false,
  dark,
  onToggleTheme,
}: {
  navigate: (view: View) => void;
  simple?: boolean;
  dark?: boolean;
  onToggleTheme?: () => void;
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
            <ThemeToggle dark={dark} onToggle={onToggleTheme} />
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginLeft: "auto" }}>
          <ThemeToggle dark={dark} onToggle={onToggleTheme} />
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
  dark,
  onToggleTheme,
}: {
  navigate: (view: View) => void;
  dark?: boolean;
  onToggleTheme?: () => void;
}) {
  return (
    <div className="page-shell">
      <Header dark={dark} navigate={navigate} onToggleTheme={onToggleTheme} />
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
  dark,
  onToggleTheme,
}: {
  navigate: (view: View) => void;
  onAccountCreated: (account: UserAccount) => void;
  dark?: boolean;
  onToggleTheme?: () => void;
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

  const handleGoogleSuccess = async (credential: string) => {
    setBusy(true);
    setGeneralError("");
    try {
      const res = await api.googleAuth({ credential });
      onAccountCreated(res.user);
      navigate(res.user.onboardingComplete ? "dashboard" : "onboarding");
    } catch (err: any) {
      setGeneralError(err.message || "Google sign-up failed. Please try again.");
    } finally {
      setBusy(false);
    }
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
      <Header dark={dark} navigate={navigate} onToggleTheme={onToggleTheme} simple />
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
              onSuccess={handleGoogleSuccess}
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
  dark,
  onToggleTheme,
}: {
  account: UserAccount | null;
  navigate: (view: View) => void;
  onVerified: () => void;
  dark?: boolean;
  onToggleTheme?: () => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  if (!account) {
    return (
      <div className="auth-page">
        <Header dark={dark} navigate={navigate} onToggleTheme={onToggleTheme} simple />
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
      <Header dark={dark} navigate={navigate} onToggleTheme={onToggleTheme} simple />
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
  inactivityNotice,
  dark,
  onToggleTheme,
}: {
  navigate: (view: View) => void;
  onLoginSuccess: (account: UserAccount, remember: boolean) => void;
  inactivityNotice?: string | null;
  dark?: boolean;
  onToggleTheme?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleGoogleSuccess = async (credential: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await api.googleAuth({ credential });
      onLoginSuccess(res.user, true);
      navigate(res.user.onboardingComplete ? "dashboard" : "onboarding");
    } catch (err: any) {
      setError(err.message || "Google sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

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
      <Header dark={dark} navigate={navigate} onToggleTheme={onToggleTheme} simple />
      <div className="auth-layout login-layout">
        <AuthAside />
        <main className="auth-main">
          <form className="auth-form login-form" onSubmit={submit}>
            <span className="form-kicker">WELCOME BACK</span>
            <h1>Log in to keep building</h1>
            <p className="form-intro">Your next collaboration is waiting.</p>

            {inactivityNotice && (
              <div className="inactivity-alert">
                <Icon size={20}>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                  <path
                    d="M12 7v5l3 2"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </Icon>
                <div>
                  <strong>Session Expired</strong>
                  <p>{inactivityNotice}</p>
                </div>
              </div>
            )}

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
              onSuccess={handleGoogleSuccess}
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
  dark,
  onToggleTheme,
}: {
  navigate: (view: View) => void;
  dark?: boolean;
  onToggleTheme?: () => void;
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
      <Header dark={dark} navigate={navigate} onToggleTheme={onToggleTheme} simple />
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
  dark,
  onToggleTheme,
}: {
  navigate: (view: View) => void;
  dark?: boolean;
  onToggleTheme?: () => void;
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
      <Header dark={dark} navigate={navigate} onToggleTheme={onToggleTheme} simple />
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
  dark,
  onToggleTheme,
}: {
  account: UserAccount;
  onSave: (profile: Partial<UserAccount>) => Promise<void>;
  onSkip: () => Promise<void>;
  dark?: boolean;
  onToggleTheme?: () => void;
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
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <ThemeToggle dark={dark} onToggle={onToggleTheme} />
          <span>Step 1 of 1</span>
        </div>
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

const ALL_MENTORS = [
  {
    name: "Dr. Elena Vasquez",
    role: "AI Researcher · University Staff",
    skills: ["Machine Learning", "Python", "Data Science", "Research"],
    initials: "EV",
  },
  {
    name: "Marcus Adeyemi",
    role: "Product Engineer · Alumni",
    skills: ["React", "TypeScript", "Node.js", "Career advice"],
    initials: "MA",
  },
  {
    name: "Priya Nair",
    role: "UX Lead · Industry Mentor",
    skills: ["Figma", "Product design", "Design Systems", "UI/UX"],
    initials: "PN",
  },
  {
    name: "Kwame Mensah",
    role: "Cloud Architect · Google Developer Expert",
    skills: ["Go", "Kubernetes", "DevOps", "Cloud"],
    initials: "KM",
  },
  {
    name: "Sarah Jenkins",
    role: "Mobile Developer · Staff Alumni",
    skills: ["Flutter", "React Native", "iOS", "Android"],
    initials: "SJ",
  },
];

const ALL_COURSES = [
  {
    id: "react-foundations",
    title: "React Foundations",
    provider: "Campus Connect Learning",
    level: "Beginner",
    skills: ["React", "TypeScript", "Frontend"],
  },
  {
    id: "product-design",
    title: "Designing Products People Use",
    provider: "Open Design School",
    level: "Intermediate",
    skills: ["Figma", "Product design", "UX"],
  },
  {
    id: "python-data",
    title: "Applied Python for Data",
    provider: "Future Skills Lab",
    level: "Beginner",
    skills: ["Python", "Data", "Analytics"],
  },
  {
    id: "fullstack-node",
    title: "Fullstack Web APIs with Node & Express",
    provider: "Campus Dev Academy",
    level: "Intermediate",
    skills: ["Node.js", "Express", "REST APIs", "Prisma"],
  },
  {
    id: "ml-for-builders",
    title: "Machine Learning for Student Builders",
    provider: "AI Student Hub",
    level: "Advanced",
    skills: ["Machine Learning", "Python", "PyTorch"],
  },
];

/* 5 Clean Bottom Navigation SVG Icons */
function HomeNavIcon({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "2" : "1.8"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H15v-6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v6H4.5A1.5 1.5 0 0 1 3 20v-9.5z" />
    </svg>
  );
}

function ProjectsNavIcon({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "2" : "1.8"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CreateNavIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function JobsNavIcon({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "2" : "1.8"}>
      <rect x="2" y="7" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2 12h20" />
    </svg>
  );
}


function PublicProfileModal({
  userId,
  isOpen,
  onClose,
  onStartMessage,
  currentUserId,
}: {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onStartMessage: (targetUserId: string) => void;
  currentUserId?: string;
}) {
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !userId) {
      setProfile(null);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    api
      .getPublicProfile(userId)
      .then((res) => {
        if (active && res.profile) {
          setProfile(res.profile);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err?.message || "Failed to load member profile.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, userId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !userId) return null;

  const initials = profile?.name
    ? profile.name
        .split(" ")
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "CC";

  const isSelf = Boolean(currentUserId && currentUserId === userId);

  return (
    <div className="profile-modal-backdrop" onClick={onClose}>
      <div className="profile-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-banner">
          <button
            className="profile-modal-close-btn"
            onClick={onClose}
            type="button"
            aria-label="Close Profile"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="profile-modal-body">
          {loading ? (
            <div className="profile-modal-loading">
              <div className="profile-modal-spinner" />
              <p>Loading member profile...</p>
            </div>
          ) : error || !profile ? (
            <div className="profile-modal-error">
              <p>{error || "Unable to display this profile."}</p>
              <button className="button button-outline" onClick={onClose} type="button">
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="profile-modal-header-row">
                <div className="profile-modal-avatar-wrap">
                  {profile.imageUrl ? (
                    <img
                      src={resolveImageUrl(profile.imageUrl)}
                      alt={profile.name}
                      className="profile-modal-avatar-img"
                    />
                  ) : (
                    <span className="profile-modal-avatar-initials">{initials}</span>
                  )}
                  <span className="profile-modal-status-dot" title="Active on Campus Connect" />
                </div>

                <div className="profile-modal-actions">
                  {!isSelf && (
                    <button
                      className="button button-primary profile-modal-msg-btn"
                      onClick={() => {
                        onClose();
                        onStartMessage(profile.id);
                      }}
                      type="button"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path
                          d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Direct Message
                    </button>
                  )}
                </div>
              </div>

              <div className="profile-modal-meta">
                <div className="profile-modal-name-row">
                  <h2 className="profile-modal-name">{profile.name}</h2>
                  <span className="profile-modal-role-badge">{profile.role}</span>
                </div>

                {profile.programme && (
                  <p className="profile-modal-programme">{profile.programme}</p>
                )}

                {profile.university && (
                  <p className="profile-modal-university">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M6 12v5c3 3 9 3 12 0v-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {profile.university}
                  </p>
                )}

                <div className="profile-modal-links-row">
                  {profile.github && (
                    <a
                      href={profile.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="profile-modal-link-pill"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path
                          d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      GitHub
                    </a>
                  )}
                  {profile.portfolio && (
                    <a
                      href={profile.portfolio}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="profile-modal-link-pill"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path
                          d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Portfolio
                    </a>
                  )}
                  {profile.availability && (
                    <span className="profile-modal-avail-badge">
                      Available: {profile.availability}
                    </span>
                  )}
                </div>
              </div>

              {profile.bio && (
                <div className="profile-modal-section">
                  <h4 className="profile-modal-section-title">About</h4>
                  <p className="profile-modal-bio">{profile.bio}</p>
                </div>
              )}

              {profile.skills && profile.skills.length > 0 && (
                <div className="profile-modal-section">
                  <h4 className="profile-modal-section-title">Skills & Expertise</h4>
                  <div className="profile-modal-skills-list">
                    {profile.skills.map((s, idx) => (
                      <span key={`${s}-${idx}`} className="profile-modal-skill-chip">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {profile.experience && (
                <div className="profile-modal-section">
                  <h4 className="profile-modal-section-title">Experience Level</h4>
                  <p className="profile-modal-exp-text">{profile.experience}</p>
                </div>
              )}

              {profile.createdProjects && profile.createdProjects.length > 0 && (
                <div className="profile-modal-section">
                  <h4 className="profile-modal-section-title">
                    Created Projects ({profile.createdProjects.length})
                  </h4>
                  <div className="profile-modal-projects-grid">
                    {profile.createdProjects.map((proj) => (
                      <div key={proj.id} className="profile-modal-project-card">
                        <div className="profile-modal-proj-top">
                          <span className="profile-modal-proj-cat">{proj.category}</span>
                          <span
                            className={`profile-modal-proj-status ${proj.status.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            {proj.status}
                          </span>
                        </div>
                        <h5 className="profile-modal-proj-title">{proj.title}</h5>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {profile.memberships && profile.memberships.length > 0 && (
                <div className="profile-modal-section">
                  <h4 className="profile-modal-section-title">
                    Project Collaborations ({profile.memberships.length})
                  </h4>
                  <div className="profile-modal-projects-grid">
                    {profile.memberships.map((mem, idx) => (
                      <div key={mem.id || `mem-${idx}`} className="profile-modal-project-card">
                        <div className="profile-modal-proj-top">
                          <span className="profile-modal-proj-cat">{mem.category || "Project"}</span>
                          <span className="profile-modal-proj-status open">Member</span>
                        </div>
                        <h5 className="profile-modal-proj-title">{mem.title}</h5>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type SearchCategory = "All" | "People" | "Projects" | "Mentors" | "Courses" | "Internships";

function OmniSearchModal({
  isOpen,
  onClose,
  projects,
  internships,
  navigate,
  onOpenProfile,
}: {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  internships: Internship[];
  navigate: (view: View) => void;
  onOpenProfile: (userId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SearchCategory>("All");
  const [people, setPeople] = useState<DirectoryPerson[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    api
      .getDirectory({ q: query.trim() })
      .then((res) => {
        if (active && res.people) {
          setPeople(res.people);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isOpen, query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const q = query.trim().toLowerCase();

  const matchedProjects = useMemo(() => {
    if (!q) return projects.slice(0, 4);
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.techStack?.some((t) => t.toLowerCase().includes(q)) ||
        p.roles?.some((r) => r.toLowerCase().includes(q)),
    );
  }, [projects, q]);

  const matchedMentors = useMemo(() => {
    if (!q) return ALL_MENTORS.slice(0, 3);
    return ALL_MENTORS.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q) ||
        m.skills?.some((s) => s.toLowerCase().includes(q)),
    );
  }, [q]);

  const matchedCourses = useMemo(() => {
    if (!q) return ALL_COURSES.slice(0, 3);
    return ALL_COURSES.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.provider.toLowerCase().includes(q) ||
        c.level.toLowerCase().includes(q) ||
        c.skills?.some((s) => s.toLowerCase().includes(q)),
    );
  }, [q]);

  const matchedInternships = useMemo(() => {
    if (!q) return internships.slice(0, 3);
    return internships.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.company.toLowerCase().includes(q) ||
        i.location.toLowerCase().includes(q) ||
        i.skills?.some((s) => s.toLowerCase().includes(q)),
    );
  }, [internships, q]);

  const totalResults =
    people.length +
    matchedProjects.length +
    matchedMentors.length +
    matchedCourses.length +
    matchedInternships.length;

  if (!isOpen) return null;

  return (
    <div className="omni-search-backdrop" onClick={onClose}>
      <div className="omni-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="omni-search-header">
          <span className="omni-search-header-icon">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
            </svg>
          </span>
          <input
            ref={inputRef}
            className="omni-search-header-input"
            placeholder="Search people, projects, jobs, mentors, courses..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="omni-search-close-btn"
              onClick={() => setQuery("")}
              type="button"
              title="Clear search"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <button
            className="omni-search-close-btn"
            onClick={onClose}
            type="button"
            title="Close"
          >
            <span style={{ fontSize: "11px", fontWeight: "700" }}>Esc</span>
          </button>
        </div>

        <div className="omni-filter-tabs">
          <button
            className={`omni-tab-pill ${category === "All" ? "active" : ""}`}
            onClick={() => setCategory("All")}
            type="button"
          >
            All ({totalResults})
          </button>
          <button
            className={`omni-tab-pill ${category === "People" ? "active" : ""}`}
            onClick={() => setCategory("People")}
            type="button"
          >
            People ({people.length})
          </button>
          <button
            className={`omni-tab-pill ${category === "Projects" ? "active" : ""}`}
            onClick={() => setCategory("Projects")}
            type="button"
          >
            Projects ({matchedProjects.length})
          </button>
          <button
            className={`omni-tab-pill ${category === "Internships" ? "active" : ""}`}
            onClick={() => setCategory("Internships")}
            type="button"
          >
            Jobs ({matchedInternships.length})
          </button>
          <button
            className={`omni-tab-pill ${category === "Mentors" ? "active" : ""}`}
            onClick={() => setCategory("Mentors")}
            type="button"
          >
            Mentors ({matchedMentors.length})
          </button>
          <button
            className={`omni-tab-pill ${category === "Courses" ? "active" : ""}`}
            onClick={() => setCategory("Courses")}
            type="button"
          >
            Courses ({matchedCourses.length})
          </button>
        </div>

        <div className="omni-search-body">
          {totalResults === 0 && (
            <div className="omni-empty-state">
              <p>No results found matching "{query}".</p>
              <small>Try searching by person's name, university, or skills like "React", "Python", "Figma".</small>
            </div>
          )}

          {/* People Section */}
          {(category === "All" || category === "People") &&
            people.map((person) => {
              const pInitials = person.name
                .split(" ")
                .map((p) => p[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase() || "CC";
              return (
                <button
                  key={`person-${person.id}`}
                  className="omni-result-card omni-person-card"
                  onClick={() => {
                    onClose();
                    onOpenProfile(person.id);
                  }}
                  type="button"
                >
                  <div className="omni-person-avatar">
                    {person.imageUrl ? (
                      <img src={resolveImageUrl(person.imageUrl)} alt={person.name} />
                    ) : (
                      <span>{pInitials}</span>
                    )}
                  </div>
                  <div className="omni-result-main">
                    <div className="omni-result-top">
                      <span className="omni-type-pill person">Member</span>
                      <strong className="omni-result-title">{person.name}</strong>
                      <span className="omni-role-tag">{person.role}</span>
                    </div>
                    <span className="omni-result-detail">
                      {person.programme ? `${person.programme} · ` : ""}
                      {person.university || "Campus Member"}
                      {person.skills && person.skills.length > 0
                        ? ` · ${person.skills.slice(0, 3).join(", ")}`
                        : ""}
                    </span>
                  </div>
                  <span className="omni-action-hint">View Profile</span>
                </button>
              );
            })}

          {(category === "All" || category === "Mentors") &&
            matchedMentors.map((mentor) => (
              <button
                key={`mentor-${mentor.name}`}
                className="omni-result-card"
                onClick={() => {
                  onClose();
                  navigate("mentors");
                }}
                type="button"
              >
                <div className="omni-result-main">
                  <div className="omni-result-top">
                    <span className="omni-type-pill mentor">Mentor</span>
                    <strong className="omni-result-title">{mentor.name}</strong>
                  </div>
                  <span className="omni-result-detail">
                    {mentor.role} · Skills: {mentor.skills.join(", ")}
                  </span>
                </div>
                <ArrowIcon />
              </button>
            ))}

          {(category === "All" || category === "Courses") &&
            matchedCourses.map((course) => (
              <button
                key={`course-${course.id}`}
                className="omni-result-card"
                onClick={() => {
                  onClose();
                  navigate("courses");
                }}
                type="button"
              >
                <div className="omni-result-main">
                  <div className="omni-result-top">
                    <span className="omni-type-pill course">Course</span>
                    <strong className="omni-result-title">{course.title}</strong>
                  </div>
                  <span className="omni-result-detail">
                    {course.provider} · Level: {course.level} · {course.skills.join(", ")}
                  </span>
                </div>
                <ArrowIcon />
              </button>
            ))}

          {(category === "All" || category === "Projects") &&
            matchedProjects.map((project) => (
              <button
                key={`project-${project.id}`}
                className="omni-result-card"
                onClick={() => {
                  onClose();
                  navigate("projects");
                }}
                type="button"
              >
                <div className="omni-result-main">
                  <div className="omni-result-top">
                    <span className="omni-type-pill project">Project</span>
                    <strong className="omni-result-title">{project.title}</strong>
                  </div>
                  <span className="omni-result-detail">
                    {project.category} · Tech: {project.techStack?.join(", ") || "General"}
                  </span>
                </div>
                <ArrowIcon />
              </button>
            ))}

          {(category === "All" || category === "Internships") &&
            matchedInternships.map((internship) => (
              <button
                key={`internship-${internship.id}`}
                className="omni-result-card"
                onClick={() => {
                  onClose();
                  navigate("internships");
                }}
                type="button"
              >
                <div className="omni-result-main">
                  <div className="omni-result-top">
                    <span className="omni-type-pill internship">Internship</span>
                    <strong className="omni-result-title">{internship.title}</strong>
                  </div>
                  <span className="omni-result-detail">
                    {internship.company} · {internship.location} · {internship.skills?.join(", ")}
                  </span>
                </div>
                <ArrowIcon />
              </button>
            ))}

          {!q && (
            <div className="omni-popular-section">
              <div className="omni-popular-title">Popular Skills & Topics</div>
              <div className="omni-popular-chips">
                {POPULAR_SKILLS.map((sk) => (
                  <button
                    key={sk}
                    className="omni-chip"
                    onClick={() => setQuery(sk)}
                    type="button"
                  >
                    {sk}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateSheetModal({
  isOpen,
  onClose,
  canPostInternship,
  onSelectProjectCreate,
  onSelectInternshipCreate,
}: {
  isOpen: boolean;
  onClose: () => void;
  canPostInternship: boolean;
  onSelectProjectCreate: () => void;
  onSelectInternshipCreate: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="create-sheet-backdrop" onClick={onClose}>
      <div className="create-sheet-modal" onClick={(e) => e.stopPropagation()}>
        <div className="create-sheet-handle" />
        <h2 className="create-sheet-title">Create or Share</h2>
        <div className="create-sheet-options">
          <button
            className="create-option-card"
            onClick={() => {
              onClose();
              onSelectProjectCreate();
            }}
            type="button"
          >
            <div className="create-option-icon project">
              <ProjectsNavIcon active />
            </div>
            <div className="create-option-text">
              <h3>Start a Student Project</h3>
              <p>Assemble teammates, recruit co-builders, and build together.</p>
            </div>
            <ArrowIcon />
          </button>

          <button
            className="create-option-card"
            onClick={() => {
              onClose();
              onSelectInternshipCreate();
            }}
            type="button"
          >
            <div className="create-option-icon internship">
              <JobsNavIcon active />
            </div>
            <div className="create-option-text">
              <h3>Post an Internship or Job</h3>
              <p>
                {canPostInternship
                  ? "Share an emerging talent opportunity with student builders."
                  : "Explore opportunities matching your builder skills."}
              </p>
            </div>
            <ArrowIcon />
          </button>
        </div>

        <button className="create-sheet-cancel" onClick={onClose} type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}

function AppShell({
  account,
  view,
  navigate,
  onLogout,
  onSaveProfile,
  onAvatarUpdate,
  projects,
  notices,
  onCreateProject,
  onJoinProject,
  onRequestDecision,
  onReadNotices,
  internships,
  onCreateInternship,
  dark,
  onToggleTheme,
}: {
  account: UserAccount;
  view: View;
  navigate: (view: View) => void;
  onLogout: () => void;
  onSaveProfile: (profile: Partial<UserAccount>) => Promise<void>;
  onAvatarUpdate: (imageUrl: string) => void;
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
  dark?: boolean;
  onToggleTheme?: () => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [autoOpenProjectCreate, setAutoOpenProjectCreate] = useState(false);
  const [autoOpenInternshipCreate, setAutoOpenInternshipCreate] = useState(false);
  const [chatTargetUserId, setChatTargetUserId] = useState<string | null>(null);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const handleOpenProfile = (targetId: string) => {
    setSelectedProfileUserId(targetId);
    setProfileModalOpen(true);
  };

  useEffect(() => {
    const fetchUnreadMsg = async () => {
      try {
        const res = await api.getUnreadMessageCount();
        if (typeof res?.count === "number") {
          setUnreadMsgCount(res.count);
        }
      } catch (_) {}
    };
    void fetchUnreadMsg();
    const interval = setInterval(fetchUnreadMsg, 10000);
    return () => clearInterval(interval);
  }, []);

  const firstName = account.name.split(" ")[0] || account.email.split("@")[0];
  const initials = account.name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("") || "CC";

  const openProjectsCount = projects.filter((p) => p.status === "Open").length;
  const unreadNoticesCount = notices.filter((n) => !n.read).length;

  // Desktop sidebar nav — mirrors mobile bottom nav items + extended set
  const desktopNavItems: { label: string; view: View; icon: ReactNode; badge?: number }[] = [
    {
      label: "Dashboard",
      view: "dashboard",
      icon: (
        <svg viewBox="0 0 24 24" fill={view === "dashboard" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
    {
      label: "Projects",
      view: "projects",
      icon: (
        <svg viewBox="0 0 24 24" fill={view === "projects" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      badge: openProjectsCount > 0 ? openProjectsCount : undefined,
    },
    {
      label: "Jobs",
      view: "internships",
      icon: (
        <svg viewBox="0 0 24 24" fill={view === "internships" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2 12h20" />
        </svg>
      ),
    },
    {
      label: "Mentors",
      view: "mentors",
      icon: (
        <svg viewBox="0 0 24 24" fill={view === "mentors" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2z" />
          <path d="M20 21a8 8 0 1 0-16 0" />
          <path d="M16 11l2 2 4-4" />
        </svg>
      ),
    },
    {
      label: "Courses",
      view: "courses",
      icon: (
        <svg viewBox="0 0 24 24" fill={view === "courses" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      ),
    },
    {
      label: "Messages",
      view: "messages",
      icon: (
        <svg viewBox="0 0 24 24" fill={view === "messages" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
      badge: unreadMsgCount > 0 ? unreadMsgCount : undefined,
    },
    {
      label: "Notifications",
      view: "notifications",
      icon: (
        <svg viewBox="0 0 24 24" fill={view === "notifications" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
      badge: unreadNoticesCount > 0 ? unreadNoticesCount : undefined,
    },
    {
      label: "Profile",
      view: "profile",
      icon: (
        <svg viewBox="0 0 24 24" fill={view === "profile" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      ),
    },
  ];

  return (
    <div className="app-shell">
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="app-sidebar">
        <Logo onClick={() => navigate("dashboard")} />
        <nav>
          {desktopNavItems.map((item, index) => (
            <button
              className={`sidebar-nav-item ${view === item.view ? "active" : ""}`}
              key={`${item.label}-${index}`}
              onClick={() => navigate(item.view)}
              type="button"
            >
              <span className="sidebar-nav-icon">
                {item.icon}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="sidebar-nav-badge">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </span>
              <span className="sidebar-nav-label">{item.label}</span>
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
        {/* Top Header Bar */}
        <header className="app-topbar">
          {/* Top-Left: User Profile Avatar */}
          <button
            className="topbar-avatar-btn"
            onClick={() => navigate("profile")}
            title={`${account.name} (View Profile)`}
            type="button"
            aria-label="View Profile"
          >
            <div className="topbar-avatar-wrap">
              {account.imageUrl ? (
                <img src={resolveImageUrl(account.imageUrl)} alt={account.name} />
              ) : (
                <span>{initials}</span>
              )}
              <span className="topbar-online-dot" title="Campus community online" />
            </div>
          </button>

          {/* Center: Search Bar */}
          <div className="topbar-search-container">
            <div
              className="topbar-search-input-wrap"
              onClick={() => setSearchOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setSearchOpen(true);
              }}
            >
              <span className="topbar-search-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                </svg>
              </span>
              <input
                className="topbar-search-input"
                placeholder="Search mentors, courses, projects..."
                readOnly
                value=""
              />
            </div>
          </div>

          {/* Top-Right: Theme Toggle, Messages & Notifications */}
          <div className="topbar-actions-group">
            <ThemeToggle dark={dark} onToggle={onToggleTheme} />
            <button
              className="topbar-icon-btn"
              onClick={() => navigate("messages")}
              title="Messages"
              type="button"
              aria-label="Messages"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {unreadMsgCount > 0 && (
                <span className="topbar-badge">{unreadMsgCount > 99 ? "99+" : unreadMsgCount}</span>
              )}
            </button>
            <button
              className="topbar-icon-btn"
              onClick={() => navigate("notifications")}
              title="Notifications"
              type="button"
              aria-label="Notifications"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {unreadNoticesCount > 0 && (
                <span className="topbar-badge">{unreadNoticesCount > 99 ? "99+" : unreadNoticesCount}</span>
              )}
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
              onAvatarUpdate={onAvatarUpdate}
              onSave={onSaveProfile}
              onLogout={onLogout}
            />
          ) : view === "projects" ? (
            <ProjectsHub
              account={account}
              onCreate={onCreateProject}
              onDecision={onRequestDecision}
              onJoin={onJoinProject}
              projects={projects}
              autoOpenCreate={autoOpenProjectCreate}
              onOpenProfile={handleOpenProfile}
            />
          ) : view === "internships" ? (
            <InternshipsPage
              canPost={account.accountType !== "Student"}
              internships={internships}
              onCreate={onCreateInternship}
              autoOpenCreate={autoOpenInternshipCreate}
            />
          ) : view === "mentors" ? (
            <MentorsPage />
          ) : view === "courses" ? (
            <CoursesPage />
          ) : view === "messages" ? (
            <MessagesPage
              account={account}
              targetUserId={chatTargetUserId}
              onClearTarget={() => setChatTargetUserId(null)}
              onOpenProfile={handleOpenProfile}
            />
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
                  <span>MENTORS & EXPERTS</span>
                  <strong>{ALL_MENTORS.length}</strong>
                  <p>Guidance from industry & research mentors.</p>
                  <button onClick={() => navigate("mentors")} type="button">
                    Find a mentor <ArrowIcon />
                  </button>
                </article>
                <article>
                  <span>SKILL COURSES</span>
                  <strong>{ALL_COURSES.length}</strong>
                  <p>Practical learning tracks for builders.</p>
                  <button onClick={() => navigate("courses")} type="button">
                    Explore courses <ArrowIcon />
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

      {/* Exactly 5 Navigation Items at the bottom */}
      <nav className="mobile-bottom-bar" aria-label="Bottom Navigation">
        <button
          className={`bottom-nav-item ${view === "dashboard" ? "active" : ""}`}
          onClick={() => navigate("dashboard")}
          type="button"
        >
          <HomeNavIcon active={view === "dashboard"} />
          <span className="bottom-nav-label">Home</span>
        </button>

        <button
          className={`bottom-nav-item ${view === "projects" ? "active" : ""}`}
          onClick={() => navigate("projects")}
          type="button"
        >
          <ProjectsNavIcon active={view === "projects"} />
          <span className="bottom-nav-label">Projects</span>
        </button>

        <button
          className="bottom-nav-item create-item"
          onClick={() => setCreateSheetOpen(true)}
          type="button"
          aria-label="Create or Post"
        >
          <div className="create-plus-pill">
            <CreateNavIcon />
          </div>
          <span className="bottom-nav-label">Post</span>
        </button>

        <button
          className={`bottom-nav-item ${view === "internships" ? "active" : ""}`}
          onClick={() => navigate("internships")}
          type="button"
        >
          <JobsNavIcon active={view === "internships"} />
          <span className="bottom-nav-label">Jobs</span>
        </button>

        <button
          className={`bottom-nav-item ${view === "messages" ? "active" : ""}`}
          onClick={() => navigate("messages")}
          type="button"
        >
          <div className="bottom-nav-icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={view === "messages" ? "2.4" : "1.9"}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {unreadMsgCount > 0 && (
              <span className="bottom-nav-badge">
                {unreadMsgCount > 99 ? "99+" : unreadMsgCount}
              </span>
            )}
          </div>
          <span className="bottom-nav-label">Messages</span>
        </button>
      </nav>

      {/* OmniSearch Modal */}
      <OmniSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        projects={projects}
        internships={internships}
        navigate={navigate}
        onOpenProfile={handleOpenProfile}
      />

      {/* Member Public Profile Modal */}
      <PublicProfileModal
        userId={selectedProfileUserId}
        isOpen={profileModalOpen}
        onClose={() => {
          setProfileModalOpen(false);
          setSelectedProfileUserId(null);
        }}
        onStartMessage={(targetUserId) => {
          setChatTargetUserId(targetUserId);
          navigate("messages");
        }}
        currentUserId={account.id}
      />

      {/* Create (+) Action Sheet Modal */}
      <CreateSheetModal
        isOpen={createSheetOpen}
        onClose={() => setCreateSheetOpen(false)}
        canPostInternship={account.accountType !== "Student"}
        onSelectProjectCreate={() => {
          setAutoOpenProjectCreate(true);
          navigate("projects");
        }}
        onSelectInternshipCreate={() => {
          setAutoOpenInternshipCreate(true);
          navigate("internships");
        }}
      />
    </div>
  );
}

function ProjectsHub({
  account,
  projects,
  onCreate,
  onJoin,
  onDecision,
  autoOpenCreate,
  onOpenProfile,
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
  autoOpenCreate?: boolean;
  onOpenProfile?: (userId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [category, setCategory] = useState("All");
  const [skill, setSkill] = useState("All");
  const [showCreate, setShowCreate] = useState(Boolean(autoOpenCreate));
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
                  {project.creatorId && onOpenProfile ? (
                    <button
                      type="button"
                      className="project-owner-btn"
                      onClick={() => onOpenProfile(project.creatorId!)}
                      title={`View ${project.ownerName}'s public profile`}
                    >
                      {project.ownerName}
                    </button>
                  ) : (
                    <strong>{project.ownerName}</strong>
                  )}
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
  autoOpenCreate,
}: {
  canPost: boolean;
  internships: Internship[];
  onCreate: (data: any) => Promise<void>;
  autoOpenCreate?: boolean;
}) {
  const [showForm, setShowForm] = useState(Boolean(autoOpenCreate));
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
  const mentors = ALL_MENTORS;
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
  const courses = ALL_COURSES;

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

function MessagesPage({
  account,
  targetUserId,
  onClearTarget,
  onOpenProfile,
}: {
  account: UserAccount;
  targetUserId?: string | null;
  onClearTarget?: () => void;
  onOpenProfile?: (userId: string) => void;
}) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeUser, setActiveUser] = useState<ChatCounterparty | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    try {
      const res = await api.getConversations();
      if (res?.conversations) {
        setConversations(res.conversations);
      }
    } catch (e) {
      console.warn("Failed to fetch conversations:", e);
    } finally {
      setLoadingThreads(false);
    }
  };

  const openThread = async (user: ChatCounterparty) => {
    setActiveUser(user);
    setLoadingMessages(true);
    try {
      const res = await api.getThread(user.id);
      if (res) {
        setActiveUser(res.counterparty);
        setMessages(res.messages || []);
      }
    } catch (e) {
      console.warn("Failed to load thread:", e);
    } finally {
      setLoadingMessages(false);
      void fetchConversations();
    }
  };

  useEffect(() => {
    void fetchConversations();
    const interval = setInterval(() => {
      void fetchConversations();
      if (activeUser?.id) {
        void api.getThread(activeUser.id).then((res) => {
          if (res?.messages) {
            setMessages(res.messages);
          }
        });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeUser?.id]);

  useEffect(() => {
    if (targetUserId) {
      void api.getThread(targetUserId).then((res) => {
        if (res?.counterparty) {
          setActiveUser(res.counterparty);
          setMessages(res.messages || []);
        }
      });
      if (onClearTarget) onClearTarget();
    }
  }, [targetUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeUser || sending) return;

    const textToSend = inputText.trim();
    setInputText("");
    setSending(true);

    const tempMsg: DirectMessage = {
      id: "temp-" + Date.now(),
      senderId: account.id,
      receiverId: activeUser.id,
      body: textToSend,
      createdAt: new Date().toISOString(),
      read: true,
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await api.sendMessage(activeUser.id, textToSend);
      if (res?.message) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempMsg.id ? res.message : m)),
        );
      }
      void fetchConversations();
    } catch (err: any) {
      console.error("Failed to send message:", err);
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
      alert(err.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = conversations.filter((c) =>
    c.counterparty.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    c.counterparty.email.toLowerCase().includes(searchFilter.toLowerCase()),
  );

  return (
    <div className="messages-layout-page">
      <div className="marketplace-heading">
        <div>
          <span className="form-kicker">COLLABORATION NETWORK</span>
          <h1>Direct Messages</h1>
          <p>Chat directly with student project partners, teammates, and mentors.</p>
        </div>
      </div>

      <div className="chat-container-card">
        {/* Left Side: Conversations List */}
        <aside className={`chat-threads-sidebar ${activeUser ? "mobile-thread-hidden" : ""}`}>
          <div className="chat-threads-header">
            <h3>Conversations</h3>
            <span className="chat-thread-badge">{conversations.length}</span>
          </div>

          <div className="chat-thread-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Search conversations..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
            {searchFilter && (
              <button className="chat-search-clear" onClick={() => setSearchFilter("")} type="button">
                ✕
              </button>
            )}
          </div>

          <div className="chat-threads-list">
            {loadingThreads && conversations.length === 0 ? (
              <div className="chat-threads-empty">Loading messages...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="chat-threads-empty">
                {searchFilter ? "No conversations match your search." : "No active chats yet. Connect with a project lead or mentor to start collaborating!"}
              </div>
            ) : (
              filteredConversations.map((item) => {
                const isActive = activeUser?.id === item.counterparty.id;
                const initials =
                  item.counterparty.name
                    .split(" ")
                    .map((p) => p[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("") || "CC";
                return (
                  <button
                    className={`chat-thread-item ${isActive ? "active" : ""} ${item.unreadCount > 0 ? "has-unread" : ""}`}
                    key={item.counterparty.id}
                    onClick={() => openThread(item.counterparty)}
                    type="button"
                  >
                    <div className="chat-item-avatar">
                      {item.counterparty.imageUrl ? (
                        <img src={resolveImageUrl(item.counterparty.imageUrl)} alt={item.counterparty.name} />
                      ) : (
                        <span>{initials}</span>
                      )}
                      <span className="chat-online-dot" />
                    </div>
                    <div className="chat-item-info">
                      <div className="chat-item-topline">
                        <span className="chat-item-name">{item.counterparty.name}</span>
                        <span className="chat-item-time">
                          {new Date(item.lastMessage.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="chat-item-preview-line">
                        <span className="chat-item-preview">{item.lastMessage.body}</span>
                        {item.unreadCount > 0 && (
                          <span className="chat-unread-count">{item.unreadCount}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Side: Active Conversation Area */}
        <div className={`chat-conversation-area ${!activeUser ? "mobile-thread-hidden" : ""}`}>
          {activeUser ? (
            <>
              <div className="chat-header-bar">
                <button
                  className="chat-back-mobile-btn"
                  onClick={() => setActiveUser(null)}
                  type="button"
                  aria-label="Back to threads"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <div
                  className="chat-header-user"
                  onClick={() => onOpenProfile && activeUser && onOpenProfile(activeUser.id)}
                  title={onOpenProfile ? `View ${activeUser.name}'s profile` : undefined}
                  style={{ cursor: onOpenProfile ? "pointer" : "default" }}
                >
                  <div className="chat-header-avatar">
                    {activeUser.imageUrl ? (
                      <img src={resolveImageUrl(activeUser.imageUrl)} alt={activeUser.name} />
                    ) : (
                      <span>
                        {activeUser.name
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("") || "CC"}
                      </span>
                    )}
                  </div>
                  <div>
                    <h4>{activeUser.name}</h4>
                    <p>{activeUser.institution || activeUser.email}</p>
                  </div>
                </div>
              </div>

              <div className="chat-messages-scroll">
                {loadingMessages ? (
                  <div className="chat-loading-msg">Loading chat history...</div>
                ) : messages.length === 0 ? (
                  <div className="chat-empty-thread">
                    <p>No messages yet with {activeUser.name}.</p>
                    <small>Send a greeting to break the ice and discuss project collaboration!</small>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.senderId === account.id;
                    return (
                      <div
                        className={`chat-message-bubble-wrap ${isMe ? "outgoing" : "incoming"}`}
                        key={m.id}
                      >
                        <div className="chat-message-bubble">
                          <p>{m.body}</p>
                          <span className="chat-message-time">
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="chat-input-bar" onSubmit={handleSend}>
                <input
                  placeholder={`Message ${activeUser.name}...`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={sending}
                  autoFocus
                />
                <button
                  className="chat-send-btn"
                  disabled={!inputText.trim() || sending}
                  type="submit"
                  aria-label="Send message"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" />
                  </svg>
                </button>
              </form>
            </>
          ) : (
            <div className="chat-no-active-placeholder">
              <div className="chat-placeholder-icon">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3>Select a Conversation</h3>
              <p>Choose an existing thread or start a direct message with a project collaborator.</p>
            </div>
          )}
        </div>
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
  onAvatarUpdate,
  onLogout,
}: {
  account: UserAccount;
  onSave: (profile: Partial<UserAccount>) => Promise<void>;
  onAvatarUpdate: (imageUrl: string) => void;
  onLogout?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(account);
  const [busy, setBusy] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarFeedback, setAvatarFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(account);
  }, [account]);

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAvatarFeedback({ type: "error", text: "Please select an image file (PNG, JPG, WEBP, GIF)." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarFeedback({ type: "error", text: "Image size must be 5MB or less." });
      return;
    }

    setUploadingAvatar(true);
    setAvatarFeedback(null);
    try {
      const res = await api.uploadAvatar(file);
      setDraft((prev) => ({ ...prev, imageUrl: res.imageUrl }));
      onAvatarUpdate(res.imageUrl);
      setAvatarFeedback({ type: "success", text: "Profile photo updated!" });
    } catch (err: any) {
      setAvatarFeedback({ type: "error", text: err.message || "Failed to upload image." });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    setAvatarFeedback(null);
    try {
      await api.deleteAvatar();
      setDraft((prev) => ({ ...prev, imageUrl: "" }));
      onAvatarUpdate("");
      setAvatarFeedback({ type: "success", text: "Profile photo removed." });
    } catch (err: any) {
      setAvatarFeedback({ type: "error", text: err.message || "Failed to remove photo." });
    } finally {
      setUploadingAvatar(false);
    }
  };

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
        <div className="profile-title-actions">
          {!editing && (
            <button className="button button-dark" onClick={() => setEditing(true)} type="button">
              Edit profile
            </button>
          )}
          {onLogout && (
            <button className="profile-logout-btn" onClick={onLogout} type="button">
              <Icon size={16}>
                <path
                  d="M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </Icon>
              Log out
            </button>
          )}
        </div>
      </div>
      <form className="profile-card" onSubmit={save}>
        <div className="profile-avatar-wrap">
          <div
            className={`profile-avatar clickable ${uploadingAvatar ? "loading" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            style={
              draft.imageUrl
                ? {
                    backgroundImage: `url(${resolveImageUrl(draft.imageUrl)})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundColor: "transparent",
                  }
                : {}
            }
            title="Click to upload profile photo"
          >
            {uploadingAvatar ? (
              <div className="avatar-spinner" />
            ) : draft.imageUrl ? null : (
              initials
            )}
            <div className="avatar-edit-badge" title="Upload new photo">
              <Icon size={13}>
                <path
                  d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </Icon>
            </div>
          </div>
          <input
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleAvatarFile}
            ref={fileInputRef}
            style={{ display: "none" }}
            type="file"
          />
          <div className="avatar-controls">
            <button
              className="avatar-action-btn"
              disabled={uploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              {draft.imageUrl ? "Change photo" : "Upload photo"}
            </button>
            {draft.imageUrl && (
              <button
                className="avatar-remove-btn"
                disabled={uploadingAvatar}
                onClick={handleRemoveAvatar}
                type="button"
              >
                Remove
              </button>
            )}
          </div>
          {avatarFeedback && (
            <div className={`avatar-feedback ${avatarFeedback.type}`}>
              {avatarFeedback.text}
            </div>
          )}
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
  const [authenticated, setAuthenticated] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      const search = window.location.search;
      const token = new URLSearchParams(hash.split("?")[1] ?? search).get("token");
      if (token) return true;
    }
    return Boolean(getStoredToken());
  });
  const [inactivityNotice, setInactivityNotice] = useState<string | null>(null);

  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const toggleTheme = () => setDark((prev) => !prev);

  // Inactivity auto-logout (15 minutes of inactivity)
  const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

  useEffect(() => {
    if (!authenticated || !account) return;

    if (!localStorage.getItem("cc_last_activity")) {
      localStorage.setItem("cc_last_activity", Date.now().toString());
    }

    let lastSaved = 0;
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastSaved > 3000) {
        lastSaved = now;
        localStorage.setItem("cc_last_activity", now.toString());
      }
    };

    const checkInactivity = () => {
      const raw = localStorage.getItem("cc_last_activity");
      const lastTime = raw ? Number(raw) : Date.now();
      if (Date.now() - lastTime > INACTIVITY_TIMEOUT_MS) {
        void handleAutoLogout();
      }
    };

    const handleAutoLogout = async () => {
      try {
        await api.logout();
      } catch (_) {}
      setAuthenticated(false);
      setAccount(null);
      setStoredToken(null);
      setStoredAccount(null);
      localStorage.removeItem("cc_last_activity");
      setInactivityNotice(
        "You were automatically logged out due to 15 minutes of inactivity to protect your account. Please log in again to continue.",
      );
      navigate("login");
    };

    const events = ["mousedown", "mousemove", "keydown", "touchstart", "scroll", "click"];
    for (const ev of events) {
      window.addEventListener(ev, handleUserActivity, { passive: true });
    }

    const timerId = setInterval(checkInactivity, 10000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkInactivity();
      }
    };
    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    return () => {
      for (const ev of events) {
        window.removeEventListener(ev, handleUserActivity);
      }
      clearInterval(timerId);
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [authenticated, account]);

  // Handle OAuth callback token from URL (hash or search params)
  useEffect(() => {
    try {
      const hash = window.location.hash;
      const search = window.location.search;
      const token = new URLSearchParams(hash.split("?")[1] ?? search).get("token");
      if (token) {
        setStoredToken(token, true);
        const cleanUrl =
          window.location.origin +
          window.location.pathname +
          (hash.split("?")[0] === "" ? "" : hash.split("?")[0]);
        window.history.replaceState({}, document.title, cleanUrl);

        void (async () => {
          try {
            const { user } = await api.me();
            if (user) {
              setAccount(user);
              setStoredAccount(user, true);
              setAuthenticated(true);
              navigate(user.onboardingComplete ? "dashboard" : "onboarding");
            }
          } catch (e) {
            console.error("Failed to load user session after Google OAuth:", e);
          }
        })();
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
    setInactivityNotice(null);
    localStorage.setItem("cc_last_activity", Date.now().toString());
    setAccount(next);
    setAuthenticated(true);
    setStoredAccount(next, remember);
  };

  const handleLogout = async () => {
    await api.logout();
    setAuthenticated(false);
    setAccount(null);
    localStorage.removeItem("cc_last_activity");
    navigate("login");
  };

  const handleAvatarUpdate = (imageUrl: string) => {
    setAccount((current) => {
      if (!current) return null;
      const updated = { ...current, imageUrl };
      setStoredAccount(updated);
      return updated;
    });
  };

  const handleSaveProfile = async (changes: Partial<UserAccount>) => {
    if (!account) return;
    const res = await api.updateProfile(changes);
    const updated = { ...account, ...changes, ...res.profile };
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
    "messages",
  ];
  const visitorViews: View[] = ["signup", "login", "verify", "forgot", "reset"];

  // Route protection
  if (protectedViews.includes(view) && (!authenticated || !account)) {
    return (
      <Login
        dark={dark}
        inactivityNotice={inactivityNotice}
        navigate={navigate}
        onLoginSuccess={handleLoginSuccess}
        onToggleTheme={toggleTheme}
      />
    );
  }

  if (authenticated && account && visitorViews.includes(view)) {
    return (
      <AppShell
        account={account}
        dark={dark}
        internships={internships}
        navigate={navigate}
        notices={notices}
        onAvatarUpdate={handleAvatarUpdate}
        onCreateInternship={handleCreateInternship}
        onCreateProject={handleCreateProject}
        onJoinProject={handleJoinProject}
        onLogout={handleLogout}
        onReadNotices={handleReadNotices}
        onRequestDecision={handleRequestDecision}
        onSaveProfile={handleSaveProfile}
        onToggleTheme={toggleTheme}
        projects={projects}
        view="dashboard"
      />
    );
  }

  if (view === "signup") {
    return (
      <Signup
        dark={dark}
        navigate={navigate}
        onAccountCreated={handleAccountCreated}
        onToggleTheme={toggleTheme}
      />
    );
  }
  if (view === "login") {
    return (
      <Login
        dark={dark}
        inactivityNotice={inactivityNotice}
        navigate={navigate}
        onLoginSuccess={handleLoginSuccess}
        onToggleTheme={toggleTheme}
      />
    );
  }
  if (view === "verify") {
    return (
      <Verify
        account={account}
        dark={dark}
        navigate={navigate}
        onToggleTheme={toggleTheme}
        onVerified={() => {
          if (account) setAccount({ ...account, verified: true });
        }}
      />
    );
  }
  if (view === "forgot") {
    return <ForgotPassword dark={dark} navigate={navigate} onToggleTheme={toggleTheme} />;
  }
  if (view === "reset") {
    return <ResetPassword dark={dark} navigate={navigate} onToggleTheme={toggleTheme} />;
  }
  if (view === "onboarding" && account) {
    return (
      <Onboarding
        account={account}
        dark={dark}
        onSave={async (changes) => {
          await handleSaveProfile(changes);
          navigate("dashboard");
        }}
        onSkip={async () => {
          await handleSaveProfile({ onboardingSkipped: true });
          navigate("dashboard");
        }}
        onToggleTheme={toggleTheme}
      />
    );
  }
  if (protectedViews.includes(view) && account) {
    return (
      <AppShell
        account={account}
        dark={dark}
        internships={internships}
        navigate={navigate}
        notices={notices}
        onAvatarUpdate={handleAvatarUpdate}
        onCreateInternship={handleCreateInternship}
        onCreateProject={handleCreateProject}
        onJoinProject={handleJoinProject}
        onLogout={handleLogout}
        onReadNotices={handleReadNotices}
        onRequestDecision={handleRequestDecision}
        onSaveProfile={handleSaveProfile}
        onToggleTheme={toggleTheme}
        projects={projects}
        view={view}
      />
    );
  }

  return <Landing dark={dark} navigate={navigate} onToggleTheme={toggleTheme} />;
}
