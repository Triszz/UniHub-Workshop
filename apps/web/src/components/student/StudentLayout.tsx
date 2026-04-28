import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { notificationService } from "../../services/notification.service";
import type { NotificationItem } from "../../types";

const POLL_MS = 30000;
const HISTORY_LIMIT = 50;
const HISTORY_DAYS = 7;
const TEXT = {
  myRegs: "\u0110\u0103ng k\u00fd c\u1ee7a t\u00f4i",
  logout: "\u0110\u0103ng xu\u1ea5t",
  notifications: "Th\u00f4ng b\u00e1o",
  unread: "ch\u01b0a \u0111\u1ecdc",
  history: "L\u1ecbch s\u1eed 7 ng\u00e0y",
  markAll: "\u0110\u1ecdc t\u1ea5t c\u1ea3",
  empty: "Kh\u00f4ng c\u00f3 th\u00f4ng b\u00e1o trong 7 ng\u00e0y qua",
  emptyHint:
    "C\u00e1c c\u1eadp nh\u1eadt v\u1ec1 workshop s\u1ebd xu\u1ea5t hi\u1ec7n t\u1ea1i \u0111\u00e2y.",
  apiMissing:
    "Th\u00f4ng b\u00e1o ch\u01b0a kh\u1ea3 d\u1ee5ng tr\u00ean API hi\u1ec7n t\u1ea1i.",
  loadFailed: "Kh\u00f4ng th\u1ec3 t\u1ea3i th\u00f4ng b\u00e1o.",
  markFailed: "Ch\u01b0a th\u1ec3 \u0111\u00e1nh d\u1ea5u \u0111\u00e3 \u0111\u1ecdc.",
  markAllFailed:
    "Ch\u01b0a th\u1ec3 \u0111\u00e1nh d\u1ea5u t\u1ea5t c\u1ea3 \u0111\u00e3 \u0111\u1ecdc.",
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const getNotificationTitle = (notification: NotificationItem) => {
  if (notification.payload?.title) return String(notification.payload.title);
  if (notification.payload?.workshopTitle) {
    return String(notification.payload.workshopTitle);
  }

  const labels: Record<string, string> = {
    registration_confirmed:
      "\u0110\u0103ng k\u00fd th\u00e0nh c\u00f4ng",
    payment_completed: "Thanh to\u00e1n th\u00e0nh c\u00f4ng",
    workshop_updated: "Workshop \u0111\u00e3 c\u1eadp nh\u1eadt",
    workshop_cancelled: "Workshop \u0111\u00e3 h\u1ee7y",
    workshop_reminder: "Nh\u1eafc l\u1ecbch workshop",
  };

  return labels[notification.type] || TEXT.notifications;
};

const getNotificationMessage = (notification: NotificationItem) => {
  if (notification.payload?.message) return String(notification.payload.message);
  if (notification.type === "workshop_reminder") {
    return "Workshop c\u1ee7a b\u1ea1n s\u1eafp di\u1ec5n ra.";
  }
  if (notification.type === "registration_confirmed") {
    return "B\u1ea1n \u0111\u00e3 \u0111\u0103ng k\u00fd workshop th\u00e0nh c\u00f4ng.";
  }
  if (notification.type === "payment_completed") {
    return "Thanh to\u00e1n \u0111\u00e3 \u0111\u01b0\u1ee3c x\u00e1c nh\u1eadn. QR c\u1ee7a b\u1ea1n \u0111\u00e3 s\u1eb5n s\u00e0ng.";
  }
  if (notification.payload?.startsAt) {
    return `Th\u1eddi gian: ${notification.payload.startsAt}`;
  }
  return "B\u1ea1n c\u00f3 m\u1ed9t th\u00f4ng b\u00e1o m\u1edbi.";
};

const isUnread = (notification: NotificationItem) =>
  notification.status === "pending" || notification.status === "sent";

const NotificationBell = () => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await notificationService.getHistory(HISTORY_LIMIT, HISTORY_DAYS);
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount ?? result.notifications.length);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setNotifications([]);
      setUnreadCount(0);
      setError(status === 404 ? TEXT.apiMissing : TEXT.loadFailed);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void fetchNotifications(), 0);
    const interval = window.setInterval(() => void fetchNotifications(), POLL_MS);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (
        panelRef.current &&
        event.target instanceof Node &&
        !panelRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const visibleCount = useMemo(
    () => (unreadCount > 9 ? "9+" : String(unreadCount)),
    [unreadCount],
  );

  const handleMarkRead = async (id: string) => {
    const notification = notifications.find((item) => item.id === id);
    if (!notification || !isUnread(notification)) return;

    try {
      await notificationService.markRead(id);
      setNotifications((items) =>
        items.map((item) => (item.id === id ? { ...item, status: "read" } : item)),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch {
      setError(TEXT.markFailed);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications((items) =>
        items.map((item) => (isUnread(item) ? { ...item, status: "read" } : item)),
      );
      setUnreadCount(0);
    } catch {
      setError(TEXT.markAllFailed);
    }
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          if (!open) void fetchNotifications();
        }}
        className="relative rounded-lg border border-gray-200 bg-white p-2 text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
        aria-label={TEXT.notifications}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
            {visibleCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {TEXT.notifications}
              </p>
              <p className="text-xs text-gray-500">
                {unreadCount} {TEXT.unread} · {TEXT.history}
              </p>
            </div>
            {unreadCount > 0 && (
              <button type="button" onClick={handleMarkAllRead} className="text-xs font-medium text-primary-600 hover:underline">
                {TEXT.markAll}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center px-4 py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
              </div>
            )}
            {!loading && error && (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-gray-600">{error}</p>
              </div>
            )}
            {!loading && !error && notifications.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-medium text-gray-900">{TEXT.empty}</p>
                <p className="mt-1 text-xs text-gray-500">{TEXT.emptyHint}</p>
              </div>
            )}
            {!loading &&
              !error &&
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void handleMarkRead(notification.id)}
                  className={`block w-full border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                    isUnread(notification) ? "bg-primary-50/40" : "bg-white"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {isUnread(notification) && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-600" />
                    )}
                    <p
                      className={`text-sm text-gray-900 ${
                        isUnread(notification) ? "font-bold" : "font-medium"
                      }`}
                    >
                      {getNotificationTitle(notification)}
                    </p>
                  </div>
                  <p
                    className={`mt-1 text-xs leading-relaxed ${
                      isUnread(notification) ? "font-semibold text-gray-700" : "font-normal text-gray-500"
                    }`}
                  >
                    {getNotificationMessage(notification)}
                  </p>
                  <p className="mt-2 text-[11px] text-gray-400">
                    {formatTime(notification.createdAt)}
                  </p>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const StudentLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
      isActive ? "text-primary-700 bg-primary-50" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
    }`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50/30">
      <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="text-xl">{"\ud83c\udf93"}</span>
            <h1 className="text-lg font-bold text-gray-900">UniHub Workshop</h1>
          </div>
          <nav className="hidden items-center gap-1 sm:flex">
            <NavLink to="/workshops" className={linkClass} end>
              <span className="flex items-center gap-1.5">Workshops</span>
            </NavLink>
            <NavLink to="/my-registrations" className={linkClass}>
              <span className="flex items-center gap-1.5">{TEXT.myRegs}</span>
            </NavLink>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationBell />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-gray-700">{user?.fullName}</p>
              <p className="text-xs text-gray-400">{user?.email}</p>
            </div>
            <button
              id="btn-logout"
              onClick={() => void logout()}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              {TEXT.logout}
            </button>
          </div>
        </div>
        <div className="flex border-t border-gray-100 sm:hidden">
          <NavLink
            to="/workshops"
            end
            className={({ isActive }) =>
              `flex-1 py-2.5 text-center text-xs font-medium transition-colors ${
                isActive ? "border-b-2 border-primary-600 bg-primary-50/50 text-primary-700" : "text-gray-500"
              }`
            }
          >
            Workshops
          </NavLink>
          <NavLink
            to="/my-registrations"
            className={({ isActive }) =>
              `flex-1 py-2.5 text-center text-xs font-medium transition-colors ${
                isActive ? "border-b-2 border-primary-600 bg-primary-50/50 text-primary-700" : "text-gray-500"
              }`
            }
          >
            {TEXT.myRegs}
          </NavLink>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
};
