import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { QrCodeDisplay } from "../../components/student/QrCodeDisplay";
import { registrationService } from "../../services/registration.service";
import type { Registration, RegistrationStatus } from "../../types";

const TEXT = {
  title: "\u0110\u0103ng k\u00fd c\u1ee7a t\u00f4i",
  subtitle: "Qu\u1ea3n l\u00fd c\u00e1c workshop b\u1ea1n \u0111\u00e3 \u0111\u0103ng k\u00fd",
  addMore: "+ \u0110\u0103ng k\u00fd th\u00eam",
  loading: "\u0110ang t\u1ea3i...",
  loadFailed: "Kh\u00f4ng th\u1ec3 t\u1ea3i danh s\u00e1ch \u0111\u0103ng k\u00fd",
  retry: "Th\u1eed l\u1ea1i",
  empty: "B\u1ea1n ch\u01b0a \u0111\u0103ng k\u00fd workshop n\u00e0o",
  emptyHint: "H\u00e3y kh\u00e1m ph\u00e1 c\u00e1c workshop \u0111ang m\u1edf \u0111\u0103ng k\u00fd",
  listWorkshops: "Xem danh s\u00e1ch Workshop",
  unknownWorkshop: "Workshop kh\u00f4ng x\u00e1c \u0111\u1ecbnh",
  ended: "\u0110\u00e3 k\u1ebft th\u00fac",
  registeredAt: "\u0110\u0103ng k\u00fd l\u00fac:",
  detail: "Chi ti\u1ebft",
  viewQr: "Xem QR",
  closeQr: "\u0110\u00f3ng QR",
  qrLabel:
    "\u0110\u01b0a m\u00e3 QR n\u00e0y cho nh\u00e2n vi\u00ean check-in t\u1ea1i workshop.",
};

const statusConfig: Record<
  RegistrationStatus,
  { label: string; classes: string; dot: string }
> = {
  pending: {
    label: "Ch\u1edd x\u1eed l\u00fd",
    classes: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  confirmed: {
    label: "\u0110\u00e3 x\u00e1c nh\u1eadn",
    classes: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  checked_in: {
    label: "\u0110\u00e3 tham gia",
    classes: "bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  cancelled: {
    label: "\u0110\u00e3 h\u1ee7y",
    classes: "bg-red-50 text-red-700",
    dot: "bg-red-500",
  },
};

const formatDateTime = (iso?: string) => {
  if (!iso) return "Ch\u01b0a c\u1eadp nh\u1eadt";
  return new Date(iso).toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const extractApiError = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { error?: string; message?: string } } };
  return e.response?.data?.error || e.response?.data?.message || fallback;
};

const RegistrationBadge = ({ status }: { status: RegistrationStatus }) => {
  const cfg = statusConfig[status] || statusConfig.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.classes}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const QrFullscreenModal = ({
  registration,
  onClose,
}: {
  registration: Registration;
  onClose: () => void;
}) => {
  const workshop = registration.workshop;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!registration.qrCode) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          aria-label={TEXT.closeQr}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="pt-6">
          <QrCodeDisplay
            value={registration.qrCode}
            variant="fullscreen"
            title={workshop?.title || TEXT.unknownWorkshop}
            subtitle={formatDateTime(workshop?.startsAt)}
            meta={[workshop?.room?.name, workshop?.room?.building]
              .filter(Boolean)
              .join(" \u00b7 ")}
            label={TEXT.qrLabel}
          />
        </div>
      </div>
    </div>
  );
};

export const MyRegistrationsPage: React.FC = () => {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedQrId, setSelectedQrId] = useState<string | null>(null);

  const selectedRegistration = useMemo(
    () => registrations.find((registration) => registration.id === selectedQrId),
    [registrations, selectedQrId],
  );

  const loadRegistrations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await registrationService.getMyRegistrations();
      setRegistrations(data);
    } catch (err) {
      setError(extractApiError(err, TEXT.loadFailed));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadRegistrations(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadRegistrations]);

  return (
    <>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{TEXT.title}</h2>
          <p className="mt-1 text-sm text-gray-500">{TEXT.subtitle}</p>
        </div>
        <Link to="/workshops" className="self-start rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm transition-colors hover:bg-gray-50">
          {TEXT.addMore}
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
            <p className="text-sm text-gray-500">{TEXT.loading}</p>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <button type="button" onClick={() => void loadRegistrations()} className="mt-3 text-sm font-medium text-red-600 hover:underline">
            {TEXT.retry}
          </button>
        </div>
      )}

      {!loading && !error && registrations.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm font-medium text-gray-900">{TEXT.empty}</p>
          <p className="mt-1 text-xs text-gray-500">{TEXT.emptyHint}</p>
          <Link to="/workshops" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700">
            {TEXT.listWorkshops}
          </Link>
        </div>
      )}

      {!loading && !error && registrations.length > 0 && (
        <div className="space-y-4">
          {registrations.map((registration) => {
            const workshop = registration.workshop;
            const isPast = workshop ? new Date(workshop.endsAt) < new Date() : false;
            const canShowQr =
              Boolean(registration.qrCode) && registration.status !== "cancelled";

            return (
              <article
                key={registration.id}
                className={`rounded-xl border bg-white shadow-sm transition-all ${
                  registration.status === "cancelled"
                    ? "border-gray-200 opacity-70"
                    : "border-gray-200 hover:border-primary-200"
                }`}
              >
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <RegistrationBadge status={registration.status} />
                      {isPast && (
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">
                          {TEXT.ended}
                        </span>
                      )}
                    </div>
                    <h3 className="truncate text-base font-semibold text-gray-900">
                      {workshop?.title || TEXT.unknownWorkshop}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>{formatDateTime(workshop?.startsAt)}</span>
                      {workshop?.room?.name && (
                        <span>
                          {workshop.room.name}
                          {workshop.room.building
                            ? ` \u00b7 ${workshop.room.building}`
                            : ""}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-gray-400">
                      {TEXT.registeredAt} {formatDateTime(registration.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {workshop && (
                      <Link to={`/workshops/${workshop.id}`} className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 transition-colors hover:bg-gray-50">
                        {TEXT.detail}
                      </Link>
                    )}
                    {canShowQr && (
                      <button type="button" onClick={() => setSelectedQrId(registration.id)} className="rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-primary-700">
                        {TEXT.viewQr}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selectedRegistration?.qrCode && (
        <QrFullscreenModal
          registration={selectedRegistration}
          onClose={() => setSelectedQrId(null)}
        />
      )}
    </>
  );
};
