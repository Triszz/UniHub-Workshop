import React, { useCallback, useEffect, useMemo, useState } from "react";
import { csvImportService } from "../../services/csvImport.service";
import type { CsvImportLog } from "../../types";

const POLL_MS = 30000;

const statusConfig: Record<
  string,
  { label: string; classes: string; dot: string }
> = {
  processing: {
    label: "Đang xử lý",
    classes: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  completed: {
    label: "Hoàn tất",
    classes: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  failed: {
    label: "Thất bại",
    classes: "bg-red-50 text-red-700",
    dot: "bg-red-500",
  },
};

const formatDateTime = (iso?: string | null) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatNumber = (value?: number | null) =>
  value == null ? "-" : new Intl.NumberFormat("vi-VN").format(value);

const getFilename = (filename?: string | null) => {
  if (!filename) return "students.csv";
  const parts = filename.replaceAll("\\", "/").split("/");
  return parts[parts.length - 1] || filename;
};

const summarizeErrors = (errors: unknown) => {
  if (!errors) return "";
  if (Array.isArray(errors)) {
    const first = errors[0] as { row?: number; message?: string } | undefined;
    if (!first) return "";
    const row = first.row ? `Dòng ${first.row}: ` : "";
    const more = errors.length > 1 ? ` (+${errors.length - 1} lỗi)` : "";
    return `${row}${first.message || "Có lỗi dữ liệu"}${more}`;
  }
  if (typeof errors === "object" && errors !== null) {
    const message = (errors as { message?: string }).message;
    return message || JSON.stringify(errors);
  }
  return String(errors);
};

const CsvImportStatusBadge = ({ status }: { status: string }) => {
  const cfg = statusConfig[status] || {
    label: status,
    classes: "bg-gray-100 text-gray-700",
    dot: "bg-gray-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.classes}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

export const CsvImportHistoryPanel: React.FC = () => {
  const [logs, setLogs] = useState<CsvImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchLogs = useCallback(async (mode: "initial" | "refresh" = "refresh") => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    setError("");

    try {
      const data = await csvImportService.getHistory();
      setLogs(data);
    } catch (err) {
      const apiError = err as {
        response?: { data?: { error?: string; message?: string } };
      };
      setError(
        apiError.response?.data?.error ||
          apiError.response?.data?.message ||
          "Không thể tải lịch sử import CSV",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void fetchLogs("initial"), 0);
    const interval = window.setInterval(() => void fetchLogs(), POLL_MS);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [fetchLogs]);

  const totals = useMemo(
    () =>
      logs.reduce(
        (acc, log) => {
          acc.imported += log.importedRows ?? 0;
          acc.errors += log.errorRows ?? 0;
          acc.completed += log.status === "completed" ? 1 : 0;
          acc.failed += log.status === "failed" ? 1 : 0;
          return acc;
        },
        { completed: 0, failed: 0, imported: 0, errors: 0 },
      ),
    [logs],
  );

  return (
    <section className="mt-8 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Lịch sử import CSV
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            Tự động cập nhật mỗi {POLL_MS / 1000}s từ /admin/csv-imports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
            {totals.completed} hoàn tất
          </span>
          <span className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
            {totals.failed} thất bại
          </span>
          <button
            type="button"
            onClick={() => void fetchLogs()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
            )}
            Làm mới
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center px-4 py-10">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        </div>
      )}

      {!loading && error && (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {!loading && !error && logs.length === 0 && (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-medium text-gray-900">
            Chưa có lần import CSV nào
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Khi cron hoặc worker chạy, lịch sử sẽ xuất hiện tại đây.
          </p>
        </div>
      )}

      {!loading && !error && logs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-4 py-3 font-medium text-gray-600">File</th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  Trạng thái
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  Kết quả
                </th>
                <th className="hidden px-4 py-3 font-medium text-gray-600 lg:table-cell">
                  Thời gian
                </th>
                <th className="hidden px-4 py-3 font-medium text-gray-600 xl:table-cell">
                  Lỗi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => {
                const errorSummary = summarizeErrors(log.errors);
                return (
                  <tr
                    key={log.id}
                    className="transition-colors hover:bg-gray-50/60"
                  >
                    <td className="px-4 py-3.5">
                      <p
                        className="max-w-[220px] truncate font-medium text-gray-900"
                        title={log.filename || undefined}
                      >
                        {getFilename(log.filename)}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {log.id.slice(0, 8)}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <CsvImportStatusBadge status={log.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded bg-gray-100 px-2 py-1 text-gray-700">
                          Tổng {formatNumber(log.totalRows)}
                        </span>
                        <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">
                          Nhập {formatNumber(log.importedRows)}
                        </span>
                        <span className="rounded bg-amber-50 px-2 py-1 text-amber-700">
                          Bỏ qua {formatNumber(log.skippedRows)}
                        </span>
                        <span className="rounded bg-red-50 px-2 py-1 text-red-700">
                          Lỗi {formatNumber(log.errorRows)}
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3.5 lg:table-cell">
                      <p className="text-gray-700">
                        {formatDateTime(log.startedAt)}
                      </p>
                      <p className="text-xs text-gray-400">
                        Xong {formatDateTime(log.completedAt)}
                      </p>
                    </td>
                    <td className="hidden px-4 py-3.5 xl:table-cell">
                      <p
                        className="max-w-xs truncate text-xs text-gray-500"
                        title={errorSummary}
                      >
                        {errorSummary || "-"}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && logs.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
          Tổng cộng {formatNumber(totals.imported)} sinh viên đã nhập,{" "}
          {formatNumber(totals.errors)} dòng lỗi.
        </div>
      )}
    </section>
  );
};
