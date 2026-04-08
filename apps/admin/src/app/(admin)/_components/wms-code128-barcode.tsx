"use client";

import { getCode128BPattern } from "../_utils/wms-barcodes";

type WmsCode128BarcodeProps = {
  value: string;
  className?: string;
  moduleWidth?: number;
  height?: number;
};

export function WmsCode128Barcode({
  value,
  className,
  moduleWidth = 1.15,
  height = 44,
}: WmsCode128BarcodeProps) {
  const patterns = getCode128BPattern(value);

  if (!patterns) {
    return <div className={className} aria-label="Barcode preview unavailable" />;
  }

  const quietZone = moduleWidth * 10;
  const width =
    quietZone * 2 +
    patterns.reduce(
      (sum, pattern) =>
        sum +
        pattern
          .split("")
          .reduce((patternSum, digit) => patternSum + Number(digit), 0),
      0,
    ) *
      moduleWidth;

  let cursor = quietZone;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Code128 barcode ${value}`}
      className={className}
    >
      <rect width={width} height={height} fill="white" />
      {patterns.flatMap((pattern, patternIndex) =>
        pattern.split("").map((digit, segmentIndex) => {
          const segmentWidth = Number(digit) * moduleWidth;
          const x = cursor;
          cursor += segmentWidth;

          if (segmentIndex % 2 === 0) {
            return (
              <rect
                key={`${patternIndex}-${segmentIndex}`}
                x={x}
                y={0}
                width={segmentWidth}
                height={height}
                fill="#0f172a"
              />
            );
          }

          return null;
        }),
      )}
    </svg>
  );
}
