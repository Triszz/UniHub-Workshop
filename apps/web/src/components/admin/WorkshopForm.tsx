import React, { useState, useEffect } from "react";
import type { Workshop, WorkshopFormData, Room } from "../../types";

interface WorkshopFormProps {
  workshop?: Workshop | null;
  rooms: Room[];
  isLoading: boolean;
  onSubmit: (data: WorkshopFormData) => void;
  onCancel: () => void;
}

interface FormErrors {
  title?: string;
  roomId?: string;
  capacity?: string;
  startsAt?: string;
  endsAt?: string;
  price?: string;
}

/**
 * Convert ISO datetime to `datetime-local` input value (YYYY-MM-DDTHH:mm)
 */
const isoToDatetimeLocal = (iso: string): string => {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const WorkshopForm: React.FC<WorkshopFormProps> = ({
  workshop,
  rooms,
  isLoading,
  onSubmit,
  onCancel,
}) => {
  const isEditing = !!workshop;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [speakerName, setSpeakerName] = useState("");
  const [speakerBio, setSpeakerBio] = useState("");
  const [roomId, setRoomId] = useState("");
  const [capacity, setCapacity] = useState(50);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [price, setPrice] = useState(0);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState("");

  // Populate form when editing
  useEffect(() => {
    if (workshop) {
      setTitle(workshop.title);
      setDescription(workshop.description || "");
      setSpeakerName(workshop.speakerName || "");
      setSpeakerBio(workshop.speakerBio || "");
      setRoomId(workshop.room?.id || "");
      setCapacity(workshop.capacity);
      setStartsAt(isoToDatetimeLocal(workshop.startsAt));
      setEndsAt(isoToDatetimeLocal(workshop.endsAt));
      setPrice(workshop.price);
      setStatus(
        workshop.status === "cancelled" ? "draft" : (workshop.status as "draft" | "published")
      );
    } else {
      // Default start: tomorrow 9:00 AM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      setStartsAt(isoToDatetimeLocal(tomorrow.toISOString()));

      const tomorrowEnd = new Date(tomorrow);
      tomorrowEnd.setHours(11, 0, 0, 0);
      setEndsAt(isoToDatetimeLocal(tomorrowEnd.toISOString()));
    }
  }, [workshop]);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!title.trim()) newErrors.title = "Tiêu đề không được để trống";
    if (!roomId) newErrors.roomId = "Vui lòng chọn phòng";
    if (capacity < 1 || capacity > 500)
      newErrors.capacity = "Sức chứa từ 1 đến 500";
    if (price < 0) newErrors.price = "Giá không thể âm";

    if (!startsAt) {
      newErrors.startsAt = "Vui lòng chọn thời gian bắt đầu";
    }
    if (!endsAt) {
      newErrors.endsAt = "Vui lòng chọn thời gian kết thúc";
    }

    if (startsAt && endsAt) {
      const start = new Date(startsAt);
      const end = new Date(endsAt);
      if (end <= start) {
        newErrors.endsAt = "Thời gian kết thúc phải sau thời gian bắt đầu";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");
    if (!validate()) return;

    const data: WorkshopFormData = {
      title: title.trim(),
      roomId,
      capacity,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      price,
      status,
    };

    if (description.trim()) data.description = description.trim();
    if (speakerName.trim()) data.speakerName = speakerName.trim();
    if (speakerBio.trim()) data.speakerBio = speakerBio.trim();

    onSubmit(data);
  };

  const inputClasses = (hasError: boolean) =>
    `w-full rounded-lg border px-3 py-2.5 text-sm transition-colors
     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
     ${hasError ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"}`;

  const labelClasses = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {isEditing ? "Chỉnh sửa Workshop" : "Tạo Workshop mới"}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {isEditing
            ? "Cập nhật thông tin workshop"
            : "Điền thông tin để tạo workshop mới"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        {/* API error */}
        {apiError && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {apiError}
          </div>
        )}

        <div className="space-y-5">
          {/* Title */}
          <div>
            <label htmlFor="ws-title" className={labelClasses}>
              Tiêu đề <span className="text-red-500">*</span>
            </label>
            <input
              id="ws-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClasses(!!errors.title)}
              placeholder="Ví dụ: Workshop AI cho sinh viên"
              maxLength={255}
            />
            {errors.title && (
              <p className="mt-1 text-xs text-red-500">{errors.title}</p>
            )}
          </div>

          {/* Room + Status */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ws-room" className={labelClasses}>
                Phòng <span className="text-red-500">*</span>
              </label>
              <select
                id="ws-room"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className={inputClasses(!!errors.roomId)}
              >
                <option value="">Chọn phòng...</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.building ? ` — ${r.building}` : ""}
                    {r.capacity ? ` (${r.capacity} chỗ)` : ""}
                  </option>
                ))}
              </select>
              {errors.roomId && (
                <p className="mt-1 text-xs text-red-500">{errors.roomId}</p>
              )}
            </div>

            <div>
              <label htmlFor="ws-status" className={labelClasses}>
                Trạng thái
              </label>
              <select
                id="ws-status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "draft" | "published")
                }
                className={inputClasses(false)}
              >
                <option value="draft">📝 Bản nháp (Draft)</option>
                <option value="published">🟢 Công khai (Published)</option>
              </select>
            </div>
          </div>

          {/* Capacity + Price */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ws-capacity" className={labelClasses}>
                Sức chứa <span className="text-red-500">*</span>
              </label>
              <input
                id="ws-capacity"
                type="number"
                min={1}
                max={500}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className={inputClasses(!!errors.capacity)}
              />
              {errors.capacity && (
                <p className="mt-1 text-xs text-red-500">{errors.capacity}</p>
              )}
            </div>

            <div>
              <label htmlFor="ws-price" className={labelClasses}>
                Giá (VNĐ) <span className="text-red-500">*</span>
              </label>
              <input
                id="ws-price"
                type="number"
                min={0}
                step={1000}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className={inputClasses(!!errors.price)}
                placeholder="0 = Miễn phí"
              />
              {errors.price && (
                <p className="mt-1 text-xs text-red-500">{errors.price}</p>
              )}
            </div>
          </div>

          {/* Starts At + Ends At */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ws-starts" className={labelClasses}>
                Bắt đầu <span className="text-red-500">*</span>
              </label>
              <input
                id="ws-starts"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={inputClasses(!!errors.startsAt)}
              />
              {errors.startsAt && (
                <p className="mt-1 text-xs text-red-500">{errors.startsAt}</p>
              )}
            </div>

            <div>
              <label htmlFor="ws-ends" className={labelClasses}>
                Kết thúc <span className="text-red-500">*</span>
              </label>
              <input
                id="ws-ends"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={inputClasses(!!errors.endsAt)}
              />
              {errors.endsAt && (
                <p className="mt-1 text-xs text-red-500">{errors.endsAt}</p>
              )}
            </div>
          </div>

          {/* Speaker Name + Bio */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ws-speaker" className={labelClasses}>
                Diễn giả
              </label>
              <input
                id="ws-speaker"
                type="text"
                value={speakerName}
                onChange={(e) => setSpeakerName(e.target.value)}
                className={inputClasses(false)}
                placeholder="Tên diễn giả"
              />
            </div>

            <div>
              <label htmlFor="ws-speaker-bio" className={labelClasses}>
                Tiểu sử diễn giả
              </label>
              <input
                id="ws-speaker-bio"
                type="text"
                value={speakerBio}
                onChange={(e) => setSpeakerBio(e.target.value)}
                className={inputClasses(false)}
                placeholder="Chức danh, kinh nghiệm..."
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="ws-desc" className={labelClasses}>
              Mô tả
            </label>
            <textarea
              id="ws-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClasses(false) + " resize-none"}
              placeholder="Mô tả chi tiết nội dung workshop..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex items-center justify-end gap-3 border-t border-gray-100 pt-5">
          <button
            id="ws-form-cancel"
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700
              transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            id="ws-form-submit"
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5
              text-sm font-medium text-white transition-colors hover:bg-primary-700
              disabled:opacity-50"
          >
            {isLoading && (
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {isEditing ? "Cập nhật" : "Tạo Workshop"}
          </button>
        </div>
      </form>
    </div>
  );
};
