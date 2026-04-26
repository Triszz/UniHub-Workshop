import React from "react";
import { QRCodeSVG } from "qrcode.react";

interface QrCodeDisplayProps {
  value: string;
  size?: number;
  label?: string;
}

export const QrCodeDisplay: React.FC<QrCodeDisplayProps> = ({
  value,
  size = 200,
  label,
}) => {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
        <QRCodeSVG
          value={value}
          size={size}
          level="M"
          includeMargin={false}
          bgColor="#ffffff"
          fgColor="#1e293b"
        />
      </div>
      {label && (
        <p className="text-xs text-gray-400 text-center max-w-[200px]">
          {label}
        </p>
      )}
    </div>
  );
};
