import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { workshopService } from "../../services/workshop.service";
import type {
  AdminRegistrationFilter,
  AdminWorkshopRegistration,
  WorkshopStatsResponse,
} from "../../types";

const POLL_INTERVAL_MS = 5000;
const PAGE_LIMIT = 50;

const statusConfig: Record<
  AdminRegistrationFilter,
  { label: string; classes: string; dot: string }
> = {
  all: {
    label: "Tất cả",
    classes: "bg-gray-100 text-gray-700",
    dot: "bg-gray-400",
  },
  pending: {
    label: "Chờ thanh toán",
    classes: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  confirmed: {
    label: "Đã xác nhận",
    classes: "bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  checked_in: {
    label: "Đã check-in",
    classes: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  cancelled: {
    label: "Đã hủy",
    classes: "bg-red-50 text-red-700",
    dot: "bg-red-500",
  },
};

const filters: AdminRegistrationFilter[] = [
  "all",
  "pending",
  "confirmed",
  "checked_in",
  "cancelled",
];

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatPrice = (amount: number) => {
  if (amount === 0) return "Miễn phí";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
};

const extractApiError = (err: unknown, fallback: string) => {
  const e = err as { response?: { data?: { error?: string; message?: string } } };
  return e.response?.data?.error || e.response?.data?.message || fallback;
};

const StatCard = ({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
      {label}
    </p>
    <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    {detail && <p className="mt-1 text-xs text-gray-500">{detail}</p>}
  </div>
);

const RegistrationStatusBadge = ({
  status,
}: {
  status: AdminWorkshopRegistration["status"];
}) => {
  const cfg = statusConfig[status] || statusConfig.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.classes}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

export const WorkshopStatsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [stats, setStats] = useState<WorkshopStatsResponse | null>(null);
  const [registrations, setRegistrations] = useState<
    AdminWorkshopRegistration[]
  >([]);
  const [filter, setFilter] = useState<AdminRegistrationFilter>("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(
    async (mode: "initial" | "refresh" = "refresh") => {
      if (!id) return;
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      setError("");

      try {
        const [statsData, registrationData] = await Promise.all([
          workshopService.getStats(id),
          workshopService.getRegistrations(id, {
            status: filter,
            page,
            limit: PAGE_LIMIT,
          }),
        ]);

        setStats(statsData);
        setRegistrations(registrationData.registrations);
        setPagination(registrationData.pagination);
      } catch (err) {
        setError(extractApiError(err, "Không thể tải thống kê workshop"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter, id, page],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchData("initial");
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [fetchData]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchData();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [fetchData]);

  const attendanceRate = useMemo(() => {
    if (!stats) return 0;
    if (typeof stats.checkins.attendanceRate === "number") {
      return stats.checkins.attendanceRate;
    }
    return Number.parseFloat(stats.checkins.rate) || 0;
  }, [stats]);

  const statusCounts = useMemo(
    () => ({
      all: stats?.registrations.total ?? 0,
      pending: stats?.registrations.pending ?? 0,
      confirmed: stats?.registrations.confirmed ?? 0,
      checked_in: stats?.registrations.checkedIn ?? 0,
      cancelled: stats?.registrations.cancelled ?? 0,
    }),
    [stats],
  );

  const handleFilterChange = (nextFilter: AdminRegistrationFilter) => {
    setFilter(nextFilter);
    setPage(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/80">
        <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
              <p className="text-sm text-gray-500">Đang tải thống kê...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/80">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              to="/admin/workshops"
              className="mb-2 inline-flex items-center gap-1.5 text-sm text-gray-600 transition-colors hover:text-gray-900"
            >
              <span aria-hidden="true">←</span>
              Quay lại danh sách
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              Thống kê Workshop
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {stats?.workshop.title || "Workshop không xác định"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void fetchData()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
            )}
            Làm mới
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {stats && (
          <>
            <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard
                label="Số đăng ký"
                value={stats.registrations.total}
                detail={`${stats.registrations.confirmed + stats.registrations.checkedIn} đã xác nhận`}
              />
              <StatCard
                label="Số check-in"
                value={stats.checkins.total}
                detail={`${stats.registrations.checkedIn} trạng thái checked_in`}
              />
              <StatCard
                label="Tỷ lệ tham dự"
                value={`${attendanceRate.toFixed(1)}%`}
                detail="check-in / đã xác nhận"
              />
              <StatCard
                label="Sức chứa"
                value={`${stats.registrations.total}/${stats.workshop.capacity}`}
                detail={`${Math.max(stats.workshop.capacity - stats.registrations.total, 0)} chỗ còn lại`}
              />
              <StatCard
                label="Doanh thu"
                value={formatPrice(stats.revenue.total)}
                detail={stats.revenue.currency}
              />
            </section>

            <section className="mb-6 grid gap-3 sm:grid-cols-4">
              {filters.slice(1).map((status) => {
                const cfg = statusConfig[status];
                return (
                  <div
                    key={status}
                    className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.classes}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                      <span className="text-lg font-bold text-gray-900">
                        {statusCounts[status]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </section>
          </>
        )}

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Danh sách đăng ký
              </h2>
              <p className="text-xs text-gray-500">
                Tự động cập nhật mỗi {POLL_INTERVAL_MS / 1000}s
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {filters.map((status) => {
                const active = filter === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handleFilterChange(status)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "bg-primary-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {statusConfig[status].label} ({statusCounts[status]})
                  </button>
                );
              })}
            </div>
          </div>

          {registrations.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm font-medium text-gray-900">
                Chưa có đăng ký phù hợp
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Thử đổi bộ lọc hoặc chờ dữ liệu mới được đồng bộ.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="px-4 py-3 font-medium text-gray-600">
                      Sinh viên
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-600">
                      Trạng thái
                    </th>
                    <th className="hidden px-4 py-3 font-medium text-gray-600 md:table-cell">
                      Thanh toán
                    </th>
                    <th className="hidden px-4 py-3 font-medium text-gray-600 lg:table-cell">
                      Check-in
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-600">
                      Thời gian đăng ký
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {registrations.map((registration) => (
                    <tr
                      key={registration.id}
                      className="transition-colors hover:bg-gray-50/60"
                    >
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-gray-900">
                          {registration.user.fullName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {registration.user.email}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <RegistrationStatusBadge status={registration.status} />
                      </td>
                      <td className="hidden px-4 py-3.5 md:table-cell">
                        {registration.payment ? (
                          <>
                            <p className="font-medium text-gray-700">
                              {formatPrice(registration.payment.amount)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {registration.payment.status}
                            </p>
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3.5 lg:table-cell">
                        {registration.checkin ? (
                          <>
                            <p className="text-gray-700">
                              {formatDateTime(registration.checkin.checkedInAt)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {registration.checkin.isOffline
                                ? "Offline"
                                : "Online"}
                              {registration.checkin.deviceId
                                ? ` · ${registration.checkin.deviceId}`
                                : ""}
                            </p>
                          </>
                        ) : (
                          <span className="text-gray-400">Chưa check-in</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-gray-700">
                        {formatDateTime(registration.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm">
            <p className="text-xs text-gray-500">
              Hiển thị {registrations.length} / {pagination.total} đăng ký
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Trước
              </button>
              <span className="text-xs text-gray-500">
                Trang {pagination.page} / {Math.max(pagination.totalPages, 1)}
              </span>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Sau
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
