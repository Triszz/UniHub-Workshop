import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { studentWorkshopService } from "../../services/studentWorkshop.service";
import { registrationService } from "../../services/registration.service";
import type { Workshop } from "../../types";

/* ─────────────── helpers ─────────────── */

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatPrice = (price: number) => {
  if (price === 0) return "Miễn phí";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(price);
};

const extractApiError = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { error?: string; message?: string } } };
  return e.response?.data?.error || e.response?.data?.message || fallback;
};

const POLL_INTERVAL = 8_000;

/* ─────────────── component ─────────────── */

export const WorkshopDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState(false);

  // Initial fetch
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    studentWorkshopService.getById(id).then(
      (ws) => {
        if (!cancelled) {
          setWorkshop(ws);
          setError("");
          setLoading(false);
        }
      },
      (err) => {
        if (!cancelled) {
          setError(extractApiError(err, "Không thể tải thông tin workshop"));
          setLoading(false);
        }
      }
    );

    return () => { cancelled = true; };
  }, [id]);

  // Polling for seat count
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(() => {
      studentWorkshopService.getById(id).then(
        (ws) => setWorkshop(ws),
        () => { /* silent fail for background poll */ }
      );
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [id]);

  /* ── Registration ── */
  const handleRegister = async () => {
    if (!workshop) return;
    setRegistering(true);
    setRegisterError("");

    try {
      await registrationService.register(workshop.id);
      setRegisterSuccess(true);
      // Refetch to update seat count
      const ws = await studentWorkshopService.getById(workshop.id);
      setWorkshop(ws);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { error?: string; message?: string } } };
      const status = error.response?.status;
      const serverMsg =
        error.response?.data?.error || error.response?.data?.message;

      if (status === 409) {
        setRegisterError(serverMsg || "Đã đăng ký hoặc hết chỗ.");
      } else if (status === 400) {
        setRegisterError(
          serverMsg || "Workshop không thể đăng ký lúc này."
        );
      } else {
        setRegisterError(serverMsg || "Đăng ký thất bại, vui lòng thử lại.");
      }
    } finally {
      setRegistering(false);
    }
  };

  /* ── Derived state ── */
  const remaining = workshop
    ? workshop.capacity - workshop.registeredCount
    : 0;
  const isFull = remaining <= 0;
  const isPast = workshop ? new Date(workshop.endsAt) < new Date() : false;
  const isOngoing = workshop
    ? new Date(workshop.startsAt) <= new Date() &&
      new Date() < new Date(workshop.endsAt)
    : false;
  const isFree = workshop ? workshop.price === 0 : false;
  const canRegister =
    workshop &&
    !isPast &&
    !isOngoing &&
    !isFull &&
    isFree &&
    !registerSuccess;

  const getButtonLabel = () => {
    if (registerSuccess) return "✓ Đã đăng ký thành công";
    if (isPast) return "Workshop đã kết thúc";
    if (isOngoing) return "Workshop đang diễn ra";
    if (isFull) return "Hết chỗ";
    if (!isFree) return "Workshop có phí (chưa hỗ trợ)";
    if (registering) return "Đang xử lý...";
    return "Đăng ký ngay";
  };

  /* ─────────────── render ─────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
          <p className="text-sm text-gray-500">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (error || !workshop) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm text-red-700">{error || "Workshop không tồn tại"}</p>
        <Link
          to="/workshops"
          className="mt-3 inline-block text-sm font-medium text-red-600 hover:underline"
        >
          ← Quay lại danh sách
        </Link>
      </div>
    );
  }

  const pct =
    workshop.capacity > 0
      ? (workshop.registeredCount / workshop.capacity) * 100
      : 100;

  return (
    <>
      {/* Back link */}
      <Link
        to="/workshops"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-gray-600 transition-colors hover:text-gray-900"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Quay lại danh sách
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Main info ── */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            {/* Status badges */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  isFree
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {formatPrice(workshop.price)}
              </span>
              {isOngoing && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  Đang diễn ra
                </span>
              )}
              {isPast && (
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                  Đã kết thúc
                </span>
              )}
            </div>

            {/* Title */}
            <h2 className="mb-4 text-2xl font-bold text-gray-900">
              {workshop.title}
            </h2>

            {/* Description */}
            {workshop.description && (
              <div className="mb-6">
                <h3 className="mb-2 text-sm font-semibold text-gray-700">
                  Mô tả
                </h3>
                <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-line">
                  {workshop.description}
                </p>
              </div>
            )}

            {/* AI Summary */}
            {workshop.aiSummary && (
              <div className="mb-6 rounded-lg bg-primary-50/50 border border-primary-100 p-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-primary-800">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
                  </svg>
                  Tóm tắt bởi AI
                </h3>
                <p className="text-sm leading-relaxed text-primary-700">
                  {workshop.aiSummary}
                </p>
              </div>
            )}

            {/* Detail grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Speaker */}
              {workshop.speakerName && (
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Diễn giả
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {workshop.speakerName}
                  </p>
                  {workshop.speakerBio && (
                    <p className="mt-1 text-xs text-gray-500 line-clamp-3">
                      {workshop.speakerBio}
                    </p>
                  )}
                </div>
              )}

              {/* Time */}
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="mb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Thời gian
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatDateTime(workshop.startsAt)}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  → {formatDateTime(workshop.endsAt)}
                </p>
              </div>

              {/* Room */}
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="mb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Phòng
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {workshop.room?.name || "—"}
                </p>
                {workshop.room?.building && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    {workshop.room.building}
                  </p>
                )}
              </div>

              {/* Capacity */}
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="mb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Sức chứa
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {workshop.capacity} chỗ
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sidebar: Seats + CTA ── */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-4">
            {/* Seats card */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">
                Chỗ ngồi
              </h3>
              <div className="mb-2 flex items-end justify-between">
                <span
                  className={`text-3xl font-bold ${
                    isFull
                      ? "text-red-600"
                      : remaining <= 5
                        ? "text-amber-600"
                        : "text-primary-700"
                  }`}
                >
                  {isFull ? "Hết chỗ" : remaining}
                </span>
                {!isFull && (
                  <span className="text-sm text-gray-400">
                    / {workshop.capacity} chỗ
                  </span>
                )}
              </div>
              <div className="mb-3 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    pct >= 100
                      ? "bg-red-500"
                      : pct >= 80
                        ? "bg-amber-500"
                        : "bg-primary-500"
                  }`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">
                {workshop.registeredCount} đã đăng ký
              </p>
            </div>

            {/* Register CTA */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <button
                id="btn-register"
                disabled={!canRegister || registering}
                onClick={handleRegister}
                className={`w-full rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition-all
                  ${
                    registerSuccess
                      ? "bg-emerald-600 text-white cursor-default"
                      : canRegister && !registering
                        ? "bg-primary-600 text-white hover:bg-primary-700 active:scale-[0.98]"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
              >
                {registering && (
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white align-middle" />
                )}
                {getButtonLabel()}
              </button>

              {/* Error */}
              {registerError && (
                <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {registerError}
                </div>
              )}

              {/* Success */}
              {registerSuccess && (
                <div className="mt-3 space-y-2">
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
                    Đăng ký thành công! Xem QR code tại trang "Đăng ký của tôi".
                  </div>
                  <button
                    onClick={() => navigate("/my-registrations")}
                    className="w-full rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700
                      transition-colors hover:bg-primary-100"
                  >
                    Xem đăng ký của tôi →
                  </button>
                </div>
              )}
            </div>

            {/* Auto-update note */}
            <p className="text-center text-[11px] text-gray-400">
              Số chỗ cập nhật tự động mỗi {POLL_INTERVAL / 1000}s
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
