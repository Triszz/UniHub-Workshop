import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";
import { workshopService } from "../../services/workshop.service";
import { WorkshopForm } from "../../components/admin/WorkshopForm";
import { ConfirmDialog } from "../../components/admin/ConfirmDialog";
import type { Workshop, WorkshopFormData, Room } from "../../types";

/* ─────────────────────── helpers ─────────────────────── */

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatPrice = (price: number) => {
  if (price === 0) return "Miễn phí";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(price);
};

const statusConfig: Record<
  string,
  { label: string; classes: string; dot: string }
> = {
  draft: {
    label: "Bản nháp",
    classes: "bg-gray-100 text-gray-700",
    dot: "bg-gray-400",
  },
  published: {
    label: "Công khai",
    classes: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  cancelled: {
    label: "Đã hủy",
    classes: "bg-red-50 text-red-700",
    dot: "bg-red-500",
  },
};

/* ────────────────────── component ────────────────────── */

type ViewMode = "list" | "create" | "edit";

export const WorkshopAdminPage: React.FC = () => {
  const { user, logout } = useAuth();

  /* ── state ── */
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingWorkshop, setEditingWorkshop] = useState<Workshop | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState<Workshop | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  /* ── fetch ── */
  const fetchWorkshops = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await workshopService.getAll();
      setWorkshops(data.workshops);
      setRooms(workshopService.getRooms(data.workshops));
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Không thể tải danh sách workshop";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWorkshops();
  }, [fetchWorkshops]);

  /* ── create ── */
  const handleCreate = async (data: WorkshopFormData) => {
    setFormLoading(true);
    setFormError("");
    try {
      await workshopService.create(data);
      showToast("Tạo workshop thành công!");
      setViewMode("list");
      await fetchWorkshops();
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Tạo workshop thất bại";
      setFormError(msg);
      showToast(msg, "error");
    } finally {
      setFormLoading(false);
    }
  };

  /* ── update ── */
  const handleUpdate = async (data: WorkshopFormData) => {
    if (!editingWorkshop) return;
    setFormLoading(true);
    setFormError("");
    try {
      await workshopService.update(editingWorkshop.id, data);
      showToast("Cập nhật workshop thành công!");
      setViewMode("list");
      setEditingWorkshop(null);
      await fetchWorkshops();
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Cập nhật workshop thất bại";
      setFormError(msg);
      showToast(msg, "error");
    } finally {
      setFormLoading(false);
    }
  };

  /* ── cancel ── */
  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      const result = await workshopService.cancel(cancelTarget.id);
      showToast(
        `Đã hủy workshop. ${result.affectedRegistrations} đăng ký bị ảnh hưởng.`
      );
      setCancelTarget(null);
      await fetchWorkshops();
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Hủy workshop thất bại";
      showToast(msg, "error");
    } finally {
      setCancelLoading(false);
    }
  };

  /* ── actions ── */
  const openCreate = () => {
    setEditingWorkshop(null);
    setFormError("");
    setViewMode("create");
  };

  const openEdit = (ws: Workshop) => {
    setEditingWorkshop(ws);
    setFormError("");
    setViewMode("edit");
  };

  const backToList = () => {
    setViewMode("list");
    setEditingWorkshop(null);
    setFormError("");
  };

  /* ── filter state ── */
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const filteredWorkshops =
    statusFilter === "all"
      ? workshops
      : workshops.filter((w) => w.status === statusFilter);

  const counts = {
    all: workshops.length,
    published: workshops.filter((w) => w.status === "published").length,
    draft: workshops.filter((w) => w.status === "draft").length,
    cancelled: workshops.filter((w) => w.status === "cancelled").length,
  };

  /* ───────────────────── render ──────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* ── Top nav ── */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="text-xl">🎓</span>
            <h1 className="text-lg font-bold text-gray-900">
              UniHub Workshop
            </h1>
            <span className="hidden sm:inline-flex rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-700">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-gray-600 sm:block">
              {user?.fullName}
            </span>
            <button
              id="btn-logout"
              onClick={() => void logout()}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600
                transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* ── Toast ── */}
        {toast && (
          <div
            className={`fixed right-4 top-16 z-50 max-w-sm animate-[slide-in_0.3s_ease-out]
              rounded-lg px-4 py-3 text-sm font-medium shadow-lg
              ${
                toast.type === "success"
                  ? "bg-emerald-600 text-white"
                  : "bg-red-600 text-white"
              }`}
          >
            {toast.type === "success" ? "✓ " : "✕ "}
            {toast.message}
          </div>
        )}

        {/* ══════════════ LIST VIEW ══════════════ */}
        {viewMode === "list" && (
          <>
            {/* Header row */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Quản lý Workshop
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Tạo, chỉnh sửa và quản lý các workshop
                </p>
              </div>
              <button
                id="btn-create-workshop"
                onClick={openCreate}
                className="inline-flex items-center gap-2 self-start rounded-lg bg-primary-600
                  px-4 py-2.5 text-sm font-medium text-white shadow-sm
                  transition-colors hover:bg-primary-700"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                Tạo Workshop
              </button>
            </div>

            {/* Status filter tabs */}
            <div className="mb-4 flex flex-wrap gap-2">
              {(
                [
                  ["all", "Tất cả"],
                  ["published", "Công khai"],
                  ["draft", "Bản nháp"],
                  ["cancelled", "Đã hủy"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium
                    transition-colors
                    ${
                      statusFilter === key
                        ? "bg-primary-600 text-white shadow-sm"
                        : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                    }`}
                >
                  {label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs ${
                      statusFilter === key
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {counts[key]}
                  </span>
                </button>
              ))}
            </div>

            {/* ── Loading ── */}
            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
                  <p className="text-sm text-gray-500">
                    Đang tải danh sách...
                  </p>
                </div>
              </div>
            )}

            {/* ── Error ── */}
            {!loading && error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
                <p className="text-sm text-red-700">{error}</p>
                <button
                  onClick={() => void fetchWorkshops()}
                  className="mt-3 text-sm font-medium text-red-600 hover:underline"
                >
                  Thử lại
                </button>
              </div>
            )}

            {/* ── Empty ── */}
            {!loading && !error && filteredWorkshops.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <svg
                    className="h-6 w-6 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-900">
                  {statusFilter === "all"
                    ? "Chưa có workshop nào"
                    : `Không có workshop "${statusConfig[statusFilter]?.label || statusFilter}"`}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Nhấn "Tạo Workshop" để bắt đầu
                </p>
              </div>
            )}

            {/* ── Table ── */}
            {!loading && !error && filteredWorkshops.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/60">
                        <th className="px-4 py-3 font-medium text-gray-600">
                          Workshop
                        </th>
                        <th className="hidden px-4 py-3 font-medium text-gray-600 md:table-cell">
                          Phòng
                        </th>
                        <th className="hidden px-4 py-3 font-medium text-gray-600 lg:table-cell">
                          Thời gian
                        </th>
                        <th className="px-4 py-3 font-medium text-gray-600 text-center">
                          Đăng ký
                        </th>
                        <th className="hidden px-4 py-3 font-medium text-gray-600 sm:table-cell">
                          Giá
                        </th>
                        <th className="px-4 py-3 font-medium text-gray-600">
                          Trạng thái
                        </th>
                        <th className="px-4 py-3 font-medium text-gray-600 text-right">
                          Thao tác
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredWorkshops.map((ws) => {
                        const cfg = statusConfig[ws.status] || statusConfig.draft;
                        const isCancelled = ws.status === "cancelled";
                        return (
                          <tr
                            key={ws.id}
                            className={`transition-colors hover:bg-gray-50/60 ${
                              isCancelled ? "opacity-60" : ""
                            }`}
                          >
                            {/* Title */}
                            <td className="px-4 py-3.5">
                              <p
                                className="font-medium text-gray-900 truncate max-w-[240px]"
                                title={ws.title}
                              >
                                {ws.title}
                              </p>
                              {ws.speakerName && (
                                <p className="mt-0.5 text-xs text-gray-500 truncate max-w-[240px]">
                                  🎤 {ws.speakerName}
                                </p>
                              )}
                              {/* Mobile-only room info */}
                              <p className="mt-0.5 text-xs text-gray-400 md:hidden">
                                📍 {ws.room?.name || "—"}
                              </p>
                            </td>

                            {/* Room */}
                            <td className="hidden px-4 py-3.5 md:table-cell">
                              <p className="text-gray-700">
                                {ws.room?.name || "—"}
                              </p>
                              {ws.room?.building && (
                                <p className="text-xs text-gray-400">
                                  {ws.room.building}
                                </p>
                              )}
                            </td>

                            {/* Time */}
                            <td className="hidden px-4 py-3.5 lg:table-cell">
                              <p className="text-gray-700 whitespace-nowrap">
                                {formatDateTime(ws.startsAt)}
                              </p>
                              <p className="text-xs text-gray-400 whitespace-nowrap">
                                → {formatDateTime(ws.endsAt)}
                              </p>
                            </td>

                            {/* Registration */}
                            <td className="px-4 py-3.5 text-center">
                              <span
                                className={`font-mono text-sm ${
                                  ws.registeredCount >= ws.capacity
                                    ? "text-red-600 font-semibold"
                                    : "text-gray-700"
                                }`}
                              >
                                {ws.registeredCount}
                              </span>
                              <span className="text-gray-400">
                                /{ws.capacity}
                              </span>
                            </td>

                            {/* Price */}
                            <td className="hidden px-4 py-3.5 sm:table-cell">
                              <span
                                className={
                                  ws.price === 0
                                    ? "text-emerald-600 font-medium"
                                    : "text-gray-700"
                                }
                              >
                                {formatPrice(ws.price)}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3.5">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.classes}`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`}
                                />
                                {cfg.label}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Link
                                  to={`/admin/workshops/${ws.id}/stats`}
                                  title="Thống kê"
                                  className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-blue-50 hover:text-blue-600"
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
                                      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125C16.5 3.504 17.004 3 17.625 3h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
                                    />
                                  </svg>
                                </Link>
                                {!isCancelled && (
                                  <>
                                    <button
                                      id={`btn-edit-${ws.id}`}
                                      onClick={() => openEdit(ws)}
                                      title="Chỉnh sửa"
                                      className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-primary-50 hover:text-primary-600"
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
                                          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                                        />
                                      </svg>
                                    </button>
                                    <button
                                      id={`btn-cancel-${ws.id}`}
                                      onClick={() => setCancelTarget(ws)}
                                      title="Hủy workshop"
                                      className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
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
                                          d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"
                                        />
                                      </svg>
                                    </button>
                                  </>
                                )}
                                {isCancelled && (
                                  <span className="px-2 text-xs text-gray-400 italic">
                                    Chỉ xem
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════ CREATE / EDIT VIEW ══════════════ */}
        {(viewMode === "create" || viewMode === "edit") && (
          <div className="mx-auto max-w-2xl">
            {/* Back button */}
            <button
              id="btn-back-list"
              onClick={backToList}
              className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-600 transition-colors hover:text-gray-900"
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
              Quay lại danh sách
            </button>

            {/* Form error from API */}
            {formError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <WorkshopForm
              workshop={viewMode === "edit" ? editingWorkshop : null}
              rooms={rooms}
              isLoading={formLoading}
              onSubmit={viewMode === "edit" ? handleUpdate : handleCreate}
              onCancel={backToList}
            />
          </div>
        )}
      </main>

      {/* ── Cancel confirm dialog ── */}
      <ConfirmDialog
        isOpen={!!cancelTarget}
        title="Hủy Workshop"
        message={`Bạn có chắc muốn hủy workshop "${cancelTarget?.title || ""}"?`}
        detail="Soft cancel: workshop status changes to cancelled but data is not deleted. All related registrations will also be cancelled. This action cannot be undone."
        confirmLabel="Xác nhận hủy"
        cancelLabel="Giữ lại"
        variant="danger"
        isLoading={cancelLoading}
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
};
