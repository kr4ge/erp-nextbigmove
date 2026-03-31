"use client";

import clsx from "clsx";

type KpiMilestoneStep = {
  value: number;
  label: string;
};

const DEFAULT_STEPS: KpiMilestoneStep[] = [
  { value: 25, label: "25%" },
  { value: 50, label: "50%" },
  { value: 75, label: "75%" },
  { value: 100, label: "100%" },
];

function clampPercent(value: number | null | undefined) {
  return Math.max(0, Math.min(value ?? 0, 100));
}

interface KpiMilestoneTrackProps {
  progress: number | null | undefined;
  activeColor: string;
  steps?: KpiMilestoneStep[];
  size?: "sm" | "md";
  className?: string;
}

export function KpiMilestoneTrack({
  progress,
  activeColor,
  steps = DEFAULT_STEPS,
  size = "md",
  className,
}: KpiMilestoneTrackProps) {
  const safeProgress = clampPercent(progress);
  const trackHeight = size === "sm" ? "h-1.5" : "h-2.5";
  const dotSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const labelSize = size === "sm" ? "text-[10px]" : "text-[11px]";

  return (
    <div className={clsx("space-y-2", className)}>
      <div className="relative">
        <div className={clsx("w-full rounded-full bg-slate-100", trackHeight)} />
        <div
          className={clsx(
            "absolute left-0 top-0 rounded-full transition-all duration-300",
            trackHeight,
          )}
          style={{
            width: `${safeProgress}%`,
            backgroundColor: activeColor,
            boxShadow: `0 0 8px ${activeColor}40`,
          }}
        />

        {steps.map((step) => {
          const reached = safeProgress >= step.value;
          return (
            <div
              key={step.value}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${step.value}%` }}
            >
              <div
                className={clsx(
                  "rounded-full border-2 border-white shadow-sm",
                  dotSize,
                  reached ? "" : "bg-slate-200",
                )}
                style={reached ? { backgroundColor: activeColor } : undefined}
              />
            </div>
          );
        })}
      </div>

      <div className="relative h-4">
        {steps.map((step) => (
          <span
            key={step.value}
            className={clsx(
              "absolute top-0 -translate-x-1/2 text-center font-medium text-slate-400",
              labelSize,
            )}
            style={{ left: `${step.value}%` }}
          >
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
}
