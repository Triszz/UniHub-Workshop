import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export const StudentLayout: React.FC = () => {
  const { user, logout } = useAuth();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
      isActive
        ? "text-primary-700 bg-primary-50"
        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
    }`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50/30">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <span className="text-xl">🎓</span>
            <h1 className="text-lg font-bold text-gray-900">UniHub Workshop</h1>
          </div>

          {/* Nav links */}
          <nav className="hidden items-center gap-1 sm:flex">
            <NavLink to="/workshops" className={linkClass} end>
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
                </svg>
                Workshops
              </span>
            </NavLink>
            <NavLink to="/my-registrations" className={linkClass}>
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
                </svg>
                Đăng ký của tôi
              </span>
            </NavLink>
          </nav>

          {/* User info */}
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-gray-700">{user?.fullName}</p>
              <p className="text-xs text-gray-400">{user?.email}</p>
            </div>
            <button
              id="btn-logout"
              onClick={() => void logout()}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600
                transition-all hover:bg-red-50 hover:border-red-200 hover:text-red-600"
            >
              Đăng xuất
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="flex border-t border-gray-100 sm:hidden">
          <NavLink
            to="/workshops"
            end
            className={({ isActive }) =>
              `flex-1 py-2.5 text-center text-xs font-medium transition-colors ${
                isActive
                  ? "text-primary-700 border-b-2 border-primary-600 bg-primary-50/50"
                  : "text-gray-500"
              }`
            }
          >
            Workshops
          </NavLink>
          <NavLink
            to="/my-registrations"
            className={({ isActive }) =>
              `flex-1 py-2.5 text-center text-xs font-medium transition-colors ${
                isActive
                  ? "text-primary-700 border-b-2 border-primary-600 bg-primary-50/50"
                  : "text-gray-500"
              }`
            }
          >
            Đăng ký của tôi
          </NavLink>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
};
