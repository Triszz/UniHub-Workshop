import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { studentWorkshopService } from "../../services/studentWorkshop.service";
import { registrationService } from "../../services/registration.service";
import type { Workshop } from "../../types";

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
  if (price === 0) return "Mi\u1ec5n ph\u00ed";
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

export const WorkshopDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState(false);

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
          setError(extractApiError(err, "Kh\u00f4ng th\u1ec3 t\u1ea3i th\u00f4ng tin workshop"));
          setLoading(false);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const interval = window.setInterval(() => {
      studentWorkshopService.getById(id).then(
        (ws) => setWorkshop(ws),
        () => {
          // Seat polling is best effort; stale counts are refreshed on next tick.
        },
      );
    }, POLL_INTERVAL);

    return () => window.clearInterval(interval);
  }, [id]);

  const remaining = workshop ? workshop.capacity - workshop.registeredCount : 0;
  const isFull = remaining <= 0;
  const isPast = workshop ? new Date(workshop.endsAt) < new Date() : false;
  const isOngoing = workshop
    ? new Date(workshop.startsAt) <= new Date() && new Date() < new Date(workshop.endsAt)
    : false;
  const isFree = workshop ? workshop.price === 0 : false;
  const canRegister =
    workshop && !isPast && !isOngoing && !isFull && !registerSuccess;

  const handleRegister = async () => {
    if (!workshop) return;
    setRegistering(true);
    setRegisterError("");

    try {
      const response = await registrationService.register(workshop.id);

      if (response.checkoutUrl) {
        navigate(response.checkoutUrl);
        return;
      }

      setRegisterSuccess(true);
      const ws = await studentWorkshopService.getById(workshop.id);
      setWorkshop(ws);
    } catch (e: unknown) {
      const apiError = e as { response?: { status?: number } };
      const status = apiError.response?.status;

      if (status === 409) {
        if (!isFree) {
          try {
            const regs = await registrationService.getMyRegistrations();
            const existing = regs.find(
              (reg) => reg.workshop?.id === workshop.id && reg.status !== "cancelled",
            );

            if (existing?.status === "pending") {
              navigate(`/checkout/${existing.id}`);
              return;
            }

            if (existing?.status === "confirmed" || existing?.status === "checked_in") {
              setRegisterSuccess(true);
              setRegisterError("B\u1ea1n \u0111\u00e3 \u0111\u0103ng k\u00fd workshop n\u00e0y. V\u00e0o '\u0110\u0103ng k\u00fd c\u1ee7a t\u00f4i' \u0111\u1ec3 xem QR.");
              return;
            }
          } catch {
            // Fall back to the generic duplicate message below.
          }
        }

        setRegisterError("\u0110\u00e3 \u0111\u0103ng k\u00fd ho\u1eb7c h\u1ebft ch\u1ed7.");
      } else if (status === 400) {
        setRegisterError("Workshop kh\u00f4ng th\u1ec3 \u0111\u0103ng k\u00fd l\u00fac n\u00e0y.");
      } else {
        setRegisterError("\u0110\u0103ng k\u00fd th\u1ea5t b\u1ea1i, vui l\u00f2ng th\u1eed l\u1ea1i.");
      }
    } finally {
      setRegistering(false);
    }
  };

  const getButtonLabel = () => {
    if (registerSuccess) return "\u2713 \u0110\u00e3 \u0111\u0103ng k\u00fd th\u00e0nh c\u00f4ng";
    if (isPast) return "Workshop \u0111\u00e3 k\u1ebft th\u00fac";
    if (isOngoing) return "Workshop \u0111ang di\u1ec5n ra";
    if (isFull) return "H\u1ebft ch\u1ed7";
    if (registering) return "\u0110ang x\u1eed l\u00fd...";
    return isFree ? "\u0110\u0103ng k\u00fd ngay" : "Thanh to\u00e1n ngay";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
          <p className="text-sm text-gray-500">{"\u0110ang t\u1ea3i..."}</p>
        </div>
      </div>
    );
  }

  if (error || !workshop) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm text-red-700">{error || "Workshop kh\u00f4ng t\u1ed3n t\u1ea1i"}</p>
        <Link
          to="/workshops"
          className="mt-3 inline-block text-sm font-medium text-red-600 hover:underline"
        >
          {"\u2190 Quay l\u1ea1i danh s\u00e1ch"}
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
      <Link
        to="/workshops"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-gray-600 transition-colors hover:text-gray-900"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        {"Quay l\u1ea1i danh s\u00e1ch"}
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
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
                  {"\u0110ang di\u1ec5n ra"}
                </span>
              )}
              {isPast && (
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                  {"\u0110\u00e3 k\u1ebft th\u00fac"}
                </span>
              )}
            </div>

            <h2 className="mb-4 text-2xl font-bold text-gray-900">
              {workshop.title}
            </h2>

            {workshop.description && (
              <div className="mb-6">
                <h3 className="mb-2 text-sm font-semibold text-gray-700">
                  {"M\u00f4 t\u1ea3"}
                </h3>
                <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">
                  {workshop.description}
                </p>
              </div>
            )}

            {workshop.aiSummary && (
              <div className="mb-6 rounded-lg border border-primary-100 bg-primary-50/50 p-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-primary-800">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
                  </svg>
                  {"T\u00f3m t\u1eaft b\u1edfi AI"}
                </h3>
                <p className="text-sm leading-relaxed text-primary-700">
                  {workshop.aiSummary}
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {workshop.speakerName && (
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                    {"Di\u1ec5n gi\u1ea3"}
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {workshop.speakerName}
                  </p>
                  {workshop.speakerBio && (
                    <p className="mt-1 line-clamp-3 text-xs text-gray-500">
                      {workshop.speakerBio}
                    </p>
                  )}
                </div>
              )}

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                  {"Th\u1eddi gian"}
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatDateTime(workshop.startsAt)}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {"\u2192"} {formatDateTime(workshop.endsAt)}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                  {"Ph\u00f2ng"}
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {workshop.room?.name || "\u2014"}
                </p>
                {workshop.room?.building && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    {workshop.room.building}
                  </p>
                )}
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                  {"S\u1ee9c ch\u1ee9a"}
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {workshop.capacity} {"ch\u1ed7"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">
                {"Ch\u1ed7 ng\u1ed3i"}
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
                  {isFull ? "H\u1ebft ch\u1ed7" : remaining}
                </span>
                {!isFull && (
                  <span className="text-sm text-gray-400">
                    / {workshop.capacity} {"ch\u1ed7"}
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
                {workshop.registeredCount} {"\u0111\u00e3 \u0111\u0103ng k\u00fd"}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <button
                id="btn-register"
                disabled={!canRegister || registering}
                onClick={handleRegister}
                className={`w-full rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition-all ${
                  registerSuccess
                    ? "cursor-default bg-emerald-600 text-white"
                    : canRegister && !registering
                      ? "bg-primary-600 text-white hover:bg-primary-700 active:scale-[0.98]"
                      : "cursor-not-allowed bg-gray-100 text-gray-400"
                }`}
              >
                {registering && (
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white align-middle" />
                )}
                {getButtonLabel()}
              </button>

              {registerError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {registerError}
                </div>
              )}

              {registerSuccess && (
                <div className="mt-3 space-y-2">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    {"\u0110\u0103ng k\u00fd th\u00e0nh c\u00f4ng! Xem QR code t\u1ea1i trang \"\u0110\u0103ng k\u00fd c\u1ee7a t\u00f4i\"."}
                  </div>
                  <button
                    onClick={() => navigate("/my-registrations")}
                    className="w-full rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100"
                  >
                    {"Xem \u0111\u0103ng k\u00fd c\u1ee7a t\u00f4i \u2192"}
                  </button>
                </div>
              )}
            </div>

            <p className="text-center text-[11px] text-gray-400">
              {"S\u1ed1 ch\u1ed7 c\u1eadp nh\u1eadt t\u1ef1 \u0111\u1ed9ng m\u1ed7i"} {POLL_INTERVAL / 1000}s
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
