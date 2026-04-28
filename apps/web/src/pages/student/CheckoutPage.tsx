import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QrCodeDisplay } from "../../components/student/QrCodeDisplay";
import { paymentService } from "../../services/payment.service";
import { registrationService } from "../../services/registration.service";
import type { Registration } from "../../types";

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
  if (!price || price === 0) return "Miễn phí";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(price);
};

const extractErrorCode = (err: unknown): string | undefined => {
  const e = err as { response?: { data?: { code?: string; error?: string } } };
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

  // Load registration on mount
  useEffect(() => {
    if (!id) return;

    let mounted = true;
    registrationService
      .getMyRegistrationById(id)
      .then((reg) => {
        if (!mounted) return;
        setRegistration(reg);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setError("Không tìm thấy thông tin đăng ký hoặc phiên giao dịch đã hết hạn.");
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  // Polling effect: only start when paying and status is pending
  useEffect(() => {
    if (!id || !paying || registration?.status !== "pending") return;

    stopPolling();
    pollAttemptsRef.current = 0;
    
    pollIntervalRef.current = window.setInterval(async () => {
      try {
        pollAttemptsRef.current += 1;
        
        // Timeout after 15 attempts (45 seconds)
        if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
          stopPolling();
          setPaying(false);
          setPayError(
            "Quá thời gian chờ xác nhận thanh toán. Vui lòng thử lại hoặc kiểm tra đăng ký của tôi."
          );
          return;
        }

        const result = await paymentService.pollPaymentStatus(id);
        setRegistration(result.registration);

        // Stop polling when payment is confirmed or cancelled
        if (
          result.registration.status === "confirmed" ||
          result.registration.status === "cancelled"
        ) {
          stopPolling();
          setPaying(false);
        }
      } catch (err) {
        // Check for PAYMENT_PROCESSING error - continue polling
        const errorCode = extractErrorCode(err);
        if (errorCode === "PAYMENT_PROCESSING") {
          // Continue polling, don't stop
          return;
        }
        // Other polling errors are tolerated; timeout guard handles stuck flows
      }
    }, POLL_EVERY_MS);

    return () => {
      stopPolling();
    };
  }, [id, paying, registration?.status]);

  const handlePayment = async () => {
    if (!id || !registration) return;

    setPaying(true);
    setPayError("");
    pollAttemptsRef.current = 0;

    try {
      const result = await paymentService.processPayment(id);

      // Update registration state
      if (result.registration) {
        setRegistration(result.registration);
      }

      // If directly confirmed (not pending), stop paying immediately
      if (result.registration?.status === "confirmed") {
        setPaying(false);
        stopPolling();
      }
      // If pending, polling will handle the rest
    } catch (err: unknown) {
      setPaying(false);
      stopPolling();

      const status = (err as { response?: { status?: number } }).response?.status;
      const errorCode = extractErrorCode(err);
      const rawMessage = extractErrorMessage(err).toLowerCase();

      // Map errors according to spec
      if (errorCode === "PAYMENT_FAILED" || status === 502) {
        setPayError("Thanh toán thất bại. Vui lòng thử lại.");
        return;
      }

      if (errorCode === "PAYMENT_GATEWAY_UNAVAILABLE" || status === 503) {
        setPayError(
          "Cổng thanh toán tạm thời không khả dụng. Vui lòng thử lại sau."
        );
        return;
      }

      if (errorCode === "PAYMENT_TIMEOUT" || status === 504) {
        setPayError(
          "Quá thời gian chờ xác nhận. Vui lòng thử lại hoặc kiểm tra Đăng ký của tôi."
        );
        return;
      }

      // Fallback to generic message
      if (rawMessage.includes("timeout")) {
        setPayError(
          "Quá thời gian chờ xác nhận. Vui lòng thử lại hoặc kiểm tra Đăng ký của tôi."
        );
        return;
      }

      if (rawMessage.includes("thất bại") || rawMessage.includes("failed")) {
        setPayError("Thanh toán thất bại. Vui lòng thử lại.");
        return;
      }

      setPayError("Đã xảy ra lỗi khi thanh toán. Vui lòng thử lại.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
          <p className="text-sm text-gray-500">Đang tải thông tin...</p>
        </div>
      </div>
    );
  }

  if (error || !registration) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <Link
          to="/workshops"
          className="mt-3 inline-block text-sm font-medium text-red-600 hover:underline"
        >
          ← Quay lại danh sách
        </Link>
      </div>
    );
  }

  const { workshop } = registration;
  const isConfirmed = registration.status === "confirmed";

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to={workshop ? `/workshops/${workshop.id}` : "/workshops"}
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-gray-600 transition-colors hover:text-gray-900"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
          />
        </svg>
        Quay về trang Workshop
      </Link>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Thanh toán Workshop</h1>

        {workshop && (
          <div className="mb-8 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
            <div className="p-5">
              <h2 className="mb-2 text-lg font-semibold text-gray-900">
                {workshop.title}
              </h2>
              <div className="space-y-1.5 text-sm text-gray-600">
                <p>
                  <span className="font-medium text-gray-700">Thời gian:</span>{" "}
                  {formatDateTime(workshop.startsAt)}
                </p>
                <p>
                  <span className="font-medium text-gray-700">Phòng:</span>{" "}
                  {workshop.room?.name || "—"}{" "}
                  {workshop.room?.building ? `(${workshop.room.building})` : ""}
                </p>
                <p className="font-medium text-gray-900">
                  <span className="text-gray-700">Tổng thanh toán:</span>{" "}
                  <span className="ml-1 text-xl text-primary-700">
                    {formatPrice(workshop.price)}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        {payError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {payError}
          </div>
        )}

        {isConfirmed ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg
                className="h-8 w-8 text-emerald-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m4.5 12.75 6 6 9-13.5"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-bold text-gray-900">
              Thanh toán thành công!
            </h3>
            <p className="mb-6 text-sm text-gray-600">
              Mã QR tham dự của bạn đã được xuất.
            </p>

            {registration.qrCode && (
              <div className="mb-8">
                <QrCodeDisplay
                  value={registration.qrCode}
                  label="Mã điểm danh sự kiện"
                />
              </div>
            )}

            <button
              onClick={() => navigate("/my-registrations")}
              className="w-full rounded-lg bg-primary-600 px-6 py-3 font-semibold text-white shadow-sm transition-all hover:bg-primary-700 active:scale-[0.98] sm:w-auto"
            >
              Xem đăng ký của tôi
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <h3 className="mb-1 text-sm font-semibold text-blue-900">
                Chỗ của bạn đã được giữ!
              </h3>
              <p className="text-xs text-blue-700">
                Vui lòng hoàn tất quá trình thanh toán trước khi phiên giữ chỗ
                hết hạn.
              </p>
            </div>

            <button
              onClick={handlePayment}
              disabled={paying}
              className={`w-full rounded-lg px-6 py-3.5 text-base font-semibold shadow-sm transition-all ${
                paying
                  ? "cursor-not-allowed bg-blue-400 text-white"
                  : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]"
              }`}
            >
              {paying ? (
                <>
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white align-middle" />
                  Đang xử lý thanh toán...
                </>
              ) : (
                "Thanh toán"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
