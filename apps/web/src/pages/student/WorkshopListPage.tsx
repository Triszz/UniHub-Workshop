import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { studentWorkshopService } from "../../services/studentWorkshop.service";
import type { Workshop } from "../../types";

/* ─────────────── helpers ─────────────── */

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("vi-VN", {
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

const getSeatsInfo = (ws: Workshop) => {
  const remaining = ws.capacity - ws.registeredCount;
  const pct = ws.capacity > 0 ? (ws.registeredCount / ws.capacity) * 100 : 100;
  return { remaining, pct };
};

const getAiSummaryPreview = (summary?: string | null) => {
  if (!summary) return "";
  const normalized = summary.replace(/\s+/g, " ").trim();
  return normalized.length > 170 ? `${normalized.slice(0, 170)}...` : normalized;
};

const isWorkshopPast = (ws: Workshop) => new Date(ws.endsAt) < new Date();
const isWorkshopOngoing = (ws: Workshop) => {
  const now = new Date();
  return new Date(ws.startsAt) <= now && now < new Date(ws.endsAt);
};

const extractApiError = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { error?: string; message?: string } } };
  return e.response?.data?.error || e.response?.data?.message || fallback;
};

/* ─────────────── component ─────────────── */

const POLL_INTERVAL = 10_000; // 10 seconds

export const WorkshopListPage: React.FC = () => {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  // Initial fetch + refetch on filter change
  useEffect(() => {
    let cancelled = false;
    const params: Record<string, string | number> = { limit: 50 };
    if (dateFilter) params.date = dateFilter;

    studentWorkshopService.getAll(params).then(
      (data) => {
        if (!cancelled) {
          setWorkshops(data.workshops);
          setError("");
          setLoading(false);
        }
      },
      (err) => {
        if (!cancelled) {
          setError(extractApiError(err, "Không thể tải danh sách workshop"));
          setLoading(false);
        }
      }
    );

    return () => { cancelled = true; };
  }, [dateFilter]);

  // Polling for seat count
  useEffect(() => {
    const interval = setInterval(() => {
      const params: Record<string, string | number> = { limit: 50 };
      if (dateFilter) params.date = dateFilter;

      studentWorkshopService.getAll(params).then(
        (data) => setWorkshops(data.workshops),
        () => { /* silent fail for background poll */ }
      );
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [dateFilter]);

  // Manual refresh (event handler, not called from effects)
  const handleRefresh = () => {
    setLoading(true);
    setError("");
    const params: Record<string, string | number> = { limit: 50 };
    if (dateFilter) params.date = dateFilter;

    studentWorkshopService.getAll(params).then(
      (data) => { setWorkshops(data.workshops); setLoading(false); },
      (err) => { setError(extractApiError(err, "Không thể tải danh sách workshop")); setLoading(false); }
    );
  };

  const handleDateChange = (value: string) => {
    setLoading(true);
    setError("");
    setDateFilter(value);
  };

  const handleClearFilter = () => {
    setLoading(true);
    setError("");
    setDateFilter("");
  };

  /* ─────────────── render ─────────────── */
  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Danh sách Workshop
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Khám phá và đăng ký các workshop sắp diễn ra
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label htmlFor="date-filter" className="text-sm text-gray-600">
            Lọc theo ngày:
          </label>
          <input
            id="date-filter"
            type="date"
            value={dateFilter}
            onChange={(e) => handleDateChange(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700
              shadow-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          {dateFilter && (
            <button
              onClick={handleClearFilter}
              className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              ✕ Xóa lọc
            </button>
          )}
        </div>
        <button
          onClick={handleRefresh}
          className="self-start rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600
            shadow-sm transition-colors hover:bg-gray-50"
        >
          ↻ Làm mới
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
            <p className="text-sm text-gray-500">Đang tải danh sách...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-3 text-sm font-medium text-red-600 hover:underline"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && workshops.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900">
            {dateFilter
              ? "Không có workshop nào vào ngày này"
              : "Chưa có workshop nào được công bố"}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Vui lòng quay lại sau hoặc thử lọc theo ngày khác
          </p>
        </div>
      )}

      {/* Workshop grid */}
      {!loading && !error && workshops.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workshops.map((ws) => {
            const { remaining, pct } = getSeatsInfo(ws);
            const past = isWorkshopPast(ws);
            const ongoing = isWorkshopOngoing(ws);
            const full = remaining <= 0;

            return (
              <Link
                key={ws.id}
                to={`/workshops/${ws.id}`}
                className={`group relative flex flex-col rounded-xl border bg-white shadow-sm
                  transition-all hover:shadow-md hover:-translate-y-0.5
                  ${past ? "opacity-60 border-gray-200" : "border-gray-200 hover:border-primary-200"}`}
              >
                {/* Status badge */}
                {ongoing && (
                  <div className="absolute right-3 top-3 z-10">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      Đang diễn ra
                    </span>
                  </div>
                )}
                {past && (
                  <div className="absolute right-3 top-3 z-10">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                      Đã kết thúc
                    </span>
                  </div>
                )}

                {/* Content */}
                <div className="flex flex-1 flex-col p-5">
                  {/* Price tag */}
                  <div className="mb-3 flex items-center justify-between">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        ws.price === 0
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {formatPrice(ws.price)}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="mb-2 text-base font-semibold text-gray-900 line-clamp-2 group-hover:text-primary-700 transition-colors">
                    {ws.title}
                  </h3>

                  {ws.aiSummary ? (
                    <div className="mb-3 rounded-lg border border-primary-100 bg-primary-50/60 px-3 py-2">
                      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary-800">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                        </svg>
                        AI Summary
                      </p>
                      <p className="line-clamp-3 text-xs leading-relaxed text-primary-700">
                        {getAiSummaryPreview(ws.aiSummary)}
                      </p>
                    </div>
                  ) : ws.pdfUrl ? (
                    <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600" />
                      Đang tạo AI Summary
                    </div>
                  ) : null}

                  {/* Speaker */}
                  {ws.speakerName && (
                    <p className="mb-3 flex items-center gap-1.5 text-sm text-gray-500">
                      <svg className="h-3.5 w-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                      </svg>
                      <span className="truncate">{ws.speakerName}</span>
                    </p>
                  )}

                  {/* Meta */}
                  <div className="mt-auto space-y-1.5 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                      </svg>
                      <span>{formatDate(ws.startsAt)}</span>
                      <span className="text-gray-300">|</span>
                      <span>{formatTime(ws.startsAt)} – {formatTime(ws.endsAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                      </svg>
                      <span>
                        {ws.room?.name}
                        {ws.room?.building && ` – ${ws.room.building}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Seats bar */}
                <div className="border-t border-gray-100 px-5 py-3">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-gray-500">Chỗ còn lại</span>
                    <span
                      className={`font-semibold ${
                        full
                          ? "text-red-600"
                          : remaining <= 5
                            ? "text-amber-600"
                            : "text-gray-700"
                      }`}
                    >
                      {full ? "Hết chỗ" : `${remaining}/${ws.capacity}`}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        pct >= 100
                          ? "bg-red-500"
                          : pct >= 80
                            ? "bg-amber-500"
                            : "bg-primary-500"
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Polling indicator */}
      {!loading && !error && workshops.length > 0 && (
        <p className="mt-6 text-center text-[11px] text-gray-400">
          Dữ liệu tự động cập nhật mỗi {POLL_INTERVAL / 1000} giây
        </p>
      )}
    </>
  );
};
