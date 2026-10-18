import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-xl transition-colors duration-150 no-underline ${
    isActive
      ? "bg-surface-900 text-white"
      : "text-surface-600 hover:bg-surface-100 hover:text-surface-900"
  }`;

export function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";

  const navLinks = (
    <>
      <NavLink to="/projects" className={linkClass} onClick={() => setOpen(false)}>
        <i className="fa-solid fa-folder-open text-xs"></i>
        Projects
      </NavLink>
      <NavLink to="/opportunities" className={linkClass} onClick={() => setOpen(false)}>
        <i className="fa-solid fa-rocket text-xs"></i>
        Opportunities
      </NavLink>
      {user && (
        <NavLink to="/profile" className={linkClass} onClick={() => setOpen(false)}>
          <i className="fa-solid fa-user text-xs"></i>
          Profile
        </NavLink>
      )}
      {user?.role === "ADMIN" && (
        <NavLink to="/admin" className={linkClass} onClick={() => setOpen(false)}>
          <i className="fa-solid fa-shield-halved text-xs"></i>
          Admin
        </NavLink>
      )}
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-surface-50">
      {/* Navigation - stays at top with sticky behavior */}
      <header className="sticky top-0 z-50 border-b border-surface-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Logo */}
          <Link to="/" className="group flex items-center gap-2.5 no-underline">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 transition-transform duration-150 group-hover:-rotate-6">
              <i className="fa-solid fa-graduation-cap text-sm text-white"></i>
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-surface-900">
              Campus<span className="text-brand-600">Connect</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">{navLinks}</nav>

          {/* Desktop auth */}
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <div className="flex items-center gap-2 rounded-xl bg-surface-100 py-1.5 pl-1.5 pr-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <span className="max-w-[10rem] truncate text-xs font-semibold text-surface-700">
                    {user.email}
                  </span>
                </div>
                <button className="btn-secondary px-4 py-2" onClick={() => void logout()}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost no-underline">
                  Log in
                </Link>
                <Link to="/register" className="btn-primary no-underline">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-300 text-surface-700 transition-colors hover:bg-surface-100 md:hidden"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label="Toggle navigation"
          >
            <i className={`fa-solid ${open ? "fa-xmark" : "fa-bars"} text-sm`}></i>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className={`mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 ${isHome ? "py-0" : "py-8 lg:py-12"}`}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600">
                <i className="fa-solid fa-graduation-cap text-[10px] text-white"></i>
              </div>
              <span className="font-display text-sm font-bold text-surface-900">
                Campus<span className="text-brand-600">Connect</span>
              </span>
            </div>
            <p className="text-xs text-surface-500">
              © {new Date().getFullYear()} CampusConnect. Built for students, by students.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
