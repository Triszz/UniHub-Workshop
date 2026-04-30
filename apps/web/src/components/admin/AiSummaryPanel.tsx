import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { workshopService } from "../../services/workshop.service";
import type { AiSummaryStatus, Workshop } from "../../types";

const MAX_PDF_SIZE = 10 * 1024 * 1024;
const POLL_INTERVAL_MS = 5_000;

const processingStates = new Set([
  "active",
  "delayed",
  "paused",
  "prioritized",
  "waiting",
  "waiting-children",
]);

const terminalStates = new Set(["completed", "failed", null]);

const extractApiError = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { error?: string; message?: string } } };
  return e.response?.data?.error || e.response?.data?.message || fallback;
};

const validatePdf = (file: File): string => {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  if (!isPdf) return "Chỉ hỗ trợ file PDF.";
  if (file.size > MAX_PDF_SIZE) return "File quá lớn. Tối đa 10MB.";
  return "";
};

const SummarySkeleton = () => (
  <div className="rounded-lg border border-primary-100 bg-primary-50/50 p-4">
    <div className="mb-3 flex items-center gap-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
      <span className="text-sm font-semibold text-primary-800">
        Đang tạo tóm tắt AI...
      </span>
    </div>
    <div className="space-y-2">
      <div className="h-3 w-full animate-pulse rounded bg-primary-100" />
      <div className="h-3 w-11/12 animate-pulse rounded bg-primary-100" />
      <div className="h-3 w-4/5 animate-pulse rounded bg-primary-100" />
    </div>
  </div>
);

interface AiSummaryPanelProps {
  workshop: Workshop;
  onStatusChange?: (status: AiSummaryStatus) => void;
}

