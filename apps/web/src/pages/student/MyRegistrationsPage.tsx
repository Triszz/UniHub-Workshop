import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { registrationService } from "../../services/registration.service";
import { QrCodeDisplay } from "../../components/student/QrCodeDisplay";
import type { Registration } from "../../types";

/* ─────────────── helpers ─────────────── */

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const statusConfig: Record<
  string,
  { label: string; classes: string; dot: string }
> = {
  confirmed: {
    label: "Đã xác nhận",
    classes: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  pending: {
    label: "Chờ xử lý",
    classes: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  cancelled: {
    label: "Đã hủy",
    classes: "bg-red-50 text-red-700",
    dot: "bg-red-500",
  },
  checked_in: {
    label: "Đã tham gia",
    classes: "bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
};

const extractApiError = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { error?: string; message?: string } } };
  return e.response?.data?.error || e.response?.data?.message || fallback;
};

/* ─────────────── component ─────────────── */

export const MyRegistrationsPage: React.FC = () => {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;

    registrationService.getMyRegistrations().then(
      (data) => {
        if (!cancelled) {
          setRegistrations(data);
          setError("");
          setLoading(false);
        }
      },
      (err) => {
        if (!cancelled) {
          setError(extractApiError(err, "Không thể tải danh sách đăng ký"));
          setLoading(false);
        }
      }
    );

    return () => { cancelled = true; };
  }, []);

  // Manual retry handler (event handler, not called from effects)
  const handleRetry = () => {
    setLoading(true);
    setError("");
    registrationService.getMyRegistrations().then(
      (data) => { setRegistrations(data); setLoading(false); },
      (err) => { setError(extractApiError(err, "Không thể tải danh sách đăng ký")); setLoading(false); }
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  /* ─────────────── render ─────────────── */
  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Đăng ký của tôi
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Quản lý các workshop bạn đã đăng ký
          </p>
        </div>
        <Link
          to="/workshops"
          className="self-start rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600
            shadow-sm transition-colors hover:bg-gray-50"
        >
          + Đăng ký thêm
        </Link>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
            <p className="text-sm text-gray-500">Đang tải...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={handleRetry}
            className="mt-3 text-sm font-medium text-red-600 hover:underline"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && registrations.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <svg
              className="h-7 w-7 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900">
            Bạn chưa đăng ký workshop nào
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Hãy khám phá các workshop đang mở đăng ký
          </p>
          <Link
            to="/workshops"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white
              shadow-sm transition-colors hover:bg-primary-700"
          >
            Xem danh sách Workshop
          </Link>
        </div>
      )}

      {/* Registration cards */}
      {!loading && !error && registrations.length > 0 && (
        <div className="space-y-4">
          {registrations.map((reg) => {
            const cfg =
              statusConfig[reg.status] || statusConfig.confirmed;
            const isExpanded = expandedId === reg.id;
            const ws = reg.workshop;
            const isPast = ws ? new Date(ws.endsAt) < new Date() : false;

            return (
              <div
                key={reg.id}
                className={`rounded-xl border bg-white shadow-sm transition-all ${
                  reg.status === "cancelled"
                    ? "border-gray-200 opacity-60"
                    : "border-gray-200 hover:border-primary-200"
                }`}
              >
                {/* Card header */}
                <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Workshop title */}
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.classes}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`}
                        />
                        {cfg.label}
                      </span>
                      {isPast && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                          Đã kết thúc
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 truncate">
                      {ws?.title || "Workshop không xác định"}
                    </h3>
                    {ws && (
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                          </svg>
                          {formatDateTime(ws.startsAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                          </svg>
                          {ws.room?.name}
                          {ws.room?.building && ` – ${ws.room.building}`}
                        </span>
                      </div>
                    )}
                    <p className="mt-1.5 text-[11px] text-gray-400">
                      Đăng ký lúc: {formatDateTime(reg.createdAt)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {ws && (
                      <Link
                        to={`/workshops/${ws.id}`}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600
                          transition-colors hover:bg-gray-50"
                      >
                        Chi tiết
                      </Link>
                    )}
                    {reg.qrCode && reg.status !== "cancelled" && (
                      <button
                        onClick={() => toggleExpand(reg.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          isExpanded
                            ? "bg-primary-600 text-white"
                            : "border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100"
                        }`}
                      >
                        {isExpanded ? "Ẩn QR" : "Xem QR"}
                      </button>
                    )}
                  </div>
                </div>

                {/* QR Code expanded section */}
                {isExpanded && reg.qrCode && (
                  <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-6">
                    <div className="flex flex-col items-center">
                      <p className="mb-4 text-sm font-medium text-gray-700">
                        Mã QR check-in
                      </p>
                      <QrCodeDisplay
                        value={reg.qrCode}
                        size={220}
                        label="Đưa mã QR này cho nhân viên check-in tại workshop"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};
