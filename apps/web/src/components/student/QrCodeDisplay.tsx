import React from "react";
import { QRCodeSVG } from "qrcode.react";

interface QrCodeDisplayProps {
  value: string;
  size?: number;
  label?: string;
  title?: string;
  subtitle?: string;
  meta?: string;
  variant?: "card" | "fullscreen";
}

export const QrCodeDisplay: React.FC<QrCodeDisplayProps> = ({
  value,
  size = 260,
  label,
  title,
  subtitle,
  meta,
  variant = "card",
}) => {
  const qrSize = variant === "fullscreen" ? Math.max(size, 300) : size;

  return (
    <div className="flex w-full flex-col items-center gap-4 text-center">
      <div
        className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 ${
          variant === "fullscreen" ? "p-5" : ""
        }`}
      >
        <QRCodeSVG
          value={value}
          size={qrSize}
          level="M"
          includeMargin={false}
          bgColor="#ffffff"
          fgColor="#1e293b"
          className="h-auto max-h-[68vh] w-full max-w-[min(76vw,360px)]"
        />
      </div>
      {(title || subtitle || meta) && (
        <div className="max-w-md space-y-1">
          {title && (
            <h3 className="text-lg font-semibold leading-snug text-gray-900">
              {title}
            </h3>
          )}
          {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
          {meta && <p className="text-xs text-gray-500">{meta}</p>}
        </div>
      )}
      {label && (
        <p className="max-w-sm text-center text-xs text-gray-400">
          {label}
        </p>
      )}
    </div>
  );
};
