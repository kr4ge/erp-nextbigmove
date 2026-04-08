"use client";

import { getEan13BitPattern } from "../_utils/wms-barcodes";

type WmsEan13BarcodeProps = {
  value: string;
  className?: string;
  barWidth?: number;
  height?: number;
};

export function WmsEan13Barcode({
  value,
  className,
  barWidth = 2,
  height = 84,
}: WmsEan13BarcodeProps) {
  const pattern = getEan13BitPattern(value);

  if (!pattern) {
    return (
      <div
        className={className}
        aria-label="Barcode preview unavailable"
      />
    );
  }

  const quietZone = barWidth * 10;
  const width = quietZone * 2 + pattern.length * barWidth;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`EAN-13 barcode ${value}`}
      className={className}
    >
      <rect width={width} height={height} fill="white" />
      {pattern.split("").map((bit, index) =>
        bit === "1" ? (
          <rect
            key={index}
            x={quietZone + index * barWidth}
            y={0}
            width={barWidth}
            height={height}
            fill="#0f172a"
          />
        ) : null,
      )}
    </svg>
  );
}
