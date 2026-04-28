import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QrCodeDisplay } from "../../components/student/QrCodeDisplay";
import { paymentService } from "../../services/payment.service";
import { registrationService } from "../../services/registration.service";
import type { Registration } from "../../types";

const TEXT = {
  free: "Mi\u1ec5n ph\u00ed",
  timeout:
    "Qu\u00e1 th\u1eddi gian ch\u1edd x\u00e1c nh\u1eadn thanh to\u00e1n. Vui l\u00f2ng th\u1eed l\u1ea1i ho\u1eb7c ki\u1ec3m tra \u0110\u0103ng k\u00fd c\u1ee7a t\u00f4i.",
  notFound:
    "Kh\u00f4ng t\u00ecm th\u1ea5y th\u00f4ng tin \u0111\u0103ng k\u00fd ho\u1eb7c phi\u00ean giao d\u1ecbch \u0111\u00e3 h\u1ebft h\u1ea1n.",
  failed: "Thanh to\u00e1n th\u1ea5t b\u1ea1i. Vui l\u00f2ng th\u1eed l\u1ea1i.",
  gateway:
    "C\u1ed5ng thanh to\u00e1n t\u1ea1m th\u1eddi kh\u00f4ng kh\u1ea3 d\u1ee5ng. Vui l\u00f2ng th\u1eed l\u1ea1i sau.",
  generic: "\u0110\u00e3 x\u1ea3y ra l\u1ed7i khi thanh to\u00e1n. Vui l\u00f2ng th\u1eed l\u1ea1i.",
  loading: "\u0110ang t\u1ea3i th\u00f4ng tin...",
  backList: "\u2190 Quay l\u1ea1i danh s\u00e1ch",
  backWorkshop: "Quay v\u1ec1 trang Workshop",
  title: "Thanh to\u00e1n Workshop",
  time: "Th\u1eddi gian:",
  room: "Ph\u00f2ng:",
  total: "T\u1ed5ng thanh to\u00e1n:",
  success: "Thanh to\u00e1n th\u00e0nh c\u00f4ng!",
  qrReady: "M\u00e3 QR tham d\u1ef1 c\u1ee7a b\u1ea1n \u0111\u00e3 \u0111\u01b0\u1ee3c xu\u1ea5t.",
  qrLabel: "M\u00e3 \u0111i\u1ec3m danh s\u1ef1 ki\u1ec7n",
  myRegs: "Xem \u0111\u0103ng k\u00fd c\u1ee7a t\u00f4i",
  hold: "Ch\u1ed7 c\u1ee7a b\u1ea1n \u0111\u00e3 \u0111\u01b0\u1ee3c gi\u1eef!",
  holdHint:
    "Vui l\u00f2ng ho\u00e0n t\u1ea5t qu\u00e1 tr\u00ecnh thanh to\u00e1n tr\u01b0\u1edbc khi phi\u00ean gi\u1eef ch\u1ed7 h\u1ebft h\u1ea1n.",
  processing: "\u0110ang x\u1eed l\u00fd thanh to\u00e1n...",
  pay: "Thanh to\u00e1n",
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatPrice = (price?: number) => {
  if (!price || price === 0) return TEXT.free;
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(price);
};

const extractErrorCode = (err: unknown): string | undefined => {
  const e = err as { response?: { data?: { code?: string } } };
  return e.response?.data?.code;
};

const extractErrorMessage = (err: unknown): string => {
  const e = err as { response?: { data?: { error?: string; message?: string } } };
  return e.response?.data?.error || e.response?.data?.message || "";
};

const MAX_POLL_ATTEMPTS = 15;
const POLL_EVERY_MS = 3000;

export const CheckoutPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const pollIntervalRef = useRef<number | null>(null);
  const pollAttemptsRef = useRef(0);

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    const timeout = window.setTimeout(() => {
      registrationService
        .getMyRegistrationById(id)
        .then((reg) => {
          if (!mounted) return;
          setRegistration(reg);
          setLoading(false);
        })
        .catch(() => {
          if (!mounted) return;
          setError(TEXT.notFound);
          setLoading(false);
        });
    }, 0);
    return () => {
      mounted = false;
      window.clearTimeout(timeout);
    };
  }, [id]);

  useEffect(() => {
    if (!id || !paying || registration?.status !== "pending") return;
    stopPolling();
    pollAttemptsRef.current = 0;
    pollIntervalRef.current = window.setInterval(async () => {
      try {
        pollAttemptsRef.current += 1;
        if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
          stopPolling();
          setPaying(false);
          setPayError(TEXT.timeout);
          return;
        }
        const result = await paymentService.pollPaymentStatus(id);
        setRegistration((current) => ({
          ...result.registration,
          workshop: result.registration.workshop ?? current?.workshop,
        }));
        if (
          result.registration.status === "confirmed" ||
          result.registration.status === "cancelled"
        ) {
          stopPolling();
          setPaying(false);
        }
      } catch (err) {
        if (extractErrorCode(err) === "PAYMENT_PROCESSING") return;
      }
    }, POLL_EVERY_MS);
    return () => stopPolling();
  }, [id, paying, registration?.status]);

  const handlePayment = async () => {
    if (!id || !registration) return;
    setPaying(true);
    setPayError("");
    pollAttemptsRef.current = 0;
    try {
      const result = await paymentService.processPayment(id);
      if (result.registration) {
        setRegistration((current) => ({
          ...result.registration!,
          workshop: result.registration?.workshop ?? current?.workshop,
        }));
      }
      if (result.registration?.status === "confirmed") {
        setPaying(false);
        stopPolling();
      }
    } catch (err: unknown) {
      setPaying(false);
      stopPolling();
      const status = (err as { response?: { status?: number } }).response?.status;
      const errorCode = extractErrorCode(err);
      const rawMessage = extractErrorMessage(err).toLowerCase();
      if (errorCode === "PAYMENT_FAILED" || status === 502) {
        setPayError(TEXT.failed);
        return;
      }
      if (errorCode === "PAYMENT_GATEWAY_UNAVAILABLE" || status === 503) {
        setPayError(TEXT.gateway);
        return;
      }
      if (errorCode === "PAYMENT_TIMEOUT" || status === 504) {
        setPayError(TEXT.timeout);
        return;
      }
      if (rawMessage.includes("timeout")) {
        setPayError(TEXT.timeout);
        return;
      }
      if (rawMessage.includes("th\u1ea5t b\u1ea1i") || rawMessage.includes("failed")) {
        setPayError(TEXT.failed);
        return;
      }
      setPayError(TEXT.generic);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
          <p className="text-sm text-gray-500">{TEXT.loading}</p>
        </div>
      </div>
    );
  }

  if (error || !registration) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <Link to="/workshops" className="mt-3 inline-block text-sm font-medium text-red-600 hover:underline">
          {TEXT.backList}
        </Link>
      </div>
    );
  }

  const { workshop } = registration;
  const isConfirmed = registration.status === "confirmed";

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={workshop ? `/workshops/${workshop.id}` : "/workshops"} className="mb-5 inline-flex items-center gap-1.5 text-sm text-gray-600 transition-colors hover:text-gray-900">
        {TEXT.backWorkshop}
      </Link>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">{TEXT.title}</h1>
        {workshop && (
          <div className="mb-8 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
            <div className="p-5">
              <h2 className="mb-2 text-lg font-semibold text-gray-900">{workshop.title}</h2>
              <div className="space-y-1.5 text-sm text-gray-600">
                <p><span className="font-medium text-gray-700">{TEXT.time}</span> {formatDateTime(workshop.startsAt)}</p>
                <p><span className="font-medium text-gray-700">{TEXT.room}</span> {workshop.room?.name || "\u2014"} {workshop.room?.building ? `(${workshop.room.building})` : ""}</p>
                <p className="font-medium text-gray-900"><span className="text-gray-700">{TEXT.total}</span> <span className="ml-1 text-xl text-primary-700">{formatPrice(workshop.price)}</span></p>
              </div>
            </div>
          </div>
        )}
        {payError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{payError}</div>
        )}
        {isConfirmed ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-bold text-gray-900">{TEXT.success}</h3>
            <p className="mb-6 text-sm text-gray-600">{TEXT.qrReady}</p>
            {registration.qrCode && (
              <div className="mb-8 w-full">
                <QrCodeDisplay
                  value={registration.qrCode}
                  title={workshop?.title}
                  subtitle={formatDateTime(workshop?.startsAt || registration.createdAt)}
                  meta={[workshop?.room?.name, workshop?.room?.building]
                    .filter(Boolean)
                    .join(" \u00b7 ")}
                  label={TEXT.qrLabel}
                />
              </div>
            )}
            <button onClick={() => navigate("/my-registrations")} className="w-full rounded-lg bg-primary-600 px-6 py-3 font-semibold text-white shadow-sm transition-all hover:bg-primary-700 active:scale-[0.98] sm:w-auto">
              {TEXT.myRegs}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <h3 className="mb-1 text-sm font-semibold text-blue-900">{TEXT.hold}</h3>
              <p className="text-xs text-blue-700">{TEXT.holdHint}</p>
            </div>
            <button onClick={handlePayment} disabled={paying} className={`w-full rounded-lg px-6 py-3.5 text-base font-semibold shadow-sm transition-all ${paying ? "cursor-not-allowed bg-blue-400 text-white" : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]"}`}>
              {paying ? (
                <>
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white align-middle" />
                  {TEXT.processing}
                </>
              ) : (
                TEXT.pay
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