export const AiSummaryPanel: React.FC<AiSummaryPanelProps> = ({
  workshop,
  onStatusChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<AiSummaryStatus>({
    pdfUrl: workshop.pdfUrl ?? null,
    aiSummary: workshop.aiSummary ?? null,
    jobState: null,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [checking, setChecking] = useState(Boolean(workshop.pdfUrl));
  const [uploading, setUploading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [optimisticUntil, setOptimisticUntil] = useState(0);

  const applyStatus = useCallback(
    (nextStatus: AiSummaryStatus) => {
      setStatus(nextStatus);
      onStatusChange?.(nextStatus);

      if (
        nextStatus.aiSummary ||
        (Date.now() >= optimisticUntil && nextStatus.jobState === "failed")
      ) {
        setOptimisticUntil(0);
      }
    },
    [onStatusChange, optimisticUntil],
  );

  const fetchStatus = useCallback(async () => {
    const nextStatus = await workshopService.getAiSummaryStatus(workshop.id);
    const normalizedStatus =
      terminalStates.has(nextStatus.jobState) &&
      !nextStatus.aiSummary &&
      Date.now() < optimisticUntil
        ? { ...nextStatus, jobState: "waiting" as const }
        : nextStatus;

    applyStatus(normalizedStatus);
    return normalizedStatus;
  }, [applyStatus, optimisticUntil, workshop.id]);

  useEffect(() => {
    setStatus({
      pdfUrl: workshop.pdfUrl ?? null,
      aiSummary: workshop.aiSummary ?? null,
      jobState: null,
    });
    setChecking(Boolean(workshop.pdfUrl));
    setMessage("");
    setError("");
    setOptimisticUntil(0);
  }, [workshop.id]);

  useEffect(() => {
    if (!status.pdfUrl) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    fetchStatus()
      .then(() => {
        if (!cancelled) setChecking(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(extractApiError(err, "Không thể tải trạng thái AI Summary."));
          setChecking(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchStatus, status.pdfUrl]);

  const isProcessing = useMemo(() => {
    if (checking || uploading || retrying) return true;
    if (status.jobState && processingStates.has(status.jobState)) return true;
    if (status.pdfUrl && !status.aiSummary && Date.now() < optimisticUntil) {
      return true;
    }
    return false;
  }, [checking, optimisticUntil, retrying, status, uploading]);

  const isFailed = useMemo(() => {
    if (!status.pdfUrl || status.aiSummary || isProcessing) return false;
    if (Date.now() < optimisticUntil) return false;
    return terminalStates.has(status.jobState);
  }, [isProcessing, optimisticUntil, status]);

  const statusMessage = useMemo(() => {
    if (isProcessing) return message || "Tóm tắt AI đang được tạo...";
    return message;
  }, [isProcessing, message]);

  useEffect(() => {
    if (!isProcessing) return;

    const interval = window.setInterval(() => {
      fetchStatus().catch(() => {
        // Polling is best effort; keep the current UI until the next successful tick.
      });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [fetchStatus, isProcessing]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setError("");
    setMessage("");

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validationError = validatePdf(file);
    if (validationError) {
      setSelectedFile(null);
      setError(validationError);
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Vui lòng chọn file PDF để upload.");
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");
    setOptimisticUntil(Date.now() + 15_000);
    applyStatus({
      pdfUrl: status.pdfUrl,
      aiSummary: null,
      jobState: "waiting",
    });

    try {
      const result = await workshopService.uploadPdf(workshop.id, selectedFile);
      setMessage(result.message);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      applyStatus({
        pdfUrl: result.pdfUrl ?? status.pdfUrl,
        aiSummary: null,
        jobState: "waiting",
      });
    } catch (err) {
      setOptimisticUntil(0);
      applyStatus({
        pdfUrl: workshop.pdfUrl ?? null,
        aiSummary: workshop.aiSummary ?? null,
        jobState: null,
      });
      setError(extractApiError(err, "Upload PDF thất bại."));
    } finally {
      setUploading(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    setError("");
    setMessage("");
    setOptimisticUntil(Date.now() + 15_000);
    applyStatus({
      pdfUrl: status.pdfUrl,
      aiSummary: null,
      jobState: "waiting",
    });

    try {
      const result = await workshopService.retryAiSummary(workshop.id);
      setMessage(result.message);
      applyStatus({
        pdfUrl: status.pdfUrl,
        aiSummary: null,
        jobState: "waiting",
      });
    } catch (err) {
      setOptimisticUntil(0);
      applyStatus({
        pdfUrl: status.pdfUrl,
        aiSummary: status.aiSummary,
        jobState: "failed",
      });
      setError(extractApiError(err, "Thử lại AI Summary thất bại."));
    } finally {
      setRetrying(false);
    }
  };

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            PDF & AI Summary
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            Upload tài liệu workshop để hệ thống tạo tóm tắt hiển thị ở trang chi tiết.
          </p>
        </div>

        {isFailed && (
          <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
            ⚠ Thất bại
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          ref={fileInputRef}
          id="ws-pdf"
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileChange}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-700 hover:file:bg-primary-100"
        />
        <button
          type="button"
          onClick={handleUpload}
          disabled={!selectedFile || uploading || retrying}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {uploading && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          )}
          Upload PDF
        </button>
      </div>

      <p className="text-xs text-gray-500">Chỉ hỗ trợ PDF, tối đa 10MB.</p>

      {statusMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {statusMessage}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {isProcessing && <SummarySkeleton />}

      {!isProcessing && status.aiSummary && (
        <div className="rounded-lg border border-primary-100 bg-white p-4">
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-primary-800">
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
                d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
              />
            </svg>
            Tóm tắt bởi AI
          </h4>
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
            {status.aiSummary}
          </p>
        </div>
      )}

      {isFailed && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-3">
          <p className="text-xs text-red-700">
            AI Summary chưa được tạo thành công. Workshop vẫn hoạt động bình thường.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying || uploading}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {retrying && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-200 border-t-red-600" />
            )}
            Retry
          </button>
        </div>
      )}
    </section>
  );
};
